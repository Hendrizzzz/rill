import { describe, expect, it } from "vitest";
import { createTypingState, typingReducer } from "./reducer";
import { WORD_TEST_LIMIT_MS } from "./types";
import {
  buildPaceBuckets,
  countCharacters,
  countWordCharacters,
} from "./resultStats";
import { calculateMetrics } from "./scoring";
import type {
  PaceBucket,
  Prompt,
  ResultCounters,
  TestConfig,
  TypingAction,
  TypingCounters,
  TypingInputEvent,
  TypingState,
} from "./types";

/**
 * Independent Rill reference model.
 *
 * The formulas were cross-checked against the official
 * Monkeytype repository at commit
 * 7feea96c5df21a59af9553fa7c52eb33af5997b8:
 * - frontend/src/ts/test/events/stats.ts
 * - frontend/src/ts/test/test-logic.ts
 * - packages/util/src/numbers.ts
 *
 * The model deliberately does not import Rill reducer/scoring helpers. It is
 * not executed Monkeytype code and is not presented as an MT-ENGINE oracle.
 */

const WORD_CONFIG: TestConfig = {
  mode: "words",
  modeValue: 10,
  punctuation: false,
  numbers: false,
  contentType: "words",
  language: "en",
  errorPolicy: "normal",
};

const TIME_CONFIG: TestConfig = {
  mode: "time",
  modeValue: 15,
  punctuation: false,
  numbers: false,
  contentType: "words",
  language: "en",
  errorPolicy: "normal",
};

const PROMPT: Prompt = {
  id: "parity-prompt",
  seed: 1,
  wordListVersion: "en-v1",
  generatorVersion: 1,
  language: "en",
  words: ["a", "ill", "www", "can't", "co-op", "a1b2", "end"],
};

interface OracleCharacterStats {
  allCorrect: number;
  correctWord: number;
  incorrect: number;
  extra: number;
  missed: number;
}

function emptyStats(): OracleCharacterStats {
  return {
    allCorrect: 0,
    correctWord: 0,
    incorrect: 0,
    extra: 0,
    missed: 0,
  };
}

function oracleCountWord(
  inputWord: string,
  targetWord: string,
  creditPartial: boolean,
): OracleCharacterStats {
  const result = emptyStats();
  const input = Array.from(inputWord);
  const target = Array.from(targetWord);
  const isWholeWord =
    input.length === target.length &&
    target.every((character, index) => input[index] === character);
  const isCorrectPrefix =
    input.length <= target.length &&
    input.every((character, index) => target[index] === character);

  for (let index = 0; index < Math.max(input.length, target.length); index += 1) {
    const actual = input[index];
    const expected = target[index];
    if (actual === expected) {
      if (expected === " " && !isWholeWord) {
        result.extra += 1;
      } else {
        result.allCorrect += 1;
      }
      if (isWholeWord || (creditPartial && isCorrectPrefix)) {
        result.correctWord += 1;
      }
    } else if (actual === undefined) {
      if (!creditPartial) result.missed += 1;
    } else if (
      expected === undefined ||
      (expected === " " && actual !== " " && !input.includes(" "))
    ) {
      result.extra += 1;
    } else {
      result.incorrect += 1;
    }
  }
  return result;
}

function replay(
  events: readonly TypingInputEvent[],
): Map<number, string[]> {
  const inputs = new Map<number, string[]>();
  for (const event of events) {
    const word = inputs.get(event.wordIndex) ?? [];
    if (event.type === "insert") {
      word.push(event.grapheme);
    } else {
      word.pop();
    }
    inputs.set(event.wordIndex, word);
  }
  return inputs;
}

function oracleActiveWord(
  events: readonly TypingInputEvent[],
  inputs: ReadonlyMap<number, readonly string[]>,
  prompt: Prompt,
  config: TestConfig,
): number {
  const last = events.at(-1);
  if (last === undefined) return 0;
  const input = inputs.get(last.wordIndex) ?? [];
  const finalWord =
    config.mode === "words" && last.wordIndex === prompt.words.length - 1;
  return !finalWord && input.at(-1) === " "
    ? last.wordIndex + 1
    : last.wordIndex;
}

function oracleCountCharacters(
  events: readonly TypingInputEvent[],
  prompt: Prompt,
  config: TestConfig,
  creditPartialLastWord: boolean,
): OracleCharacterStats {
  const inputs = replay(events);
  const lastWordIndex = oracleActiveWord(events, inputs, prompt, config);
  const result = emptyStats();
  for (let wordIndex = 0; wordIndex <= lastWordIndex; wordIndex += 1) {
    const isFinal =
      config.mode === "words" && wordIndex === prompt.words.length - 1;
    const target = `${prompt.words[wordIndex] ?? ""}${isFinal ? "" : " "}`;
    const wordStats = oracleCountWord(
      (inputs.get(wordIndex) ?? []).join(""),
      target,
      wordIndex === lastWordIndex && creditPartialLastWord,
    );
    result.allCorrect += wordStats.allCorrect;
    result.correctWord += wordStats.correctWord;
    result.incorrect += wordStats.incorrect;
    result.extra += wordStats.extra;
    result.missed += wordStats.missed;
  }
  return result;
}

function oracleBoundaries(
  durationMs: number,
  mode: TestConfig["mode"],
  graphEndMs = durationMs,
): number[] {
  const fullSeconds = Math.floor(graphEndMs / 1_000);
  const result = Array.from(
    { length: fullSeconds },
    (_, index) => (index + 1) * 1_000,
  );
  const roundedSeconds =
    Math.round((graphEndMs / 1_000 + Number.EPSILON) * 100) / 100;
  const roundedIntoNextWholeSecond =
    mode === "words" &&
    durationMs > graphEndMs &&
    durationMs % 1_000 === 0 &&
    durationMs - graphEndMs <= 5;
  if (roundedIntoNextWholeSecond) {
    result.push(durationMs);
  } else if (
    mode === "words" &&
    Math.round(roundedSeconds % 1) >= 0.5
  ) {
    result.push(graphEndMs);
  }
  return result;
}

function oracleBuckets(
  durationMs: number,
  events: readonly TypingInputEvent[],
  prompt: Prompt,
  config: TestConfig,
  graphEndMs: number,
): PaceBucket[] {
  const result: PaceBucket[] = [];
  let consumed = 0;
  let previous = 0;
  for (const boundary of oracleBoundaries(
    durationMs,
    config.mode,
    graphEndMs,
  )) {
    const start = consumed;
    while (
      consumed < events.length &&
      (events[consumed]?.elapsedMs ?? Number.POSITIVE_INFINITY) <= boundary
    ) {
      consumed += 1;
    }
    const interval = events.slice(start, consumed);
    const retained = oracleCountCharacters(
      events.slice(0, consumed),
      prompt,
      config,
      true,
    );
    result.push({
      durationMs: boundary - previous,
      typedCharacters: interval.filter((event) => event.type === "insert")
        .length,
      correctCharacters: retained.correctWord,
      rawCharacters:
        retained.allCorrect + retained.incorrect + retained.extra,
      errors: interval.filter(
        (event) => event.type === "insert" && !event.correct,
      ).length,
    });
    previous = boundary;
  }
  return result;
}

function roundPositiveRational(
  numerator: bigint,
  denominator: bigint,
): number {
  const hundredths =
    (numerator * 100n * 2n + denominator) / (denominator * 2n);
  return Number(hundredths) / 100;
}

function oracleConsistency(buckets: readonly PaceBucket[]): number {
  const burst = buckets.map((bucket) =>
    Math.round(
      bucket.typedCharacters /
        5 /
        (bucket.durationMs / 1_000 / 60),
    ),
  );
  if (burst.length === 0) return 0;
  const average = burst.reduce((sum, value) => sum + value, 0) / burst.length;
  if (average === 0) return 0;
  const variance =
    burst.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    burst.length;
  const cov = Math.sqrt(variance) / average;
  const raw =
    100 * (1 - Math.tanh(cov + cov ** 3 / 3 + cov ** 5 / 5));
  return Math.round((raw + Number.EPSILON) * 100) / 100;
}

function oracleMetrics(
  durationMs: number,
  counters: ResultCounters,
  buckets: readonly PaceBucket[],
): ReturnType<typeof calculateMetrics> {
  const durationSeconds = Math.max(1, durationMs) / 1_000;
  const attempts = counters.correctAttempts + counters.incorrectAttempts;
  return {
    wpm:
      Math.round(
        (counters.correctCharacters / 5 / (durationSeconds / 60) +
          Number.EPSILON) *
          100,
      ) / 100,
    rawWpm:
      Math.round(
        (counters.typedCharacters / 5 / (durationSeconds / 60) +
          Number.EPSILON) *
          100,
      ) / 100,
    accuracy:
      attempts === 0
        ? 100
        : roundPositiveRational(
            BigInt(counters.correctAttempts) * 100n,
            BigInt(attempts),
          ),
    consistency: oracleConsistency(buckets),
  };
}

function seededRandom(seed: number): () => number {
  let value = seed | 0;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 0x1_0000_0000;
  };
}

function randomInt(random: () => number, maxExclusive: number): number {
  return Math.floor(random() * maxExclusive);
}

function buildRandomEvents(
  seed: number,
  count: number,
): TypingInputEvent[] {
  const random = seededRandom(seed);
  const retained = new Map<number, string[]>();
  const events: TypingInputEvent[] = [];
  let wordIndex = 0;
  let elapsedMs = 0;
  const alphabet = ["a", "b", "i", "l", "w", "'", "-", "1", "2", "é"];

  for (let index = 0; index < count; index += 1) {
    elapsedMs += randomInt(random, 1_100);
    const input = retained.get(wordIndex) ?? [];
    const deleteEvent = input.length > 0 && random() < 0.22;
    if (deleteEvent) {
      const grapheme = input.pop() ?? "";
      retained.set(wordIndex, input);
      events.push({
        elapsedMs,
        wordIndex,
        type: "delete",
        grapheme,
        correct: false,
      });
      continue;
    }

    const advance = input.length > 0 && wordIndex < PROMPT.words.length - 2 &&
      random() < 0.18;
    const grapheme = advance
      ? " "
      : (alphabet[randomInt(random, alphabet.length)] ?? "a");
    const target = `${PROMPT.words[wordIndex] ?? ""} `;
    const correct = target[Array.from(input.join("")).length] === grapheme;
    input.push(grapheme);
    retained.set(wordIndex, input);
    events.push({
      elapsedMs,
      wordIndex,
      type: "insert",
      grapheme,
      correct,
    });
    if (advance) wordIndex += 1;
  }
  return events;
}

interface ReferenceState {
  status: TypingState["status"];
  wordIndex: number;
  committedWords: readonly (readonly string[])[];
  currentInput: readonly string[];
  startedAt: number | null;
  deadline: number | null;
  counters: TypingCounters;
}

function referenceState(): ReferenceState {
  return {
    status: "ready",
    wordIndex: 0,
    committedWords: [],
    currentInput: [],
    startedAt: null,
    deadline: null,
    counters: {
      typedCharacters: 0,
      correctAttempts: 0,
      incorrectAttempts: 0,
      missingCharacters: 0,
      extraAttempts: 0,
      correctedErrors: 0,
      separatorCharacters: 0,
    },
  };
}

function referenceStep(
  state: ReferenceState,
  action: TypingAction,
  config: TestConfig,
  prompt: Prompt,
): ReferenceState {
  if (action.type === "restart") return referenceState();
  if (action.type === "extendPrompt") return state;
  const now = action.now;
  if (
    state.status === "running" &&
    state.deadline !== null &&
    now >= state.deadline
  ) {
    return { ...state, status: "completed" };
  }
  if (action.type === "tick" || state.status === "completed") return state;

  if (action.type === "start") {
    return state.status === "ready"
      ? {
          ...state,
          status: "running",
          startedAt: action.now,
          deadline:
            action.now +
            (config.mode === "time"
              ? config.modeValue * 1_000
              : WORD_TEST_LIMIT_MS),
        }
      : state;
  }

  if (action.type === "insertBatch") {
    return action.graphemes.reduce(
      (next, grapheme) =>
        referenceStep(
          next,
          {
            type: "insert",
            grapheme,
            now: action.now,
            wallNow: action.wallNow,
          },
          config,
          prompt,
        ),
      state,
    );
  }

  if (action.type === "deleteWordBackward") {
    if (state.status !== "running") return state;
    let next = state;
    if (next.currentInput.length === 0) {
      next = referenceStep(
        next,
        {
          type: "backspace",
          now: action.now,
          wallNow: action.wallNow,
        },
        config,
        prompt,
      );
      if (next === state) return state;
    }
    while (next.currentInput.length > 0) {
      next = referenceStep(
        next,
        {
          type: "backspace",
          now: action.now,
          wallNow: action.wallNow,
        },
        config,
        prompt,
      );
    }
    return next;
  }

  if (action.type === "backspace") {
    if (state.status !== "running") return state;
    if (state.currentInput.length === 0) {
      const priorIndex = state.wordIndex - 1;
      const priorInput = state.committedWords.at(-1);
      const priorTarget = prompt.words[priorIndex];
      if (
        priorIndex < 0 ||
        priorInput === undefined ||
        priorTarget === undefined ||
        priorInput.join("") === priorTarget
      ) {
        return state;
      }
      return {
        ...state,
        wordIndex: priorIndex,
        committedWords: state.committedWords.slice(0, -1),
        currentInput: priorInput,
        counters: {
          ...state.counters,
          missingCharacters: Math.max(
            0,
            state.counters.missingCharacters -
              Math.max(0, priorTarget.length - priorInput.length),
          ),
          separatorCharacters: Math.max(
            0,
            state.counters.separatorCharacters - 1,
          ),
          correctedErrors:
            state.counters.correctedErrors +
            (priorInput.length === priorTarget.length ? 0 : 1),
        },
      };
    }
    const index = state.currentInput.length - 1;
    const target = prompt.words[state.wordIndex] ?? "";
    const corrected =
      index >= target.length || target[index] !== state.currentInput[index];
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

  const grapheme = action.grapheme;
  if (grapheme.length === 0) return state;
  if (grapheme === " ") {
    if (state.currentInput.length === 0) return state;
    const target = prompt.words[state.wordIndex] ?? "";
    const finalWord =
      config.mode === "words" && state.wordIndex === prompt.words.length - 1;
    const correctSeparator = state.currentInput.length === target.length;
    const counters = {
      ...state.counters,
      typedCharacters: state.counters.typedCharacters + 1,
      correctAttempts:
        state.counters.correctAttempts + (correctSeparator ? 1 : 0),
      incorrectAttempts:
        state.counters.incorrectAttempts + (correctSeparator ? 0 : 1),
      missingCharacters:
        state.counters.missingCharacters +
        Math.max(0, target.length - state.currentInput.length),
      separatorCharacters:
        state.counters.separatorCharacters + (finalWord ? 0 : 1),
    };
    if (finalWord || state.wordIndex >= prompt.words.length - 1) {
      return {
        ...state,
        status: "completed",
        counters,
        committedWords: [...state.committedWords, state.currentInput],
        currentInput: [],
      };
    }
    return {
      ...state,
      committedWords: [...state.committedWords, state.currentInput],
      currentInput: [],
      wordIndex: state.wordIndex + 1,
      counters,
    };
  }

  const startedAt = state.startedAt ?? now;
  const target = prompt.words[state.wordIndex] ?? "";
  const position = state.currentInput.length;
  if (position >= target.length + 21) {
    return {
      ...state,
      status: state.status === "ready" ? "running" : state.status,
      startedAt,
      deadline:
        state.deadline ??
        (config.mode === "time"
          ? startedAt + config.modeValue * 1_000
          : startedAt + WORD_TEST_LIMIT_MS),
    };
  }
  const correct = target[position] === grapheme;
  const next: ReferenceState = {
    ...state,
    status: state.status === "ready" ? "running" : state.status,
    startedAt,
    deadline:
      state.deadline ??
      (config.mode === "time"
        ? startedAt + config.modeValue * 1_000
        : startedAt + 600_000),
    currentInput: [...state.currentInput, grapheme],
    counters: {
      ...state.counters,
      typedCharacters: state.counters.typedCharacters + 1,
      correctAttempts: state.counters.correctAttempts + (correct ? 1 : 0),
      incorrectAttempts:
        state.counters.incorrectAttempts + (correct ? 0 : 1),
      extraAttempts:
        state.counters.extraAttempts + (position >= target.length ? 1 : 0),
    },
  };
  const finalExact =
    config.mode === "words" &&
    next.wordIndex === prompt.words.length - 1 &&
    next.currentInput.join("") === target;
  return finalExact ? { ...next, status: "completed" } : next;
}

function expectReferenceState(
  actual: TypingState,
  expected: ReferenceState,
): void {
  expect({
    status: actual.status,
    wordIndex: actual.wordIndex,
    committedWords: actual.committedWords,
    currentInput: actual.currentInput,
    startedAt: actual.startedAt,
    deadline: actual.deadline,
    counters: actual.counters,
  }).toEqual(expected);
}

describe("independent Rill typing reference model", () => {
  it("matches character classification across exhaustive small words", () => {
    const alphabet = ["", "a", "b", " ", "aa", "ab", "a ", "ba", "bbb"];
    for (const input of alphabet) {
      for (const target of alphabet) {
        for (const creditPartial of [false, true]) {
          expect(countWordCharacters(input, target, creditPartial)).toEqual(
            oracleCountWord(input, target, creditPartial),
          );
        }
      }
    }
  });

  it("matches generated retained-word traces and every graph boundary", () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const events = buildRandomEvents(seed, 35);
      const rawGraphEndMs = 250 + (seed * 499) % 15_000;
      const config = seed % 2 === 0 ? WORD_CONFIG : TIME_CONFIG;
      const roundedSeconds =
        Math.round(
          (rawGraphEndMs / 1_000 + Number.EPSILON) * 100,
        ) / 100;
      const durationMs =
        config.mode === "words"
          ? Math.round(roundedSeconds * 1_000)
          : rawGraphEndMs;
      expect(
        countCharacters(events, PROMPT, config, config.mode === "time"),
      ).toEqual(
        oracleCountCharacters(
          events,
          PROMPT,
          config,
          config.mode === "time",
        ),
      );
      expect(
        buildPaceBuckets(
          durationMs,
          events,
          PROMPT,
          config,
          rawGraphEndMs,
        ),
      ).toEqual(
        oracleBuckets(
          durationMs,
          events,
          PROMPT,
          config,
          rawGraphEndMs,
        ),
      );
    }
  });

  it("matches an independent source-order metric oracle on generated vectors", () => {
    for (let seed = 1; seed <= 2_000; seed += 1) {
      const random = seededRandom(seed);
      const correctAttempts = randomInt(random, 5_000);
      const incorrectAttempts = randomInt(random, 5_000);
      const typedCharacters = randomInt(
        random,
        correctAttempts + incorrectAttempts + 1,
      );
      const correctCharacters = randomInt(random, typedCharacters + 1);
      const incorrectCharacters = randomInt(
        random,
        typedCharacters - correctCharacters + 1,
      );
      const extraAttempts = randomInt(
        random,
        typedCharacters - correctCharacters - incorrectCharacters + 1,
      );
      const counters: ResultCounters = {
        typedCharacters,
        correctAttempts,
        incorrectAttempts,
        correctCharacters,
        incorrectCharacters,
        missingCharacters: randomInt(random, 100),
        extraAttempts,
        correctedErrors: randomInt(random, incorrectAttempts + 1),
      };
      const durationMs = 250 + randomInt(random, 599_751);
      const buckets = Array.from(
        { length: 1 + randomInt(random, 12) },
        (): PaceBucket => ({
          durationMs: 500 + randomInt(random, 501),
          typedCharacters: randomInt(random, 40),
          correctCharacters: 0,
          rawCharacters: 0,
          errors: 0,
        }),
      );
      expect(calculateMetrics(durationMs, counters, buckets)).toEqual(
        oracleMetrics(durationMs, counters, buckets),
      );
    }
  });

  it("matches an independent state machine after every generated action", () => {
    for (let seed = 1; seed <= 150; seed += 1) {
      const random = seededRandom(seed);
      let actual = createTypingState(
        WORD_CONFIG,
        PROMPT,
        `run-${String(seed)}`,
      );
      let expected = referenceState();
      let now = 10_000;
      for (let step = 0; step < 80; step += 1) {
        now += randomInt(random, 700);
        let action: TypingAction;
        const choice = random();
        if (choice < 0.16) {
          action = { type: "backspace", now, wallNow: now };
        } else if (choice < 0.24) {
          action = {
            type: "deleteWordBackward",
            now,
            wallNow: now,
          };
        } else if (choice < 0.32) {
          action = { type: "insert", grapheme: " ", now, wallNow: now };
        } else if (choice < 0.38) {
          action = {
            type: "insertBatch",
            graphemes: ["x", "z"],
            now,
            wallNow: now,
          };
        } else {
          const target = PROMPT.words[actual.wordIndex] ?? "a";
          const intended = target[actual.currentInput.length];
          const grapheme =
            random() < 0.68 && intended !== undefined
              ? intended
              : (["x", "z", "w"][randomInt(random, 3)] ?? "x");
          action = { type: "insert", grapheme, now, wallNow: now };
        }
        actual = typingReducer(actual, action);
        expected = referenceStep(expected, action, WORD_CONFIG, PROMPT);
        expectReferenceState(actual, expected);
        expect(actual.counters.correctedErrors).toBeLessThanOrEqual(
          actual.counters.incorrectAttempts,
        );
        if (actual.status === "completed") break;
      }
    }
  });

  it("distinguishes boundary and formula sentinel values", () => {
    const perfect = oracleCountWord("word ", "word ", false);
    const partial = oracleCountWord("wor", "word ", true);
    const correctedCounters: ResultCounters = {
      typedCharacters: 4,
      correctAttempts: 4,
      incorrectAttempts: 1,
      correctCharacters: 4,
      incorrectCharacters: 0,
      missingCharacters: 0,
      extraAttempts: 0,
      correctedErrors: 1,
    };
    const variableBuckets: PaceBucket[] = [
      {
        durationMs: 1_000,
        typedCharacters: 1,
        correctCharacters: 1,
        rawCharacters: 1,
        errors: 0,
      },
      {
        durationMs: 1_000,
        typedCharacters: 9,
        correctCharacters: 10,
        rawCharacters: 10,
        errors: 1,
      },
    ];
    const sentinels = [
      perfect.correctWord !== 0, // whole-word credit removed
      partial.correctWord === 3, // partial credit removed/overcredited
      oracleBoundaries(1_490, "words", 1_494.99).length === 1, // 10 ms cutoff changed
      oracleBoundaries(1_500, "words", 1_495).at(-1) === 1_495, // cutoff made exclusive
      roundPositiveRational(1n, 8n) === 0.13, // positive half rounded down
      oracleConsistency(variableBuckets) < 100, // consistency made constant
      correctedCounters.correctedErrors <=
        correctedCounters.incorrectAttempts, // corrected bound weakened
      oracleBuckets(
        1_000,
        [
          {
            elapsedMs: 1_000,
            wordIndex: 0,
            type: "insert",
            grapheme: "a",
            correct: true,
          },
        ],
        PROMPT,
        TIME_CONFIG,
        1_000,
      )[0]?.typedCharacters === 1, // boundary made exclusive
    ];
    expect(sentinels).toEqual(Array(8).fill(true));
  });
});
