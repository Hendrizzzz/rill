import { calculateConsistency, calculateMetrics } from "./scoring";
import type {
  PaceBucket,
  CodeLanguage,
  ResultCounters,
  TestConfig,
  TypingResult,
  WordListVersion,
} from "./types";

export type ThemeName = "paper" | "nocturne" | "tide";

const CONFIG_KEY = "rill.test-config.v2";
const LEGACY_CONFIG_KEY = "rill.test-config.v1";
const THEME_KEY = "rill.theme.v1";
const GUEST_RESULTS_KEY = "rill.guest-results.v4";
const PREVIOUS_GUEST_RESULTS_KEY = "rill.guest-results.v3";
const PREVIOUS_V2_GUEST_RESULTS_KEY = "rill.guest-results.v2";
const LEGACY_GUEST_RESULTS_KEY = "rill.guest-results.v1";
const MAX_GUEST_RESULTS = 100;

export const MIN_SAVED_WORD_RESULT_DURATION_MS = 1_000;

export const DEFAULT_CONFIG: TestConfig = {
  mode: "time",
  modeValue: 30,
  punctuation: false,
  numbers: false,
  contentType: "words",
  language: "en",
  codeLanguage: "python3",
  errorPolicy: "normal",
};

const CODE_LANGUAGES = new Set<CodeLanguage>([
  "cpp",
  "java",
  "python3",
  "c",
  "csharp",
  "javascript",
  "typescript",
  "go",
]);

function isCodeLanguage(value: unknown): value is CodeLanguage {
  return typeof value === "string" && CODE_LANGUAGES.has(value as CodeLanguage);
}

function isWordListVersion(value: unknown): value is WordListVersion {
  return (
    value === "en-v1" ||
    value === "es-v1" ||
    value === "quote-v1" ||
    value === "custom-v1" ||
    value === "code-v1" ||
    value === "code-v2"
  );
}

function legacyWordListVersion(
  value: Record<string, unknown>,
): WordListVersion | null {
  if (value.contentType === "words") {
    return value.language === "es" ? "es-v1" : "en-v1";
  }
  if (value.contentType === "quote") return "quote-v1";
  if (value.contentType === "custom") return "custom-v1";
  if (value.contentType === "code") return "code-v1";
  return null;
}

export function migrateUnversionedTypingResult(value: unknown): unknown {
  if (
    !isRecord(value) ||
    Object.hasOwn(value, "wordListVersion")
  ) {
    return value;
  }
  const wordListVersion = legacyWordListVersion(value);
  return wordListVersion === null
    ? value
    : { ...value, wordListVersion };
}

function wordListVersionMatchesDimensions(
  value: Record<string, unknown>,
): boolean {
  if (!isWordListVersion(value.wordListVersion)) return false;
  if (value.contentType === "words") {
    return value.wordListVersion ===
      (value.language === "es" ? "es-v1" : "en-v1");
  }
  if (value.contentType === "quote") {
    return value.wordListVersion === "quote-v1";
  }
  if (value.contentType === "custom") {
    return value.wordListVersion === "custom-v1";
  }
  return (
    value.contentType === "code" &&
    (value.wordListVersion === "code-v1" ||
      value.wordListVersion === "code-v2")
  );
}

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

function isHundredthInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    isFiniteNumber(value) &&
    value >= minimum &&
    value <= maximum &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-7
  );
}

function approximatelyEqual(
  actual: number,
  expected: number,
  tolerance: number,
): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

function isCanonicalRawDuration(
  rawDuration: number,
  aggregateDuration: number,
): boolean {
  const difference = rawDuration - aggregateDuration;
  return difference >= -5.0000001 && difference <= 4.9900001;
}

function isTestConfig(value: unknown): value is TestConfig {
  if (!isRecord(value)) {
    return false;
  }
  const isMode = value.mode === "time" || value.mode === "words";
  const dimensionsValid =
    (value.contentType === "words" ||
      value.contentType === "quote" ||
      value.contentType === "custom" ||
      value.contentType === "code") &&
    (value.language === "en" || value.language === "es") &&
    (value.contentType === "code"
      ? isCodeLanguage(value.codeLanguage)
      : value.codeLanguage === undefined ||
        isCodeLanguage(value.codeLanguage)) &&
    (value.errorPolicy === "normal" || value.errorPolicy === "strict");
  const validValue =
    value.contentType === "words"
      ? value.mode === "time"
        ? value.modeValue === 15 ||
          value.modeValue === 30 ||
          value.modeValue === 60
        : value.modeValue === 10 ||
          value.modeValue === 25 ||
          value.modeValue === 50
      : value.mode === "words" &&
        isIntegerInRange(value.modeValue, 2, 300) &&
        value.punctuation === false &&
        value.numbers === false;
  return (
    isMode &&
    dimensionsValid &&
    validValue &&
    typeof value.punctuation === "boolean" &&
    typeof value.numbers === "boolean"
  );
}

function legacyConfig(value: unknown): TestConfig | null {
  if (!isRecord(value)) return null;
  const candidate = {
    ...value,
    contentType: "words",
    language: "en",
    errorPolicy: "normal",
  };
  return isTestConfig(candidate) ? candidate : null;
}

function hasValidPaceBuckets(
  value: unknown,
  durationMs: number,
  mode: TestConfig["mode"],
  attempts: number,
  incorrectAttempts: number,
  correctCharacters: number,
  typedCharacters: number,
): boolean {
  if (!Array.isArray(value) || value.length > 600) {
    return false;
  }

  let totalDuration = 0;
  let totalInsertions = 0;
  let totalErrors = 0;
  for (const [index, bucket] of value.entries()) {
    const insertionsThroughBucket =
      totalInsertions +
      (isRecord(bucket) && typeof bucket.typedCharacters === "number"
        ? bucket.typedCharacters
        : 0);
    if (
      !isRecord(bucket) ||
      !isHundredthInRange(bucket.durationMs, 0.01, 1_000) ||
      !isIntegerInRange(bucket.typedCharacters, 0, 50_000) ||
      !isIntegerInRange(bucket.correctCharacters, 0, 50_000) ||
      !isIntegerInRange(bucket.rawCharacters, 0, 50_000) ||
      !isIntegerInRange(bucket.errors, 0, 50_000) ||
      bucket.errors > bucket.typedCharacters ||
      bucket.correctCharacters > bucket.rawCharacters ||
      bucket.rawCharacters > insertionsThroughBucket ||
      (index < value.length - 1 && bucket.durationMs !== 1_000)
    ) {
      return false;
    }
    totalDuration += bucket.durationMs;
    totalInsertions = insertionsThroughBucket;
    totalErrors += bucket.errors;
  }

  const completeSeconds = Math.floor(durationMs / 1_000);
  const remainder = durationMs - completeSeconds * 1_000;
  const completeSecondDuration = completeSeconds * 1_000;
  const graphDurationValid =
    mode === "time"
      ? approximatelyEqual(totalDuration, durationMs, 0.005)
      : remainder >= 500
        ? isCanonicalRawDuration(totalDuration, durationMs)
        : remainder === 0
          ? approximatelyEqual(totalDuration, durationMs, 0.005) ||
            (durationMs >= 1_000 &&
              approximatelyEqual(totalDuration, durationMs - 1_000, 0.005))
          : approximatelyEqual(totalDuration, completeSecondDuration, 0.005);
  if (
    !graphDurationValid ||
    totalInsertions > attempts ||
    totalErrors > incorrectAttempts
  ) {
    return false;
  }
  if (
    value.length === 0 ||
    !isCanonicalRawDuration(totalDuration, durationMs)
  ) {
    return true;
  }
  const finalBucket: unknown = value.at(-1);
  return (
    isRecord(finalBucket) &&
    totalInsertions === attempts &&
    totalErrors === incorrectAttempts &&
    finalBucket.correctCharacters === correctCharacters &&
    finalBucket.rawCharacters === typedCharacters
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
    "incorrectCharacters",
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
  const incorrectCharacters = value.incorrectCharacters as number;
  const missingCharacters = value.missingCharacters as number;
  const extraAttempts = value.extraAttempts as number;
  const correctedErrors = value.correctedErrors as number;
  const durationMs = value.durationMs as number;
  const modeValue = value.modeValue as number;
  const wpm = value.wpm as number;
  const rawWpm = value.rawWpm as number;
  const accuracy = value.accuracy as number;
  const consistency = value.consistency as number;

  const resultDimensionsValid =
    (value.contentType === "words" ||
      value.contentType === "quote" ||
      value.contentType === "custom" ||
      value.contentType === "code") &&
    (value.language === "en" || value.language === "es") &&
    (value.contentType === "code"
      ? isCodeLanguage(value.codeLanguage)
      : value.codeLanguage === undefined) &&
    wordListVersionMatchesDimensions(value) &&
    (value.errorPolicy === "normal" || value.errorPolicy === "strict");
  const modeValueValid =
    value.contentType === "words"
      ? value.mode === "time"
        ? value.modeValue === 15 ||
          value.modeValue === 30 ||
          value.modeValue === 60
        : value.modeValue === 10 ||
          value.modeValue === 25 ||
          value.modeValue === 50
      : value.mode === "words" &&
        isIntegerInRange(value.modeValue, 2, 300) &&
        value.punctuation === false &&
        value.numbers === false;
  const completedAtValid =
    typeof value.completedAt === "string" &&
    Number.isFinite(Date.parse(value.completedAt));
  const durationValid =
    isIntegerInRange(durationMs, 1, 600_000) &&
    (value.mode === "time"
      ? durationMs === modeValue * 1_000
      : durationMs >= MIN_SAVED_WORD_RESULT_DURATION_MS &&
        durationMs % 10 === 0);
  const completionReasonValid =
    value.mode === "time"
      ? value.completionReason === "time" ||
        value.completionReason === "prompt-exhausted"
      : value.completionReason === "finished" ||
        value.completionReason === "prompt-exhausted" ||
        (value.completionReason === "limit" && durationMs === 600_000);
  const countersValid =
    durationValid &&
    isIntegerInRange(typedCharacters, 1, 50_000) &&
    isIntegerInRange(correctAttempts, 0, 50_000) &&
    isIntegerInRange(incorrectAttempts, 0, 50_000) &&
    typedCharacters <= correctAttempts + incorrectAttempts &&
    isIntegerInRange(correctCharacters, 0, typedCharacters) &&
    isIntegerInRange(incorrectCharacters, 0, typedCharacters) &&
    isIntegerInRange(missingCharacters, 0, 50_000) &&
    isIntegerInRange(extraAttempts, 0, typedCharacters) &&
    correctCharacters + incorrectCharacters + extraAttempts <=
      typedCharacters &&
    isIntegerInRange(correctedErrors, 0, incorrectAttempts) &&
    wpm >= 0 &&
    wpm <= 999_999.99 &&
    rawWpm >= 0 &&
    rawWpm <= 999_999.99 &&
    accuracy >= 0 &&
    accuracy <= 100 &&
    consistency >= 0 &&
    consistency <= 100;

  const shapeValid =
    typeof value.clientResultId === "string" &&
    (value.mode === "time" || value.mode === "words") &&
    resultDimensionsValid &&
    modeValueValid &&
    typeof value.punctuation === "boolean" &&
    typeof value.numbers === "boolean" &&
    completedAtValid &&
    countersValid &&
    completionReasonValid &&
    hasValidPaceBuckets(
      value.paceBuckets,
      durationMs,
      value.mode,
      correctAttempts + incorrectAttempts,
      incorrectAttempts,
      correctCharacters,
      typedCharacters,
    );
  if (!shapeValid) {
    return false;
  }

  const counters: ResultCounters = {
    typedCharacters,
    correctAttempts,
    incorrectAttempts,
    correctCharacters,
    incorrectCharacters,
    missingCharacters,
    extraAttempts,
    correctedErrors,
  };
  const metrics = calculateMetrics(
    durationMs,
    counters,
    value.paceBuckets as PaceBucket[],
  );
  return (
    wpm === metrics.wpm &&
    rawWpm === metrics.rawWpm &&
    accuracy === metrics.accuracy &&
    consistency === metrics.consistency
  );
}

export function loadTestConfig(): TestConfig {
  const stored = readJson(CONFIG_KEY);
  if (isTestConfig(stored) && stored.contentType !== "custom") return stored;
  return legacyConfig(readJson(LEGACY_CONFIG_KEY)) ?? DEFAULT_CONFIG;
}

export function saveTestConfig(config: TestConfig): boolean {
  const persistentConfig: TestConfig =
    config.contentType === "custom"
      ? {
          ...config,
          contentType: "words",
          mode: "words",
          modeValue: 25,
          punctuation: false,
          numbers: false,
        }
      : config;
  return writeJson(CONFIG_KEY, persistentConfig);
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
  const current = readJson(GUEST_RESULTS_KEY);
  const previous = readJson(PREVIOUS_GUEST_RESULTS_KEY);
  const previousV2 = readJson(PREVIOUS_V2_GUEST_RESULTS_KEY);
  const stored =
    isRecord(current) && current.version === 4
      ? current
      : isRecord(previous) && previous.version === 3
        ? previous
        : isRecord(previousV2) && previousV2.version === 2
          ? previousV2
        : null;
  if (stored === null || !Array.isArray(stored.results)) {
    return [];
  }
  const storedResults = stored.results as unknown[];
  return storedResults
    .map((result) =>
      stored.version === 2 && isRecord(result)
        ? {
            ...result,
            contentType: "words",
            language: "en",
            errorPolicy: "normal",
          }
        : result,
    )
    .map(migrateUnversionedTypingResult)
    .filter(isTypingResult)
    .map((result) => ({
      ...result,
      consistency: calculateConsistency(result.paceBuckets),
    }))
    .slice(0, MAX_GUEST_RESULTS);
}

export function isResultSaveEligible(result: TypingResult): boolean {
  return result.durationMs >= MIN_SAVED_WORD_RESULT_DURATION_MS;
}

export function hasLegacyGuestResults(): boolean {
  const stored = readJson(LEGACY_GUEST_RESULTS_KEY);
  return (
    isRecord(stored) &&
    stored.version === 1 &&
    Array.isArray(stored.results) &&
    stored.results.length > 0
  );
}

export function saveGuestResult(
  result: TypingResult,
): { ok: boolean; deduplicated: boolean } {
  if (!isResultSaveEligible(result) || !isTypingResult(result)) {
    return { ok: false, deduplicated: false };
  }
  const current = loadGuestResults();
  if (current.some((item) => item.clientResultId === result.clientResultId)) {
    return { ok: true, deduplicated: true };
  }
  const results = [result, ...current].slice(0, MAX_GUEST_RESULTS);
  return {
    ok: writeJson(GUEST_RESULTS_KEY, { version: 4, results }),
    deduplicated: false,
  };
}
