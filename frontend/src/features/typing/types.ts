export type TestMode = "time" | "words";
export type ContentType = "words" | "quote" | "custom" | "code";
export type ResultSaveStatus =
  | "idle"
  | "saved"
  | "queued"
  | "unavailable"
  | "too-short";
export type TypingLanguage = "en" | "es";
export type CodeLanguage =
  | "cpp"
  | "java"
  | "python3"
  | "c"
  | "csharp"
  | "javascript"
  | "typescript"
  | "go";
export type ErrorPolicy = "normal" | "strict";
export type WordListVersion =
  | "en-v1"
  | "es-v1"
  | "quote-v1"
  | "quote-v2"
  | "quote-v3"
  | "custom-v1"
  | "code-v1"
  | "code-v2"
  | "code-v3"
  | "code-v4";

export interface TestConfig {
  mode: TestMode;
  modeValue: number;
  punctuation: boolean;
  numbers: boolean;
  contentType: ContentType;
  language: TypingLanguage;
  codeLanguage?: CodeLanguage;
  errorPolicy: ErrorPolicy;
}

export interface Prompt {
  id: string;
  seed: number;
  wordListVersion: WordListVersion;
  generatorVersion: 1;
  language: TypingLanguage;
  codeLanguage?: CodeLanguage;
  sourceId?: string;
  title?: string;
  topic?: string;
  lesson?: string;
  assumptions?: string;
  complexity?: string;
  attribution?: string;
  sourceUrl?: string;
  theme?: string;
  words: readonly string[];
}

export interface PaceBucket {
  durationMs: number;
  /** Insertions in this interval. Used for burst speed and consistency. */
  typedCharacters: number;
  /** Cumulative fully-scored characters at the end of this interval. */
  correctCharacters: number;
  /** Cumulative retained characters at the end of this interval. */
  rawCharacters: number;
  /** Incorrect insertions in this interval. */
  errors: number;
}

export interface ResultCounters {
  typedCharacters: number;
  correctAttempts: number;
  incorrectAttempts: number;
  correctCharacters: number;
  incorrectCharacters: number;
  missingCharacters: number;
  extraAttempts: number;
  correctedErrors: number;
}

export interface TypingResult extends ResultCounters {
  clientResultId: string;
  mode: TestMode;
  modeValue: number;
  punctuation: boolean;
  numbers: boolean;
  contentType: ContentType;
  language: TypingLanguage;
  codeLanguage?: CodeLanguage;
  wordListVersion: WordListVersion;
  errorPolicy: ErrorPolicy;
  durationMs: number;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  paceBuckets: readonly PaceBucket[];
  completedAt: string;
  completionReason: "finished" | "time" | "limit" | "prompt-exhausted";
}

export interface TypingCounters {
  typedCharacters: number;
  correctAttempts: number;
  incorrectAttempts: number;
  missingCharacters: number;
  extraAttempts: number;
  correctedErrors: number;
  separatorCharacters: number;
}

export interface TypingInputEvent {
  elapsedMs: number;
  wordIndex: number;
  type: "insert" | "delete";
  grapheme: string;
  correct: boolean;
}

export interface TypingState {
  runId: string;
  status: "ready" | "running" | "completed";
  config: TestConfig;
  prompt: Prompt;
  wordIndex: number;
  committedWords: readonly (readonly string[])[];
  currentInput: readonly string[];
  startedAt: number | null;
  deadline: number | null;
  completedAt: number | null;
  counters: TypingCounters;
  inputEvents: readonly TypingInputEvent[];
  result: TypingResult | null;
}

export type TypingAction =
  | { type: "insert"; grapheme: string; now: number; wallNow: number }
  | {
      type: "insertBatch";
      graphemes: readonly string[];
      now: number;
      wallNow: number;
    }
  | { type: "start"; now: number }
  | { type: "backspace"; now: number; wallNow: number }
  | { type: "deleteWordBackward"; now: number; wallNow: number }
  | { type: "tick"; now: number; wallNow: number }
  | { type: "extendPrompt"; prompt: Prompt }
  | { type: "restart"; runId: string; prompt: Prompt; config: TestConfig };

export const TIME_VALUES = [15, 30, 60] as const;
export const WORD_VALUES = [10, 25, 50] as const;
export const WORD_TEST_LIMIT_MS = 600_000;
