import type { TestConfig, TypingResult } from "./types";

export type ThemeName = "paper" | "nocturne" | "tide";

const CONFIG_KEY = "rill.test-config.v1";
const THEME_KEY = "rill.theme.v1";
const GUEST_RESULTS_KEY = "rill.guest-results.v1";
const MAX_GUEST_RESULTS = 100;

export const DEFAULT_CONFIG: TestConfig = {
  mode: "time",
  modeValue: 30,
  punctuation: false,
  numbers: false,
};

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isTestConfig(value: unknown): value is TestConfig {
  if (!isRecord(value)) {
    return false;
  }
  const isMode = value.mode === "time" || value.mode === "words";
  const validValue =
    value.mode === "time"
      ? value.modeValue === 15 ||
        value.modeValue === 30 ||
        value.modeValue === 60
      : value.modeValue === 10 ||
        value.modeValue === 25 ||
        value.modeValue === 50;
  return (
    isMode &&
    validValue &&
    typeof value.punctuation === "boolean" &&
    typeof value.numbers === "boolean"
  );
}

export function isTypingResult(value: unknown): value is TypingResult {
  if (!isRecord(value)) {
    return false;
  }

  const numericFields = [
    "modeValue",
    "durationMs",
    "typedCharacters",
    "correctAttempts",
    "incorrectAttempts",
    "correctCharacters",
    "missingCharacters",
    "extraAttempts",
    "correctedErrors",
    "wpm",
    "rawWpm",
    "accuracy",
    "consistency",
  ] as const;
  if (!numericFields.every((field) => isFiniteNumber(value[field]))) {
    return false;
  }
  const typedCharacters = value.typedCharacters as number;
  const correctAttempts = value.correctAttempts as number;
  const incorrectAttempts = value.incorrectAttempts as number;
  const correctCharacters = value.correctCharacters as number;
  const missingCharacters = value.missingCharacters as number;
  const extraAttempts = value.extraAttempts as number;
  const correctedErrors = value.correctedErrors as number;
  const durationMs = value.durationMs as number;
  const wpm = value.wpm as number;
  const rawWpm = value.rawWpm as number;
  const accuracy = value.accuracy as number;
  const consistency = value.consistency as number;

  const modeValueValid =
    value.mode === "time"
      ? value.modeValue === 15 ||
        value.modeValue === 30 ||
        value.modeValue === 60
      : value.modeValue === 10 ||
        value.modeValue === 25 ||
        value.modeValue === 50;
  const completedAtValid =
    typeof value.completedAt === "string" &&
    Number.isFinite(Date.parse(value.completedAt));
  const countersValid =
    isIntegerInRange(durationMs, 1, 600_000) &&
    isIntegerInRange(typedCharacters, 1, 50_000) &&
    isIntegerInRange(correctAttempts, 0, 50_000) &&
    isIntegerInRange(incorrectAttempts, 0, 50_000) &&
    typedCharacters === correctAttempts + incorrectAttempts &&
    isIntegerInRange(correctCharacters, 0, typedCharacters) &&
    isIntegerInRange(missingCharacters, 0, 50_000) &&
    isIntegerInRange(extraAttempts, 0, incorrectAttempts) &&
    isIntegerInRange(correctedErrors, 0, typedCharacters) &&
    wpm >= 0 &&
    wpm <= 999_999.99 &&
    rawWpm >= 0 &&
    rawWpm <= 999_999.99 &&
    accuracy >= 0 &&
    accuracy <= 100 &&
    consistency >= 0 &&
    consistency <= 100;

  return (
    typeof value.clientResultId === "string" &&
    (value.mode === "time" || value.mode === "words") &&
    modeValueValid &&
    typeof value.punctuation === "boolean" &&
    typeof value.numbers === "boolean" &&
    completedAtValid &&
    countersValid &&
    (value.completionReason === "finished" ||
      value.completionReason === "time" ||
      value.completionReason === "limit" ||
      value.completionReason === "prompt-exhausted") &&
    Array.isArray(value.paceBuckets) &&
    value.paceBuckets.length >= 1 &&
    value.paceBuckets.length <= 600 &&
    value.paceBuckets.every(
      (bucket) =>
        isRecord(bucket) &&
        isIntegerInRange(bucket.durationMs, 1, 1_000) &&
        isIntegerInRange(bucket.typedCharacters, 0, 50_000),
    )
  );
}

export function loadTestConfig(): TestConfig {
  const stored = readJson(CONFIG_KEY);
  return isTestConfig(stored) ? stored : DEFAULT_CONFIG;
}

export function saveTestConfig(config: TestConfig): boolean {
  return writeJson(CONFIG_KEY, config);
}

export function loadTheme(): ThemeName {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    return theme === "nocturne" || theme === "tide" ? theme : "paper";
  } catch {
    return "paper";
  }
}

export function saveTheme(theme: ThemeName): boolean {
  try {
    localStorage.setItem(THEME_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

export function loadGuestResults(): TypingResult[] {
  const stored = readJson(GUEST_RESULTS_KEY);
  if (!isRecord(stored) || stored.version !== 1 || !Array.isArray(stored.results)) {
    return [];
  }
  return stored.results.filter(isTypingResult).slice(0, MAX_GUEST_RESULTS);
}

export function saveGuestResult(
  result: TypingResult,
): { ok: boolean; deduplicated: boolean } {
  const current = loadGuestResults();
  if (current.some((item) => item.clientResultId === result.clientResultId)) {
    return { ok: true, deduplicated: true };
  }
  const results = [result, ...current].slice(0, MAX_GUEST_RESULTS);
  return {
    ok: writeJson(GUEST_RESULTS_KEY, { version: 1, results }),
    deduplicated: false,
  };
}
