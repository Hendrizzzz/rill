export type TestMode = "time" | "words";

export interface TestConfig {
  mode: TestMode;
  modeValue: 10 | 15 | 25 | 30 | 50 | 60;
  punctuation: boolean;
  numbers: boolean;
}

export interface Prompt {
  id: string;
  seed: number;
  wordListVersion: "en-v1";
  generatorVersion: 1;
  words: readonly string[];
}

export interface PaceBucket {
  durationMs: number;
  typedCharacters: number;
}

export interface ResultCounters {
  typedCharacters: number;
  correctAttempts: number;
  incorrectAttempts: number;
  correctCharacters: number;
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
  paceCounts: readonly number[];
  result: TypingResult | null;
}

export type TypingAction =
  | { type: "insert"; grapheme: string; now: number; wallNow: number }
  | { type: "backspace"; now: number; wallNow: number }
  | { type: "tick"; now: number; wallNow: number }
  | { type: "extendPrompt"; prompt: Prompt }
  | { type: "restart"; runId: string; prompt: Prompt; config: TestConfig };

export const TIME_VALUES = [15, 30, 60] as const;
export const WORD_VALUES = [10, 25, 50] as const;
export const WORD_TEST_LIMIT_MS = 600_000;
