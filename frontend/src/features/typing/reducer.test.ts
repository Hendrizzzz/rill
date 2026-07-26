import { describe, expect, it } from "vitest";

import { createTypingState, typingReducer } from "./reducer";
import type { Prompt, TestConfig, TypingState } from "./types";

const config: TestConfig = {
  mode: "words",
  modeValue: 10,
  punctuation: false,
  numbers: false,
};

function prompt(words: readonly string[]): Prompt {
  return {
    id: "test",
    seed: 1,
    wordListVersion: "en-v1",
    generatorVersion: 1,
    words,
  };
}

function initial(words: readonly string[]): TypingState {
  return createTypingState(config, prompt(words), "run-1");
}

function insert(
  state: TypingState,
  grapheme: string,
  now: number,
): TypingState {
  return typingReducer(state, {
    type: "insert",
    grapheme,
    now,
    wallNow: 1_700_000_000_000 + now,
  });
}

describe("typing reducer contract", () => {
  it("starts only on the first non-space grapheme", () => {
    const ready = initial(["cat", "dog"]);
    const ignored = insert(ready, " ", 100);
    const running = insert(ignored, "c", 250);

    expect(ignored.status).toBe("ready");
    expect(running.status).toBe("running");
    expect(running.startedAt).toBe(250);
  });

  it("matches the corrected-first-error trace", () => {
    let state = initial(["cat"]);
    state = insert(state, "x", 0);
    state = typingReducer(state, {
      type: "backspace",
      now: 50,
      wallNow: 1_700_000_000_050,
    });
    state = insert(state, "c", 100);
    state = insert(state, "a", 200);
    state = insert(state, "t", 1_000);

    expect(state.status).toBe("completed");
    expect(state.result).toMatchObject({
      typedCharacters: 4,
      correctAttempts: 3,
      incorrectAttempts: 1,
      missingCharacters: 0,
      extraAttempts: 0,
      correctedErrors: 1,
      correctCharacters: 3,
      accuracy: 75,
    });
  });

  it("penalizes missing characters on an early final submit", () => {
    let state = initial(["cat"]);
    state = insert(state, "c", 0);
    state = insert(state, " ", 1_000);

    expect(state.result).toMatchObject({
      typedCharacters: 1,
      correctAttempts: 1,
      incorrectAttempts: 0,
      missingCharacters: 2,
      correctCharacters: 1,
      accuracy: 33.33,
    });
  });

  it("tracks extra attempts on an active non-final word", () => {
    let state = initial(["cat", "dog"]);
    state = insert(state, "c", 0);
    state = insert(state, "a", 100);
    state = insert(state, "t", 200);
    state = insert(state, "t", 300);

    expect(state.status).toBe("running");
    expect(state.counters).toMatchObject({
      typedCharacters: 4,
      correctAttempts: 3,
      incorrectAttempts: 1,
      extraAttempts: 1,
    });
  });

  it("counts an intermediate separator and ignores repeated spaces", () => {
    let state = initial(["cat", "dog"]);
    state = insert(state, "c", 0);
    state = insert(state, "a", 100);
    state = insert(state, "t", 200);
    state = insert(state, " ", 300);
    const afterCommit = state;
    state = insert(state, " ", 400);

    expect(afterCommit.counters).toMatchObject({
      typedCharacters: 4,
      correctAttempts: 4,
      separatorCharacters: 1,
    });
    expect(state).toBe(afterCommit);
  });

  it("does not let backspace reopen a perfectly typed word", () => {
    let state = initial(["a", "b"]);
    state = insert(state, "a", 0);
    state = insert(state, " ", 100);
    const unchanged = typingReducer(state, {
      type: "backspace",
      now: 200,
      wallNow: 1_700_000_000_200,
    });

    expect(unchanged).toBe(state);
    expect(unchanged.wordIndex).toBe(1);
  });

  it.each([
    { label: "substitution", input: ["x", "a", "t"], missing: 0 },
    { label: "missing suffix", input: ["c"], missing: 2 },
    { label: "extra character", input: ["c", "a", "t", "x"], missing: 0 },
  ])(
    "reopens an imperfect previous word with a $label",
    ({ input: previousInput, missing }) => {
      let state = initial(["cat", "dog"]);
      previousInput.forEach((grapheme, index) => {
        state = insert(state, grapheme, index * 100);
      });
      state = insert(state, " ", previousInput.length * 100);
      const committedCounters = state.counters;
      const committedPace = state.paceCounts;

      expect(state.counters.missingCharacters).toBe(missing);
      state = typingReducer(state, {
        type: "backspace",
        now: 1_000,
        wallNow: 1_700_000_001_000,
      });

      expect(state).toMatchObject({
        status: "running",
        wordIndex: 0,
        committedWords: [],
        currentInput: previousInput,
      });
      expect(state.counters).toEqual({
        ...committedCounters,
        missingCharacters: 0,
        separatorCharacters: 0,
      });
      expect(state.paceCounts).toEqual(committedPace);
    },
  );

  it("does not retain a stale missing penalty after reopening and completing a word", () => {
    let state = initial(["cat", "dog"]);
    state = insert(state, "c", 0);
    state = insert(state, " ", 100);
    expect(state.counters.missingCharacters).toBe(2);

    state = typingReducer(state, {
      type: "backspace",
      now: 200,
      wallNow: 1_700_000_000_200,
    });
    state = insert(state, "a", 300);
    state = insert(state, "t", 400);
    state = insert(state, " ", 500);

    expect(state).toMatchObject({
      wordIndex: 1,
      currentInput: [],
      committedWords: [["c", "a", "t"]],
      counters: {
        missingCharacters: 0,
        separatorCharacters: 1,
      },
    });
    expect(state.counters.typedCharacters).toBe(
      state.counters.correctAttempts + state.counters.incorrectAttempts,
    );
  });

  it("rejects a character at the exact time deadline", () => {
    const timeConfig: TestConfig = {
      mode: "time",
      modeValue: 15,
      punctuation: false,
      numbers: false,
    };
    let state = createTypingState(timeConfig, prompt(["cat", "dog"]), "time-run");
    state = insert(state, "c", 1_000);
    state = insert(state, "a", 16_000);

    expect(state.status).toBe("completed");
    expect(state.result).toMatchObject({
      durationMs: 15_000,
      typedCharacters: 1,
      correctCharacters: 1,
      completionReason: "time",
    });
  });

  it("completes a backgrounded test at its deadline on a later tick", () => {
    const timeConfig: TestConfig = {
      mode: "time",
      modeValue: 15,
      punctuation: false,
      numbers: false,
    };
    let state = createTypingState(timeConfig, prompt(["cat"]), "time-run");
    state = insert(state, "c", 2_000);
    state = typingReducer(state, {
      type: "tick",
      now: 99_000,
      wallNow: 1_700_000_099_000,
    });

    expect(state.completedAt).toBe(17_000);
    expect(state.result?.durationMs).toBe(15_000);
  });

  it("restarts with a fresh run and prompt", () => {
    let state = insert(initial(["cat"]), "c", 0);
    state = typingReducer(state, {
      type: "restart",
      runId: "run-2",
      prompt: prompt(["dog"]),
      config,
    });

    expect(state).toMatchObject({
      runId: "run-2",
      status: "ready",
      wordIndex: 0,
      currentInput: [],
      result: null,
    });
  });
});
