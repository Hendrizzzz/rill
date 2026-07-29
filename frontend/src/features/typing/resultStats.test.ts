import { describe, expect, it } from "vitest";

import {
  buildPaceBuckets,
  countCharacters,
  countWordCharacters,
  normalizeEventElapsedMs,
  normalizeTestDurationMs,
} from "./resultStats";
import type {
  Prompt,
  TestConfig,
  TypingInputEvent,
} from "./types";

const config: TestConfig = {
  mode: "words",
  modeValue: 10,
  punctuation: false,
  numbers: false,
  contentType: "words",
  language: "en",
  errorPolicy: "normal",
};

const prompt: Prompt = {
  id: "result-stats",
  seed: 1,
  wordListVersion: "en-v1",
  generatorVersion: 1,
  language: "en",
  words: ["cat", "dog", "sun", "map", "red", "box", "ink", "run", "day", "sky"],
};

function event(
  elapsedMs: number,
  type: TypingInputEvent["type"],
  grapheme: string,
  correct: boolean,
): TypingInputEvent {
  return { elapsedMs, wordIndex: 0, type, grapheme, correct };
}

describe("Monkeytype-compatible result statistics", () => {
  it("excludes automatic code indentation from retained and raw characters", () => {
    const codeConfig: TestConfig = {
      ...config,
      modeValue: 2,
      contentType: "code",
      codeLanguage: "python3",
    };
    const codePrompt: Prompt = {
      ...prompt,
      id: "code-v2-python3-stats",
      wordListVersion: "code-v2",
      codeLanguage: "python3",
      words: ["def add(a, b):", "    return a + b"],
    };
    const events: TypingInputEvent[] = [
      ...Array.from("def add(a, b):\n").map((grapheme, index) => ({
        elapsedMs: index * 20,
        wordIndex: 0,
        type: "insert" as const,
        grapheme,
        correct: true,
      })),
      ...Array.from("return a + b").map((grapheme, index) => ({
        elapsedMs: 400 + index * 20,
        wordIndex: 1,
        type: "insert" as const,
        grapheme,
        correct: true,
      })),
    ];

    expect(countCharacters(events, codePrompt, codeConfig, false)).toEqual({
      allCorrect: 27,
      correctWord: 27,
      incorrect: 0,
      extra: 0,
      missed: 0,
    });
    expect(
      buildPaceBuckets(1_000, events, codePrompt, codeConfig, 1_000),
    ).toEqual([
      {
        durationMs: 1_000,
        typedCharacters: 27,
        correctCharacters: 27,
        rawCharacters: 27,
        errors: 0,
      },
    ]);
  });

  it("counts one accepted non-BMP grapheme as one incorrect character", () => {
    expect(countWordCharacters("👩‍💻", "a", false)).toEqual({
      allCorrect: 0,
      correctWord: 0,
      incorrect: 1,
      extra: 0,
      missed: 0,
    });
  });

  it("uses the reference 10ms duration grid for the fractional tail", () => {
    const events = [event(100, "insert", "c", true)];

    expect(normalizeTestDurationMs(494.99)).toBe(490);
    expect(buildPaceBuckets(490, events, prompt, config, 494.99)).toEqual([]);

    expect(normalizeTestDurationMs(495)).toBe(500);
    expect(buildPaceBuckets(500, events, prompt, config, 495)).toEqual([
      {
        durationMs: 495,
        typedCharacters: 1,
        correctCharacters: 1,
        rawCharacters: 1,
        errors: 0,
      },
    ]);
  });

  it("keeps a terminal input that is fractionally beyond the rounded duration", () => {
    const events = [
      event(100, "insert", "c", true),
      event(500.49, "insert", "a", true),
    ];

    expect(buildPaceBuckets(500, events, prompt, config, 500.49)).toEqual([
      {
        durationMs: 500.49,
        typedCharacters: 2,
        correctCharacters: 2,
        rawCharacters: 2,
        errors: 0,
      },
    ]);
  });

  it("canonicalizes a fractional tail after subtracting whole seconds", () => {
    const events = [
      event(100, "insert", "c", true),
      event(1_500.04, "insert", "a", true),
    ];

    expect(
      buildPaceBuckets(1_500, events, prompt, config, 1_500.04),
    ).toEqual([
      {
        durationMs: 1_000,
        typedCharacters: 1,
        correctCharacters: 1,
        rawCharacters: 1,
        errors: 0,
      },
      {
        durationMs: 500.04,
        typedCharacters: 1,
        correctCharacters: 2,
        rawCharacters: 2,
        errors: 0,
      },
    ]);
  });

  it.each([2_000.01, 2_004.99])(
    "folds a %.2fms terminal event into the normalized whole-second bucket",
    (rawEndMs) => {
      const events = [
        event(100, "insert", "c", true),
        event(1_000, "insert", "a", true),
        event(rawEndMs, "insert", "t", true),
      ];

      expect(
        buildPaceBuckets(2_000, events, prompt, config, rawEndMs),
      ).toEqual([
        {
          durationMs: 1_000,
          typedCharacters: 2,
          correctCharacters: 2,
          rawCharacters: 2,
          errors: 0,
        },
        {
          durationMs: 1_000,
          typedCharacters: 1,
          correctCharacters: 3,
          rawCharacters: 3,
          errors: 0,
        },
      ]);
    },
  );

  it("normalizes sub-millisecond events onto the same second boundary", () => {
    const events = [
      event(999.999, "insert", "c", true),
      event(1_000, "insert", "a", true),
      event(1_000.001, "insert", "t", true),
    ].map((input) => ({
      ...input,
      elapsedMs: normalizeEventElapsedMs(input.elapsedMs),
    }));

    expect(buildPaceBuckets(2_000, events, prompt, config, 2_000)).toMatchObject([
      { durationMs: 1_000, typedCharacters: 3 },
      { durationMs: 1_000, typedCharacters: 0 },
    ]);
  });

  it("assigns events immediately around and on a second boundary", () => {
    const events = [
      event(999, "insert", "c", true),
      event(1_000, "insert", "a", true),
      event(1_001, "insert", "t", true),
    ];

    expect(buildPaceBuckets(2_000, events, prompt, config, 2_000)).toMatchObject([
      { durationMs: 1_000, typedCharacters: 2 },
      { durationMs: 1_000, typedCharacters: 1 },
    ]);
  });

  it("counts each exact-second event once", () => {
    const events = [
      event(1_000, "insert", "c", true),
      event(2_000, "insert", "a", true),
      event(3_000, "insert", "t", true),
    ];

    expect(buildPaceBuckets(3_000, events, prompt, config, 3_000)).toMatchObject([
      { durationMs: 1_000, typedCharacters: 1 },
      { durationMs: 1_000, typedCharacters: 1 },
      { durationMs: 1_000, typedCharacters: 1 },
    ]);
  });

  it("keeps stable event order when timestamps are identical", () => {
    const events = [
      event(1_000, "insert", "c", true),
      event(1_000, "insert", "a", true),
      event(1_000, "insert", "t", true),
    ];

    expect(buildPaceBuckets(2_000, events, prompt, config, 2_000)).toMatchObject([
      { durationMs: 1_000, typedCharacters: 3, correctCharacters: 3 },
      { durationMs: 1_000, typedCharacters: 0, correctCharacters: 3 },
    ]);
  });

  it("does not annualize a 24ms terminal word tail into a pace spike", () => {
    const buckets = buildPaceBuckets(
      1_020,
      [event(1_024, "insert", "c", true)],
      prompt,
      config,
      1_024,
    );

    expect(buckets).toEqual([
      {
        durationMs: 1_000,
        typedCharacters: 0,
        correctCharacters: 0,
        rawCharacters: 0,
        errors: 0,
      },
    ]);
  });

  it.each([
    { elapsedMs: 494.99, roundedDurationMs: 490, bucketCount: 0 },
    { elapsedMs: 495, roundedDurationMs: 500, bucketCount: 1 },
    { elapsedMs: 499.999, roundedDurationMs: 500, bucketCount: 1 },
    { elapsedMs: 500, roundedDurationMs: 500, bucketCount: 1 },
    { elapsedMs: 501, roundedDurationMs: 500, bucketCount: 1 },
  ])(
    "applies the tail rule after 10ms result rounding at $elapsedMs",
    ({ elapsedMs, roundedDurationMs, bucketCount }) => {
      expect(
        buildPaceBuckets(
          roundedDurationMs,
          [event(elapsedMs, "insert", "c", true)],
          prompt,
          config,
          elapsedMs,
        ),
      ).toHaveLength(bucketCount);
    },
  );

  it.each([
    {
      rawEndMs: 1_994.99,
      aggregateDurationMs: 1_990,
      bucketDurations: [1_000, 994.99],
    },
    {
      rawEndMs: 1_995,
      aggregateDurationMs: 2_000,
      bucketDurations: [1_000, 1_000],
    },
    {
      rawEndMs: 1_999,
      aggregateDurationMs: 2_000,
      bucketDurations: [1_000, 1_000],
    },
    {
      rawEndMs: 2_000,
      aggregateDurationMs: 2_000,
      bucketDurations: [1_000, 1_000],
    },
    {
      rawEndMs: 5_998,
      aggregateDurationMs: 6_000,
      bucketDurations: Array.from({ length: 6 }, () => 1_000),
    },
    {
      rawEndMs: 6_996,
      aggregateDurationMs: 7_000,
      bucketDurations: Array.from({ length: 7 }, () => 1_000),
    },
  ])(
    "keeps graph data at the $rawEndMs rollover",
    ({ rawEndMs, aggregateDurationMs, bucketDurations }) => {
      const events = [
        event(100, "insert", "c", true),
        event(rawEndMs, "insert", "a", true),
      ];

      expect(normalizeTestDurationMs(rawEndMs)).toBe(aggregateDurationMs);
      expect(
        buildPaceBuckets(
          aggregateDurationMs,
          events,
          prompt,
          config,
          rawEndMs,
        ).map((bucket) => bucket.durationMs),
      ).toEqual(bucketDurations);
    },
  );

  it("normalizes captured event offsets to hundredths of a millisecond", () => {
    expect(normalizeEventElapsedMs(499.994)).toBe(499.99);
    expect(normalizeEventElapsedMs(499.995)).toBe(500);
  });

  it("keeps historical burst/errors while replaying a corrected word", () => {
    const events = [
      event(100, "insert", "x", false),
      event(1_100, "delete", "x", true),
      event(1_200, "insert", "c", true),
      event(1_300, "insert", "a", true),
      event(1_400, "insert", "t", true),
      event(1_500, "insert", " ", true),
    ];

    expect(buildPaceBuckets(2_000, events, prompt, config, 2_000)).toEqual([
      {
        durationMs: 1_000,
        typedCharacters: 1,
        correctCharacters: 0,
        rawCharacters: 1,
        errors: 1,
      },
      {
        durationMs: 1_000,
        typedCharacters: 4,
        correctCharacters: 4,
        rawCharacters: 4,
        errors: 0,
      },
    ]);
  });

  it("replays separator deletion when an imperfect word is reopened", () => {
    const events = [
      event(100, "insert", "c", true),
      event(200, "insert", "a", true),
      event(300, "insert", " ", false),
      event(1_100, "delete", " ", true),
      event(1_200, "insert", "t", true),
      event(1_300, "insert", " ", true),
    ];

    expect(buildPaceBuckets(2_000, events, prompt, config, 2_000)).toEqual([
      {
        durationMs: 1_000,
        typedCharacters: 3,
        correctCharacters: 0,
        rawCharacters: 3,
        errors: 1,
      },
      {
        durationMs: 1_000,
        typedCharacters: 2,
        correctCharacters: 4,
        rawCharacters: 4,
        errors: 0,
      },
    ]);
  });
});
