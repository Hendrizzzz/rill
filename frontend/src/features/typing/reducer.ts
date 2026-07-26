import { buildPaceBuckets, calculateMetrics } from "./scoring";
import {
  WORD_TEST_LIMIT_MS,
  type Prompt,
  type ResultCounters,
  type TestConfig,
  type TypingAction,
  type TypingCounters,
  type TypingResult,
  type TypingState,
} from "./types";

const EMPTY_COUNTERS: TypingCounters = {
  typedCharacters: 0,
  correctAttempts: 0,
  incorrectAttempts: 0,
  missingCharacters: 0,
  extraAttempts: 0,
  correctedErrors: 0,
  separatorCharacters: 0,
};

export function createTypingState(
  config: TestConfig,
  prompt: Prompt,
  runId: string,
): TypingState {
  return {
    runId,
    status: "ready",
    config,
    prompt,
    wordIndex: 0,
    committedWords: [],
    currentInput: [],
    startedAt: null,
    deadline: null,
    completedAt: null,
    counters: EMPTY_COUNTERS,
    paceCounts: [],
    result: null,
  };
}

function currentTarget(state: TypingState): string {
  return state.prompt.words[state.wordIndex] ?? "";
}

function recordPace(
  paceCounts: readonly number[],
  startedAt: number,
  now: number,
): number[] {
  const elapsed = Math.max(0, now - startedAt);
  const bucketIndex = Math.max(0, Math.ceil(elapsed / 1_000) - 1);
  const next = [...paceCounts];
  while (next.length <= bucketIndex) {
    next.push(0);
  }
  next[bucketIndex] = (next[bucketIndex] ?? 0) + 1;
  return next;
}

function startIfReady(state: TypingState, now: number): TypingState {
  if (state.status !== "ready") {
    return state;
  }
  return {
    ...state,
    status: "running",
    startedAt: now,
    deadline:
      state.config.mode === "time"
        ? now + state.config.modeValue * 1_000
        : now + WORD_TEST_LIMIT_MS,
  };
}

function countAlignedCharacters(state: TypingState): number {
  let correct = state.counters.separatorCharacters;
  state.committedWords.forEach((input, wordIndex) => {
    const target = state.prompt.words[wordIndex] ?? "";
    input.forEach((grapheme, index) => {
      if (target[index] === grapheme) {
        correct += 1;
      }
    });
  });

  const target = currentTarget(state);
  state.currentInput.forEach((grapheme, index) => {
    if (target[index] === grapheme) {
      correct += 1;
    }
  });
  return correct;
}

function complete(
  state: TypingState,
  at: number,
  wallNow: number,
  reason: TypingResult["completionReason"],
): TypingState {
  if (state.status === "completed" || state.startedAt === null) {
    return state;
  }

  const durationMs =
    state.config.mode === "time" && reason === "time"
      ? state.config.modeValue * 1_000
      : Math.max(1, Math.round(at - state.startedAt));
  const completedAt = state.startedAt + durationMs;
  const paceBuckets = buildPaceBuckets(durationMs, state.paceCounts);
  const resultCounters: ResultCounters = {
    typedCharacters: state.counters.typedCharacters,
    correctAttempts: state.counters.correctAttempts,
    incorrectAttempts: state.counters.incorrectAttempts,
    correctCharacters: countAlignedCharacters(state),
    missingCharacters: state.counters.missingCharacters,
    extraAttempts: state.counters.extraAttempts,
    correctedErrors: state.counters.correctedErrors,
  };
  const metrics = calculateMetrics(durationMs, resultCounters, paceBuckets);
  const result: TypingResult = {
    clientResultId: state.runId,
    mode: state.config.mode,
    modeValue: state.config.modeValue,
    punctuation: state.config.punctuation,
    numbers: state.config.numbers,
    durationMs,
    ...resultCounters,
    ...metrics,
    paceBuckets,
    completedAt: new Date(wallNow).toISOString(),
    completionReason: reason,
  };

  return {
    ...state,
    status: "completed",
    completedAt,
    result,
  };
}

function completeIfExpired(
  state: TypingState,
  now: number,
  wallNow: number,
): TypingState {
  if (
    state.status === "running" &&
    state.deadline !== null &&
    now >= state.deadline
  ) {
    return complete(
      state,
      state.deadline,
      wallNow,
      state.config.mode === "time" ? "time" : "limit",
    );
  }
  return state;
}

function commitWord(
  state: TypingState,
  now: number,
  wallNow: number,
): TypingState {
  if (state.currentInput.length === 0) {
    return state;
  }

  const target = currentTarget(state);
  const missing = Math.max(0, target.length - state.currentInput.length);
  const isFinalWord =
    state.config.mode === "words" &&
    state.wordIndex === state.prompt.words.length - 1;

  if (isFinalWord) {
    const committed = {
      ...state,
      committedWords: [...state.committedWords, state.currentInput],
      currentInput: [],
      counters: {
        ...state.counters,
        missingCharacters: state.counters.missingCharacters + missing,
      },
    };
    return complete(committed, now, wallNow, "finished");
  }

  if (state.wordIndex >= state.prompt.words.length - 1) {
    return complete(state, now, wallNow, "prompt-exhausted");
  }

  const startedAt = state.startedAt ?? now;
  return {
    ...state,
    committedWords: [...state.committedWords, state.currentInput],
    currentInput: [],
    wordIndex: state.wordIndex + 1,
    counters: {
      ...state.counters,
      typedCharacters: state.counters.typedCharacters + 1,
      correctAttempts: state.counters.correctAttempts + 1,
      missingCharacters: state.counters.missingCharacters + missing,
      separatorCharacters: state.counters.separatorCharacters + 1,
    },
    paceCounts: recordPace(state.paceCounts, startedAt, now),
  };
}

function insertGrapheme(
  original: TypingState,
  grapheme: string,
  now: number,
  wallNow: number,
): TypingState {
  if (original.status === "completed" || grapheme.length === 0) {
    return original;
  }

  const expired = completeIfExpired(original, now, wallNow);
  if (expired.status === "completed") {
    return expired;
  }

  if (grapheme === " ") {
    return commitWord(expired, now, wallNow);
  }

  const state = startIfReady(expired, now);
  const target = currentTarget(state);
  const index = state.currentInput.length;
  const isCorrect = target[index] === grapheme;
  const isExtra = index >= target.length;
  const startedAt = state.startedAt ?? now;
  const next: TypingState = {
    ...state,
    currentInput: [...state.currentInput, grapheme],
    counters: {
      ...state.counters,
      typedCharacters: state.counters.typedCharacters + 1,
      correctAttempts: state.counters.correctAttempts + (isCorrect ? 1 : 0),
      incorrectAttempts:
        state.counters.incorrectAttempts + (isCorrect ? 0 : 1),
      extraAttempts: state.counters.extraAttempts + (isExtra ? 1 : 0),
    },
    paceCounts: recordPace(state.paceCounts, startedAt, now),
  };

  const isExactFinalWord =
    next.config.mode === "words" &&
    next.wordIndex === next.prompt.words.length - 1 &&
    next.currentInput.join("") === target;
  return isExactFinalWord ? complete(next, now, wallNow, "finished") : next;
}

function backspace(
  original: TypingState,
  now: number,
  wallNow: number,
): TypingState {
  if (original.status !== "running") {
    return original;
  }

  const state = completeIfExpired(original, now, wallNow);
  if (state.status === "completed") {
    return state;
  }

  if (state.currentInput.length === 0) {
    const previousWordIndex = state.wordIndex - 1;
    const previousInput = state.committedWords.at(-1);
    const previousTarget = state.prompt.words[previousWordIndex];
    if (
      previousWordIndex < 0 ||
      previousInput === undefined ||
      previousTarget === undefined ||
      previousInput.join("") === previousTarget
    ) {
      return state;
    }

    const previousMissing = Math.max(
      0,
      previousTarget.length - previousInput.length,
    );
    return {
      ...state,
      wordIndex: previousWordIndex,
      committedWords: state.committedWords.slice(0, -1),
      currentInput: previousInput,
      counters: {
        ...state.counters,
        missingCharacters: Math.max(
          0,
          state.counters.missingCharacters - previousMissing,
        ),
        separatorCharacters: Math.max(
          0,
          state.counters.separatorCharacters - 1,
        ),
      },
    };
  }

  const index = state.currentInput.length - 1;
  const grapheme = state.currentInput[index] ?? "";
  const target = currentTarget(state);
  const corrected = index >= target.length || target[index] !== grapheme;

  return {
    ...state,
    currentInput: state.currentInput.slice(0, -1),
    counters: {
      ...state.counters,
      correctedErrors:
        state.counters.correctedErrors + (corrected ? 1 : 0),
    },
  };
}

export function typingReducer(
  state: TypingState,
  action: TypingAction,
): TypingState {
  switch (action.type) {
    case "insert":
      return insertGrapheme(
        state,
        action.grapheme,
        action.now,
        action.wallNow,
      );
    case "backspace":
      return backspace(state, action.now, action.wallNow);
    case "tick":
      return completeIfExpired(state, action.now, action.wallNow);
    case "extendPrompt":
      return action.prompt.id === state.prompt.id &&
        action.prompt.words.length > state.prompt.words.length
        ? { ...state, prompt: action.prompt }
        : state;
    case "restart":
      return createTypingState(action.config, action.prompt, action.runId);
  }
}
