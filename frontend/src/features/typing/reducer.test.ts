import { describe, expect, it } from "vitest";

import { createTypingState, typingReducer } from "./reducer";
import type { Prompt, TestConfig, TypingState } from "./types";

const config: TestConfig = {
  mode: "words",
  modeValue: 10,
  punctuation: false,
  numbers: false,
  contentType: "words",
  language: "en",
  errorPolicy: "normal",
};

function prompt(words: readonly string[]): Prompt {
  return {
    id: "test",
    seed: 1,
    wordListVersion: "en-v1",
    generatorVersion: 1,
    language: "en",
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
  it("advances to structurally indented code without typing leading spaces", () => {
    const codeConfig: TestConfig = {
      ...config,
      modeValue: 2,
      contentType: "code",
      codeLanguage: "python3",
    };
    const codePrompt: Prompt = {
      ...prompt(["def add(a, b):", "    return a + b"]),
      id: "code-test",
      wordListVersion: "code-v2",
      codeLanguage: "python3",
    };
    let state = createTypingState(codeConfig, codePrompt, "code-run");
    let now = 0;
    for (const grapheme of Array.from("def add(a, b):")) {
      state = insert(state, grapheme, now);
      now += 20;
    }

    expect(state.wordIndex).toBe(0);
    expect(state.currentInput.join("")).toBe("def add(a, b):");

    state = insert(state, "\n", now);
    expect(state.wordIndex).toBe(1);
    expect(state.committedWords[0]?.join("")).toBe("def add(a, b):");
    expect(state.currentInput).toEqual([]);

    for (const grapheme of Array.from("return a + b")) {
      now += 20;
      state = insert(state, grapheme, now);
    }

    expect(state.status).toBe("completed");
    expect(state.result).toMatchObject({
      contentType: "code",
      codeLanguage: "python3",
      correctCharacters: 27,
      accuracy: 100,
    });
  });

  it("moves through indent and dedent transitions without synthetic input", () => {
    const codeConfig: TestConfig = {
      ...config,
      modeValue: 5,
      contentType: "code",
      codeLanguage: "javascript",
    };
    const sourceLines = [
      "if (ready) {",
      "    while (active) {",
      "        work();",
      "    }",
      "}",
    ];
    const typableLines = [
      "if (ready) {",
      "while (active) {",
      "work();",
      "}",
      "}",
    ];
    const codePrompt: Prompt = {
      ...prompt(sourceLines),
      id: "code-v2-javascript-indent-transitions",
      wordListVersion: "code-v2",
      codeLanguage: "javascript",
    };
    let state = createTypingState(
      codeConfig,
      codePrompt,
      "code-indent-run",
    );
    let now = 0;

    typableLines.forEach((line, lineIndex) => {
      Array.from(line).forEach((grapheme) => {
        state = insert(state, grapheme, now);
        now += 20;
      });
      if (lineIndex < typableLines.length - 1) {
        state = insert(state, "\n", now);
        now += 20;
        expect(state.currentInput).toEqual([]);
        expect(state.wordIndex).toBe(lineIndex + 1);
      }
    });

    expect(state.status).toBe("completed");
    expect(state.counters.correctedErrors).toBe(0);
    expect(
      state.inputEvents.filter(
        (event) =>
          event.type === "insert" &&
          event.grapheme === " " &&
          event.wordIndex > 0 &&
          (event.wordIndex === 2 || event.wordIndex === 3),
      ),
    ).toEqual([]);
    expect(state.result?.typedCharacters).toBe(
      typableLines.join("").length + typableLines.length - 1,
    );
  });

  it("treats a manually typed leading code space as an error", () => {
    const codeConfig: TestConfig = {
      ...config,
      modeValue: 1,
      contentType: "code",
      codeLanguage: "python3",
    };
    const codePrompt: Prompt = {
      ...prompt(["    return value"]),
      id: "code-v2-python3-manual-indent",
      wordListVersion: "code-v2",
      codeLanguage: "python3",
    };
    let state = createTypingState(
      codeConfig,
      codePrompt,
      "manual-indent-run",
    );

    state = insert(state, " ", 0);
    expect(state.inputEvents.at(-1)).toMatchObject({
      grapheme: " ",
      correct: false,
    });
    state = typingReducer(state, {
      type: "backspace",
      now: 20,
      wallNow: 1_700_000_000_020,
    });
    Array.from("return value").forEach((grapheme, index) => {
      state = insert(state, grapheme, 40 + index * 20);
    });

    expect(state.status).toBe("completed");
    expect(state.result?.correctedErrors).toBe(1);
    expect(state.result?.accuracy).toBeLessThan(100);
  });

  it("reopens an imperfect indented line but keeps a perfect one locked", () => {
    const codeConfig: TestConfig = {
      ...config,
      modeValue: 3,
      contentType: "code",
      codeLanguage: "python3",
    };
    const codePrompt: Prompt = {
      ...prompt(["def run():", "    return value", "done()"]),
      id: "code-v2-python3-backtrack",
      wordListVersion: "code-v2",
      codeLanguage: "python3",
    };
    let state = createTypingState(
      codeConfig,
      codePrompt,
      "code-backtrack-run",
    );
    let now = 0;
    for (const grapheme of "def run():\n") {
      state = insert(state, grapheme, now);
      now += 20;
    }

    const locked = typingReducer(state, {
      type: "backspace",
      now,
      wallNow: 1_700_000_000_000 + now,
    });
    expect(locked).toBe(state);

    for (const grapheme of "retx\n") {
      state = insert(state, grapheme, now);
      now += 20;
    }
    expect(state.wordIndex).toBe(2);

    state = typingReducer(state, {
      type: "backspace",
      now,
      wallNow: 1_700_000_000_000 + now,
    });
    expect(state.wordIndex).toBe(1);
    expect(state.currentInput.join("")).toBe("retx");
  });

  it("deletes one code token at a time instead of clearing the line", () => {
    const codeConfig: TestConfig = {
      ...config,
      modeValue: 2,
      contentType: "code",
      codeLanguage: "python3",
    };
    const codePrompt: Prompt = {
      ...prompt(["def total(values):", "    result += value"]),
      id: "code-delete-test",
      wordListVersion: "code-v2",
      codeLanguage: "python3",
    };
    let state = createTypingState(codeConfig, codePrompt, "code-delete-run");
    Array.from("result += value").forEach((grapheme, index) => {
      state = insert(state, grapheme, index * 20);
    });

    state = typingReducer(state, {
      type: "deleteWordBackward",
      now: 400,
      wallNow: 1_700_000_000_400,
    });
    expect(state.currentInput.join("")).toBe("result += ");

    state = typingReducer(state, {
      type: "deleteWordBackward",
      now: 500,
      wallNow: 1_700_000_000_500,
    });
    expect(state.currentInput.join("")).toBe("result ");

    state = typingReducer(state, {
      type: "deleteWordBackward",
      now: 600,
      wallNow: 1_700_000_000_600,
    });
    expect(state.currentInput.join("")).toBe("");
  });

  it("strict mode blocks an imperfect word until it is corrected", () => {
    const strictConfig: TestConfig = { ...config, errorPolicy: "strict" };
    let state = createTypingState(
      strictConfig,
      prompt(["cat", "dog"]),
      "strict-run",
    );
    state = insert(state, "c", 0);
    state = insert(state, "a", 100);
    state = insert(state, "x", 200);
    const blocked = insert(state, " ", 300);

    expect(blocked.wordIndex).toBe(0);
    expect(blocked.currentInput).toEqual(["c", "a", "x"]);

    state = typingReducer(blocked, {
      type: "backspace",
      now: 400,
      wallNow: 1_700_000_000_400,
    });
    state = insert(state, "t", 500);
    state = insert(state, " ", 600);

    expect(state.wordIndex).toBe(1);
    expect(state.currentInput).toEqual([]);
    expect(state.committedWords).toEqual([["c", "a", "t"]]);
  });

  it("scores one visible grapheme as one target character", () => {
    const accentedPrompt: Prompt = {
      ...prompt(["é"]),
      language: "es",
      wordListVersion: "es-v1",
    };
    const state = insert(
      createTypingState(
        { ...config, language: "es" },
        accentedPrompt,
        "accent-run",
      ),
      "é",
      0,
    );

    expect(state.status).toBe("completed");
    expect(state.result).toMatchObject({
      typedCharacters: 1,
      correctCharacters: 1,
      accuracy: 100,
      language: "es",
    });
  });

  it("completes a zero-duration one-character test without non-finite metrics", () => {
    const state = insert(initial(["c"]), "c", 0);

    expect(state.status).toBe("completed");
    expect(state.startedAt).toBe(0);
    expect(state.result).toMatchObject({
      durationMs: 1,
      accuracy: 100,
    });
    expect(Number.isFinite(state.result?.wpm)).toBe(true);
    expect(Number.isFinite(state.result?.rawWpm)).toBe(true);
    expect(Number.isFinite(state.result?.consistency)).toBe(true);
  });

  it("starts only on the first non-space grapheme", () => {
    const ready = initial(["cat", "dog"]);
    const ignored = insert(ready, " ", 100);
    const running = insert(ignored, "c", 250);

    expect(ignored).toBe(ready);
    expect(ignored.status).toBe("ready");
    expect(ignored.counters).toEqual({
      typedCharacters: 0,
      correctAttempts: 0,
      incorrectAttempts: 0,
      missingCharacters: 0,
      extraAttempts: 0,
      correctedErrors: 0,
      separatorCharacters: 0,
    });
    expect(ignored.inputEvents).toEqual([]);
    expect(running.status).toBe("running");
    expect(running.startedAt).toBe(250);
  });

  it("starts timing when an IME composition begins", () => {
    const ready = initial(["cat", "dog"]);
    const running = typingReducer(ready, {
      type: "start",
      now: 250,
    });

    expect(running).toMatchObject({
      status: "running",
      startedAt: 250,
      currentInput: [],
    });
  });

  it("uses one timestamp for every grapheme from the same browser event", () => {
    const state = typingReducer(initial(["ab", "cat"]), {
      type: "insertBatch",
      graphemes: ["a", "b"],
      now: 1_000,
      wallNow: 1_700_000_001_000,
    });

    expect(state.currentInput).toEqual(["a", "b"]);
    expect(state.inputEvents.map(({ elapsedMs }) => elapsedMs)).toEqual([0, 0]);
  });

  it.each([
    { target: "we're", typed: "we\u2019re" },
    { target: "well-being", typed: "well\u2014being" },
    { target: "\u201chello\u201d", typed: '"hello"' },
    { target: "wait...", typed: "wait\u2026" },
  ])(
    "accepts mobile typography $typed for target $target",
    ({ target, typed }) => {
      let state = initial([target]);
      Array.from(typed).forEach((grapheme, index) => {
        state = insert(state, grapheme, index * 100);
      });

      expect(state.status).toBe("completed");
      expect(state.result).toMatchObject({
        accuracy: 100,
        incorrectAttempts: 0,
        correctCharacters: Array.from(target).length,
      });
    },
  );

  it("caps overtyping at twenty-one graphemes beyond the target", () => {
    let state = initial(["a", "dog"]);
    for (let index = 0; index < 30; index += 1) {
      state = insert(state, "x", index * 10);
    }

    expect(state.currentInput).toHaveLength(22);
    expect(state.counters).toMatchObject({
      typedCharacters: 22,
      incorrectAttempts: 22,
      extraAttempts: 21,
    });
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
      typedCharacters: 3,
      correctAttempts: 3,
      incorrectAttempts: 1,
      incorrectCharacters: 0,
      missingCharacters: 0,
      extraAttempts: 0,
      correctedErrors: 1,
      correctCharacters: 3,
      accuracy: 75,
    });
  });

  it("retains the exact final input when elapsed time rounds down", () => {
    let state = initial(["ca"]);
    state = insert(state, "c", 0);
    state = insert(state, "a", 500.49);

    expect(state.status).toBe("completed");
    expect(state.result).toMatchObject({
      durationMs: 500,
      typedCharacters: 2,
      correctCharacters: 2,
      paceBuckets: [
        {
          durationMs: 500.49,
          typedCharacters: 2,
          correctCharacters: 2,
          rawCharacters: 2,
          errors: 0,
        },
      ],
    });
  });

  it.each([
    {
      label: "uncorrected substitution",
      sequence: "xat dog",
      expected: {
        typedCharacters: 7,
        correctAttempts: 6,
        incorrectAttempts: 1,
        correctCharacters: 3,
        incorrectCharacters: 1,
        extraAttempts: 1,
        missingCharacters: 0,
        accuracy: 85.71,
      },
    },
    {
      label: "missed character before a separator",
      sequence: "ca dog",
      expected: {
        typedCharacters: 6,
        correctAttempts: 5,
        incorrectAttempts: 1,
        correctCharacters: 3,
        incorrectCharacters: 1,
        extraAttempts: 0,
        missingCharacters: 1,
        accuracy: 83.33,
      },
    },
    {
      label: "extra character before a separator",
      sequence: "catx dog",
      expected: {
        typedCharacters: 8,
        correctAttempts: 6,
        incorrectAttempts: 2,
        correctCharacters: 3,
        incorrectCharacters: 1,
        extraAttempts: 1,
        missingCharacters: 0,
        accuracy: 75,
      },
    },
  ])("matches final word accounting for an $label", ({ sequence, expected }) => {
    let state = initial(["cat", "dog"]);
    Array.from(sequence).forEach((grapheme, index) => {
      state = insert(state, grapheme, index * 200);
    });

    expect(state.status).toBe("completed");
    expect(state.result).toMatchObject(expected);
  });

  it("keeps corrected input in accuracy but removes it from raw and character stats", () => {
    let state = initial(["cat", "dog"]);
    state = insert(state, "x", 0);
    state = typingReducer(state, {
      type: "backspace",
      now: 100,
      wallNow: 1_700_000_000_100,
    });
    Array.from("cat dog").forEach((grapheme, index) => {
      state = insert(state, grapheme, 200 + index * 200);
    });

    expect(state.result).toMatchObject({
      typedCharacters: 7,
      correctAttempts: 7,
      incorrectAttempts: 1,
      correctCharacters: 7,
      incorrectCharacters: 0,
      extraAttempts: 0,
      missingCharacters: 0,
      correctedErrors: 1,
      accuracy: 87.5,
    });
  });

  it("penalizes missing characters on an early final submit", () => {
    let state = initial(["cat"]);
    state = insert(state, "c", 0);
    state = insert(state, " ", 1_000);

    expect(state.result).toMatchObject({
      typedCharacters: 2,
      correctAttempts: 1,
      incorrectAttempts: 1,
      incorrectCharacters: 1,
      missingCharacters: 1,
      correctCharacters: 0,
      accuracy: 50,
    });
  });

  it("commits a non-empty unfinished word on Space in normal mode", () => {
    let state = initial(["cat", "dog"]);
    state = insert(state, "c", 0);
    state = insert(state, " ", 1_000);

    expect(state).toMatchObject({
      status: "running",
      wordIndex: 1,
      committedWords: [["c"]],
      currentInput: [],
      counters: {
        typedCharacters: 2,
        correctAttempts: 1,
        incorrectAttempts: 1,
        missingCharacters: 2,
        extraAttempts: 0,
        correctedErrors: 0,
        separatorCharacters: 1,
      },
    });
    expect(state.inputEvents).toEqual([
      {
        elapsedMs: 0,
        wordIndex: 0,
        type: "insert",
        grapheme: "c",
        correct: true,
      },
      {
        elapsedMs: 1_000,
        wordIndex: 0,
        type: "insert",
        grapheme: " ",
        correct: false,
      },
    ]);
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

  it("deletes the entire active word without crossing its boundary", () => {
    let state = initial(["cat", "dog"]);
    state = insert(state, "c", 0);
    state = insert(state, "x", 100);
    state = insert(state, "t", 200);
    const beforeDelete = state;

    state = typingReducer(state, {
      type: "deleteWordBackward",
      now: 300,
      wallNow: 1_700_000_000_300,
    });

    expect(state.currentInput).toEqual([]);
    expect(state.wordIndex).toBe(0);
    expect(state.counters).toMatchObject({
      typedCharacters: 3,
      correctAttempts: 2,
      incorrectAttempts: 1,
      correctedErrors: 1,
    });
    expect(state.inputEvents).toHaveLength(beforeDelete.inputEvents.length + 3);
    expect(state.inputEvents.slice(-3).map(({ grapheme }) => grapheme)).toEqual([
      "t",
      "x",
      "c",
    ]);
  });

  it("reopens and clears an imperfect previous word with word deletion", () => {
    let state = initial(["cat", "dog"]);
    state = insert(state, "c", 0);
    state = insert(state, " ", 100);

    state = typingReducer(state, {
      type: "deleteWordBackward",
      now: 200,
      wallNow: 1_700_000_000_200,
    });

    expect(state).toMatchObject({
      status: "running",
      wordIndex: 0,
      committedWords: [],
      currentInput: [],
      counters: {
        missingCharacters: 0,
        separatorCharacters: 0,
        correctedErrors: 1,
      },
    });
    expect(state.inputEvents.slice(-2).map(({ grapheme }) => grapheme)).toEqual([
      " ",
      "c",
    ]);
  });

  it("does not cross a perfectly typed word with word deletion", () => {
    let state = initial(["cat", "dog"]);
    Array.from("cat ").forEach((grapheme, index) => {
      state = insert(state, grapheme, index * 100);
    });

    const unchanged = typingReducer(state, {
      type: "deleteWordBackward",
      now: 500,
      wallNow: 1_700_000_000_500,
    });

    expect(unchanged).toBe(state);
    expect(unchanged.wordIndex).toBe(1);
  });

  it("keeps repeated word deletion within the nearest imperfect boundary", () => {
    let state = initial(["a", "cat", "dog"]);
    Array.from("a c ").forEach((grapheme, index) => {
      state = insert(state, grapheme, index * 100);
    });

    state = typingReducer(state, {
      type: "deleteWordBackward",
      now: 600,
      wallNow: 1_700_000_000_600,
    });
    expect(state).toMatchObject({
      wordIndex: 1,
      committedWords: [["a"]],
      currentInput: [],
    });

    const unchanged = typingReducer(state, {
      type: "deleteWordBackward",
      now: 700,
      wallNow: 1_700_000_000_700,
    });
    expect(unchanged).toBe(state);
  });

  it("ignores word deletion before a test starts and after it completes", () => {
    const ready = initial(["a"]);
    expect(
      typingReducer(ready, {
        type: "deleteWordBackward",
        now: 0,
        wallNow: 1_700_000_000_000,
      }),
    ).toBe(ready);

    const completed = insert(ready, "a", 100);
    expect(
      typingReducer(completed, {
        type: "deleteWordBackward",
        now: 200,
        wallNow: 1_700_000_000_200,
      }),
    ).toBe(completed);
  });

  it("completes an expired test before applying word deletion", () => {
    const timeConfig: TestConfig = {
      ...config,
      mode: "time",
      modeValue: 15,
    };
    let state = createTypingState(
      timeConfig,
      prompt(["cat", "dog"]),
      "time-delete-run",
    );
    state = insert(state, "x", 1_000);
    state = typingReducer(state, {
      type: "deleteWordBackward",
      now: 16_000,
      wallNow: 1_700_000_016_000,
    });

    expect(state.status).toBe("completed");
    expect(state.result).toMatchObject({
      durationMs: 15_000,
      correctedErrors: 0,
    });
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
      const committedEvents = state.inputEvents;

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
      const correctedSeparator = previousInput.length !== 3;
      expect(state.counters).toEqual({
        ...committedCounters,
        missingCharacters: 0,
        separatorCharacters: 0,
        correctedErrors:
          committedCounters.correctedErrors + (correctedSeparator ? 1 : 0),
      });
      expect(state.inputEvents).toHaveLength(committedEvents.length + 1);
      expect(state.inputEvents.at(-1)).toMatchObject({
        type: "delete",
        grapheme: " ",
        correct: !correctedSeparator,
      });
    },
  );

  it("counts reopening a wrong separator as a corrected error", () => {
    let state = initial(["cat", "dog"]);
    state = insert(state, "c", 0);
    state = insert(state, " ", 100);

    expect(state.counters).toMatchObject({
      incorrectAttempts: 1,
      correctedErrors: 0,
    });
    state = typingReducer(state, {
      type: "backspace",
      now: 200,
      wallNow: 1_700_000_000_200,
    });

    expect(state.counters.correctedErrors).toBe(1);
    expect(state.counters.correctedErrors).toBeLessThanOrEqual(
      state.counters.incorrectAttempts,
    );
  });

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

  it.each([
    { elapsedMs: 14_999, accepted: true },
    { elapsedMs: 15_000, accepted: false },
    { elapsedMs: 15_001, accepted: false },
  ])(
    "handles a character at $elapsedMs ms around the time deadline",
    ({ elapsedMs, accepted }) => {
      const timeConfig: TestConfig = {
        mode: "time",
        modeValue: 15,
        punctuation: false,
        numbers: false,
        contentType: "words",
        language: "en",
        errorPolicy: "normal",
      };
      let state = createTypingState(
        timeConfig,
        prompt(["cat", "dog"]),
        "time-run",
      );
      state = insert(state, "c", 1_000);
      state = insert(state, "a", 1_000 + elapsedMs);

      if (accepted) {
        expect(state.status).toBe("running");
        expect(state.counters.typedCharacters).toBe(2);
      } else {
        expect(state.status).toBe("completed");
        expect(state.result).toMatchObject({
          durationMs: 15_000,
          typedCharacters: 1,
          correctCharacters: 1,
          completionReason: "time",
        });
      }
    },
  );

  it("normalizes a word-test duration to 10ms while keeping its raw graph tail", () => {
    let state = initial(["cat"]);
    state = insert(state, "c", 0);
    state = insert(state, "a", 200);
    state = insert(state, "t", 495);

    expect(state.status).toBe("completed");
    expect(state.result).toMatchObject({
      durationMs: 500,
      paceBuckets: [
        {
          durationMs: 495,
          typedCharacters: 3,
        },
      ],
    });
  });

  it("retains a terminal character just beyond a normalized whole second", () => {
    let state = initial(["cat"]);
    state = insert(state, "c", 0);
    state = insert(state, "a", 1_000);
    state = insert(state, "t", 2_000.01);

    expect(state.status).toBe("completed");
    expect(state.result).toMatchObject({
      durationMs: 2_000,
      typedCharacters: 3,
      correctCharacters: 3,
      paceBuckets: [
        {
          durationMs: 1_000,
          typedCharacters: 2,
          correctCharacters: 2,
          rawCharacters: 2,
        },
        {
          durationMs: 1_000,
          typedCharacters: 1,
          correctCharacters: 3,
          rawCharacters: 3,
        },
      ],
    });
  });

  it("completes a backgrounded test at its deadline on a later tick", () => {
    const timeConfig: TestConfig = {
      mode: "time",
      modeValue: 15,
      punctuation: false,
      numbers: false,
      contentType: "words",
      language: "en",
      errorPolicy: "normal",
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
