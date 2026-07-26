import type { TypingResult } from "../features/typing/types";

export interface AccountUser {
  id: string;
  username: string;
  createdAt: string;
}

export interface SessionSnapshot {
  authenticated: boolean;
  user?: AccountUser;
  csrfToken: string;
}

export interface ResultPage {
  items: TypingResult[];
  nextCursor?: string;
}

export interface ResultRecord {
  key: {
    mode: "time" | "words";
    modeValue: number;
    punctuation: boolean;
    numbers: boolean;
  };
  result: TypingResult;
}

export interface ResultSummary {
  totalRuns: number;
  totalPracticeMs: number;
  highestWpm: number;
  averageAccuracy: number;
  records: ResultRecord[];
}

export const SESSION_EXPIRED_EVENT = "rill:session-expired";
const REQUEST_TIMEOUT_MS = 10_000;

interface ServerResult extends Omit<TypingResult, "mode" | "completionReason"> {
  mode: "TIME" | "WORDS";
  oldestResultsPruned: number;
}

interface ServerResultPage {
  items: ServerResult[];
  nextCursor?: string;
}

interface ProblemBody {
  code?: string;
  detail?: string;
  fieldErrors?: Record<string, string>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string> | undefined;

  constructor(status: number, body: ProblemBody) {
    super(body.detail ?? "The request could not be completed.");
    this.name = "ApiError";
    this.status = status;
    this.code = body.code ?? "REQUEST_FAILED";
    this.fieldErrors = body.fieldErrors;
  }
}

export function isRetryableApiError(error: unknown): boolean {
  return (
    !(error instanceof ApiError) ||
    error.status === 401 ||
    error.status === 408 ||
    error.status === 425 ||
    error.status === 429 ||
    error.status >= 500
  );
}

let csrfToken: string | null = null;
let bootstrapInFlight: Promise<SessionSnapshot> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function malformedResponse(): ApiError {
  return new ApiError(502, {
    code: "INVALID_RESPONSE",
    detail: "The service returned an invalid response.",
  });
}

function readProblem(value: unknown): ProblemBody {
  if (!isRecord(value)) {
    return { detail: "The service returned an unreadable response." };
  }
  const fieldErrors = isRecord(value.fieldErrors)
    ? Object.fromEntries(
        Object.entries(value.fieldErrors).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      )
    : undefined;
  return {
    ...(typeof value.code === "string" ? { code: value.code } : {}),
    ...(typeof value.detail === "string" ? { detail: value.detail } : {}),
    ...(fieldErrors === undefined ? {} : { fieldErrors }),
  };
}

function readUser(value: unknown): AccountUser {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.username !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    throw malformedResponse();
  }
  return {
    id: value.id,
    username: value.username,
    createdAt: value.createdAt,
  };
}

function readSession(value: unknown): SessionSnapshot {
  if (
    !isRecord(value) ||
    typeof value.authenticated !== "boolean" ||
    typeof value.csrfToken !== "string"
  ) {
    throw malformedResponse();
  }
  if (value.authenticated) {
    return {
      authenticated: true,
      user: readUser(value.user),
      csrfToken: value.csrfToken,
    };
  }
  return {
    authenticated: false,
    csrfToken: value.csrfToken,
  };
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw malformedResponse();
  }
  return value;
}

function readServerResult(value: unknown): ServerResult {
  if (
    !isRecord(value) ||
    typeof value.clientResultId !== "string" ||
    (value.mode !== "TIME" && value.mode !== "WORDS") ||
    typeof value.punctuation !== "boolean" ||
    typeof value.numbers !== "boolean" ||
    typeof value.completedAt !== "string" ||
    !Array.isArray(value.paceBuckets)
  ) {
    throw malformedResponse();
  }
  const paceBuckets = value.paceBuckets.map((bucket) => {
    if (!isRecord(bucket)) {
      throw malformedResponse();
    }
    return {
      durationMs: readNumber(bucket, "durationMs"),
      typedCharacters: readNumber(bucket, "typedCharacters"),
    };
  });
  return {
    clientResultId: value.clientResultId,
    mode: value.mode,
    modeValue: readNumber(value, "modeValue"),
    punctuation: value.punctuation,
    numbers: value.numbers,
    durationMs: readNumber(value, "durationMs"),
    typedCharacters: readNumber(value, "typedCharacters"),
    correctAttempts: readNumber(value, "correctAttempts"),
    incorrectAttempts: readNumber(value, "incorrectAttempts"),
    correctCharacters: readNumber(value, "correctCharacters"),
    missingCharacters: readNumber(value, "missingCharacters"),
    extraAttempts: readNumber(value, "extraAttempts"),
    correctedErrors: readNumber(value, "correctedErrors"),
    wpm: readNumber(value, "wpm"),
    rawWpm: readNumber(value, "rawWpm"),
    accuracy: readNumber(value, "accuracy"),
    consistency: readNumber(value, "consistency"),
    paceBuckets,
    completedAt: value.completedAt,
    oldestResultsPruned: readNumber(value, "oldestResultsPruned"),
  };
}

async function parseProblem(response: Response): Promise<ProblemBody> {
  const fallback = {
    detail:
      response.status >= 500
        ? "The service is temporarily unavailable."
        : "The service rejected the request.",
  };
  if (!response.headers.get("Content-Type")?.toLowerCase().includes("json")) {
    return fallback;
  }
  try {
    return readProblem(await response.json());
  } catch {
    return fallback;
  }
}

async function request(
  path: string,
  init: RequestInit = {},
  retryCsrf = true,
): Promise<unknown> {
  const method = init.method?.toUpperCase() ?? "GET";
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    if (csrfToken === null) {
      await bootstrapSession();
    }
    if (csrfToken !== null) {
      headers.set("X-XSRF-TOKEN", csrfToken);
    }
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
    signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    const problem = await parseProblem(response);
    if (retryCsrf && response.status === 403 && problem.code === "CSRF_REJECTED") {
      csrfToken = null;
      await bootstrapSession();
      return request(path, init, false);
    }
    if (
      response.status === 401 &&
      path !== "/api/auth/login" &&
      path !== "/api/auth/register"
    ) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(response.status, problem);
  }
  if (response.status === 204) {
    return undefined;
  }
  return (await response.json()) as unknown;
}

async function performBootstrap(): Promise<SessionSnapshot> {
  const snapshot = readSession(await request("/api/auth/session", {}, false));
  csrfToken = snapshot.csrfToken;
  return snapshot;
}

export function bootstrapSession(): Promise<SessionSnapshot> {
  if (bootstrapInFlight === null) {
    const current = performBootstrap();
    bootstrapInFlight = current;
    void current.then(
      () => {
        if (bootstrapInFlight === current) {
          bootstrapInFlight = null;
        }
      },
      () => {
        if (bootstrapInFlight === current) {
          bootstrapInFlight = null;
        }
      },
    );
  }
  return bootstrapInFlight;
}

export async function register(
  username: string,
  password: string,
): Promise<SessionSnapshot> {
  const snapshot = readSession(
    await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  );
  csrfToken = snapshot.csrfToken;
  return snapshot;
}

export async function login(
  username: string,
  password: string,
): Promise<SessionSnapshot> {
  const snapshot = readSession(
    await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  );
  csrfToken = snapshot.csrfToken;
  return snapshot;
}

export async function logout(): Promise<void> {
  await request("/api/auth/logout", { method: "POST" });
  csrfToken = null;
}

export async function deleteAccount(password: string): Promise<void> {
  await request("/api/account", {
    method: "DELETE",
    body: JSON.stringify({ password }),
  });
  csrfToken = null;
}

export async function downloadAccountExport(): Promise<{
  blob: Blob;
  filename: string;
}> {
  const response = await fetch("/api/account/export", {
    credentials: "same-origin",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    const problem = await parseProblem(response);
    if (response.status === 401) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(response.status, problem);
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename =
    disposition.match(/filename="?([^";]+)"?/i)?.[1] ??
    "rill-account-export.json";
  return { blob: await response.blob(), filename };
}

function toServerPayload(result: TypingResult) {
  return {
    clientResultId: result.clientResultId,
    mode: result.mode.toUpperCase(),
    modeValue: result.modeValue,
    punctuation: result.punctuation,
    numbers: result.numbers,
    durationMs: result.durationMs,
    typedCharacters: result.typedCharacters,
    correctAttempts: result.correctAttempts,
    incorrectAttempts: result.incorrectAttempts,
    correctCharacters: result.correctCharacters,
    missingCharacters: result.missingCharacters,
    extraAttempts: result.extraAttempts,
    correctedErrors: result.correctedErrors,
    paceBuckets: result.paceBuckets,
  };
}

function fromServerResult(result: ServerResult): TypingResult {
  return {
    clientResultId: result.clientResultId,
    mode: result.mode.toLowerCase() as "time" | "words",
    modeValue: result.modeValue,
    punctuation: result.punctuation,
    numbers: result.numbers,
    durationMs: result.durationMs,
    typedCharacters: result.typedCharacters,
    correctAttempts: result.correctAttempts,
    incorrectAttempts: result.incorrectAttempts,
    correctCharacters: result.correctCharacters,
    missingCharacters: result.missingCharacters,
    extraAttempts: result.extraAttempts,
    correctedErrors: result.correctedErrors,
    wpm: result.wpm,
    rawWpm: result.rawWpm,
    accuracy: result.accuracy,
    consistency: result.consistency,
    paceBuckets: result.paceBuckets,
    completedAt: result.completedAt,
    completionReason: "finished",
  };
}

export async function saveAccountResult(result: TypingResult): Promise<TypingResult> {
  const saved = readServerResult(
    await request("/api/results", {
      method: "POST",
      body: JSON.stringify(toServerPayload(result)),
    }),
  );
  return fromServerResult(saved);
}

export async function loadAccountResults(
  cursor?: string,
  limit = 20,
): Promise<ResultPage> {
  const parameters = new URLSearchParams({ limit: String(limit) });
  if (cursor !== undefined) {
    parameters.set("cursor", cursor);
  }
  const value = await request(`/api/results?${parameters.toString()}`);
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    (value.nextCursor !== undefined && typeof value.nextCursor !== "string")
  ) {
    throw malformedResponse();
  }
  const page: ServerResultPage = {
    items: value.items.map(readServerResult),
    ...(value.nextCursor === undefined ? {} : { nextCursor: value.nextCursor }),
  };
  return {
    items: page.items.map(fromServerResult),
    ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
  };
}

export async function loadAccountSummary(): Promise<ResultSummary> {
  const value = await request("/api/results/summary");
  if (
    !isRecord(value) ||
    !Array.isArray(value.records)
  ) {
    throw malformedResponse();
  }
  const records = value.records.map((record): ResultRecord => {
    if (
      !isRecord(record) ||
      !isRecord(record.key) ||
      (record.key.mode !== "TIME" && record.key.mode !== "WORDS") ||
      typeof record.key.punctuation !== "boolean" ||
      typeof record.key.numbers !== "boolean"
    ) {
      throw malformedResponse();
    }
    return {
      key: {
        mode: record.key.mode.toLowerCase() as "time" | "words",
        modeValue: readNumber(record.key, "modeValue"),
        punctuation: record.key.punctuation,
        numbers: record.key.numbers,
      },
      result: fromServerResult(readServerResult(record.result)),
    };
  });
  return {
    totalRuns: readNumber(value, "totalRuns"),
    totalPracticeMs: readNumber(value, "totalPracticeMs"),
    highestWpm: readNumber(value, "highestWpm"),
    averageAccuracy: readNumber(value, "averageAccuracy"),
    records,
  };
}
