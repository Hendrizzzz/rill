import {
  buildPaceBuckets,
  countCharacters,
  normalizeEventElapsedMs,
  normalizeTestDurationMs,
} from "./resultStats";
import {
  normalizeGraphemeForTarget,
  segmentGraphemes,
} from "./inputAdapter";
import { calculateMetrics } from "./scoring";
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
import { typableTarget } from "./targetText";

const EMPTY_COUNTERS: TypingCounters = {
  typedCharacters: 0,
  correctAttempts: 0,
  incorrectAttempts: 0,
  missingCharacters: 0,
  extraAttempts: 0,
  correctedErrors: 0,
  separatorCharacters: 0,
};
const MAX_EXTRA_GRAPHEMES = 21;

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
    inputEvents: [],
    result: null,
  };
}

function currentTarget(state: TypingState): string {
  return typableTarget(
    state.prompt.words[state.wordIndex] ?? "",
    state.config.contentType,
  );
}

function currentTargetCharacters(state: TypingState): string[] {
  return segmentGraphemes(currentTarget(state), state.prompt.language);
}

function targetSeparator(state: TypingState): " " | "\n" {
  return state.config.contentType === "code" ? "\n" : " ";
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

function complete(
  state: TypingState,
  at: number,
  wallNow: number,
  reason: TypingResult["completionReason"],
): TypingState {
  if (state.status === "completed" || state.startedAt === null) {
    return state;
  }

  const rawDurationMs =
    state.config.mode === "time" && reason === "time"
      ? state.config.modeValue * 1_000
      : normalizeEventElapsedMs(at - state.startedAt);
  const durationMs =
    state.config.mode === "time" && reason === "time"
      ? rawDurationMs
      : Math.max(1, normalizeTestDurationMs(rawDurationMs));
  const completedAt = state.startedAt + rawDurationMs;
  const paceBuckets = buildPaceBuckets(
    durationMs,
    state.inputEvents,
    state.prompt,
    state.config,
    rawDurationMs,
  );
  const characterStats = countCharacters(
    state.inputEvents,
    state.prompt,
    state.config,
    state.config.mode === "time" || reason === "limit",
  );
  const resultCounters: ResultCounters = {
    typedCharacters:
      characterStats.allCorrect +
      characterStats.incorrect +
      characterStats.extra,
    correctAttempts: state.counters.correctAttempts,
    incorrectAttempts: state.counters.incorrectAttempts,
    correctCharacters: characterStats.correctWord,
    incorrectCharacters: characterStats.incorrect,
    missingCharacters: characterStats.missed,
    extraAttempts: characterStats.extra,
    correctedErrors: state.counters.correctedErrors,
  };
  const metrics = calculateMetrics(durationMs, resultCounters, paceBuckets);
  const result: TypingResult = {
    clientResultId: state.runId,
    mode: state.config.mode,
    modeValue: state.config.modeValue,
    punctuation: state.config.punctuation,
    numbers: state.config.numbers,
    contentType: state.config.contentType,
    language: state.config.language,
    wordListVersion: state.prompt.wordListVersion,
    ...(state.config.contentType === "code"
      ? { codeLanguage: state.config.codeLanguage ?? "python3" }
      : {}),
    errorPolicy: state.config.errorPolicy,
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

  const targetCharacters = currentTargetCharacters(state);
  const missing = Math.max(
    0,
    targetCharacters.length - state.currentInput.length,
  );
  const isFinalWord =
    state.config.mode === "words" &&
    state.wordIndex === state.prompt.words.length - 1;

  const startedAt = state.startedAt ?? now;
  const strictFailureActive =
    state.config.errorPolicy === "strict" &&
    state.counters.incorrectAttempts > 0;
  const spaceIsCorrect =
    !strictFailureActive &&
    state.currentInput.length === targetCharacters.length;
  const withSpaceEvent = {
    ...state,
    counters: {
      ...state.counters,
      typedCharacters: state.counters.typedCharacters + 1,
      correctAttempts:
        state.counters.correctAttempts + (spaceIsCorrect ? 1 : 0),
      incorrectAttempts:
        state.counters.incorrectAttempts + (spaceIsCorrect ? 0 : 1),
    },
    inputEvents: [
      ...state.inputEvents,
      {
        elapsedMs: normalizeEventElapsedMs(now - startedAt),
        wordIndex: state.wordIndex,
        type: "insert" as const,
        grapheme: targetSeparator(state),
        correct: spaceIsCorrect,
      },
    ],
  };

  if (isFinalWord) {
    const committed = {
      ...withSpaceEvent,
      committedWords: [...state.committedWords, state.currentInput],
      currentInput: [],
      counters: {
        ...withSpaceEvent.counters,
        missingCharacters: state.counters.missingCharacters + missing,
      },
    };
    return complete(committed, now, wallNow, "finished");
  }

  if (state.wordIndex >= state.prompt.words.length - 1) {
    return complete(state, now, wallNow, "prompt-exhausted");
  }

  return {
    ...withSpaceEvent,
    committedWords: [...state.committedWords, state.currentInput],
    currentInput: [],
    wordIndex: state.wordIndex + 1,
    counters: {
      ...withSpaceEvent.counters,
      missingCharacters: state.counters.missingCharacters + missing,
      separatorCharacters: state.counters.separatorCharacters + 1,
    },
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

  const currentIndex = expired.currentInput.length;
  if (
    grapheme === "\u2026" &&
    currentTargetCharacters(expired)[currentIndex] !== "\u2026"
  ) {
    return [".", ".", "."].reduce(
      (state, period) => insertGrapheme(state, period, now, wallNow),
      expired,
    );
  }

  if (grapheme === targetSeparator(expired)) {
    return commitWord(expired, now, wallNow);
  }

  const state = startIfReady(expired, now);
  const target = currentTarget(state);
  const targetCharacters = currentTargetCharacters(state);
  const index = state.currentInput.length;
  if (index >= targetCharacters.length + MAX_EXTRA_GRAPHEMES) {
    return state;
  }
  const normalizedGrapheme = normalizeGraphemeForTarget(
    grapheme,
    targetCharacters[index],
  );
  const strictFailureActive =
    state.config.errorPolicy === "strict" &&
    state.counters.incorrectAttempts > 0;
  const isCorrect =
    !strictFailureActive &&
    targetCharacters[index] === normalizedGrapheme;
  const isExtra = index >= targetCharacters.length;
  const startedAt = state.startedAt ?? now;
  const next: TypingState = {
    ...state,
    currentInput: [...state.currentInput, normalizedGrapheme],
    counters: {
      ...state.counters,
      typedCharacters: state.counters.typedCharacters + 1,
      correctAttempts: state.counters.correctAttempts + (isCorrect ? 1 : 0),
      incorrectAttempts:
        state.counters.incorrectAttempts + (isCorrect ? 0 : 1),
      extraAttempts: state.counters.extraAttempts + (isExtra ? 1 : 0),
    },
    inputEvents: [
      ...state.inputEvents,
      {
        elapsedMs: normalizeEventElapsedMs(now - startedAt),
        wordIndex: state.wordIndex,
        type: "insert",
        grapheme: normalizedGrapheme,
        correct: isCorrect,
      },
    ],
  };

  const isExactFinalWord =
    next.config.mode === "words" &&
    next.wordIndex === next.prompt.words.length - 1 &&
    next.currentInput.join("") === target;
  return isExactFinalWord ? complete(next, now, wallNow, "finished") : next;
}

function insertBatch(
  original: TypingState,
  graphemes: readonly string[],
  now: number,
  wallNow: number,
): TypingState {
  return graphemes.reduce(
    (state, grapheme) => insertGrapheme(state, grapheme, now, wallNow),
    original,
  );
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
    const previousSourceTarget = state.prompt.words[previousWordIndex];
    if (
      previousWordIndex < 0 ||
      previousInput === undefined ||
      previousSourceTarget === undefined
    ) {
      return state;
    }
    const previousTarget = typableTarget(
      previousSourceTarget,
      state.config.contentType,
    );
    if (previousInput.join("") === previousTarget) {
      return state;
    }

    const previousTargetCharacters = segmentGraphemes(
      previousTarget,
      state.prompt.language,
    );
    const previousMissing = Math.max(
      0,
      previousTargetCharacters.length - previousInput.length,
    );
    const correctedSeparator =
      previousInput.length !== previousTargetCharacters.length;
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
        correctedErrors:
          state.counters.correctedErrors + (correctedSeparator ? 1 : 0),
      },
      inputEvents: [
        ...state.inputEvents,
        {
          elapsedMs: normalizeEventElapsedMs(
            now - (state.startedAt ?? now),
          ),
          wordIndex: previousWordIndex,
          type: "delete",
          grapheme: targetSeparator(state),
          correct: !correctedSeparator,
        },
      ],
    };
  }

  const index = state.currentInput.length - 1;
  const grapheme = state.currentInput[index] ?? "";
  const target = currentTargetCharacters(state);
  const corrected = index >= target.length || target[index] !== grapheme;

  return {
    ...state,
    currentInput: state.currentInput.slice(0, -1),
    counters: {
      ...state.counters,
      correctedErrors:
        state.counters.correctedErrors + (corrected ? 1 : 0),
    },
    inputEvents: [
      ...state.inputEvents,
      {
        elapsedMs: normalizeEventElapsedMs(now - (state.startedAt ?? now)),
        wordIndex: state.wordIndex,
        type: "delete",
        grapheme,
        correct: corrected,
      },
    ],
  };
}

function deleteWordBackward(
  original: TypingState,
  now: number,
  wallNow: number,
): TypingState {
  if (original.status !== "running") {
    return original;
  }

  let state = original;
  if (state.currentInput.length === 0) {
    const previous = backspace(state, now, wallNow);
    if (previous === state) {
      return state;
    }
    state = previous;
  }

  if (state.config.contentType === "code") {
    while (
      state.status === "running" &&
      state.currentInput.at(-1) === " "
    ) {
      state = backspace(state, now, wallNow);
    }

    const lastGrapheme = state.currentInput.at(-1);
    if (lastGrapheme === undefined) {
      return state;
    }
    const tokenClass = /[\p{L}\p{N}_]/u.test(lastGrapheme)
      ? "identifier"
      : "symbol";
    while (state.status === "running" && state.currentInput.length > 0) {
      const grapheme = state.currentInput.at(-1) ?? "";
      const currentClass = /[\p{L}\p{N}_]/u.test(grapheme)
        ? "identifier"
        : grapheme === " "
          ? "space"
          : "symbol";
      if (currentClass !== tokenClass) {
        break;
      }
      state = backspace(state, now, wallNow);
    }
    return state;
  }

  while (state.status === "running" && state.currentInput.length > 0) {
    state = backspace(state, now, wallNow);
  }
  return state;
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
    case "insertBatch":
      return insertBatch(
        state,
        action.graphemes,
        action.now,
        action.wallNow,
      );
    case "start":
      return startIfReady(state, action.now);
    case "backspace":
      return backspace(state, action.now, action.wallNow);
    case "deleteWordBackward":
      return deleteWordBackward(state, action.now, action.wallNow);
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
