import { describe, expect, it } from "vitest";

import { buildPaceBuckets, calculateConsistency, calculateMetrics } from "./scoring";

describe("typing scoring", () => {
  it("uses final correct characters for wpm and attempts for raw wpm", () => {
    const metrics = calculateMetrics(
      60_000,
      {
        typedCharacters: 250,
        correctAttempts: 230,
        incorrectAttempts: 20,
        correctCharacters: 225,
        missingCharacters: 10,
        extraAttempts: 5,
        correctedErrors: 8,
      },
      [{ durationMs: 1_000, typedCharacters: 4 }],
    );

    expect(metrics).toEqual({
      wpm: 45,
      rawWpm: 50,
      accuracy: 88.46,
      consistency: 100,
    });
  });

  it("keeps zero-character pauses in consistency", () => {
    expect(
      calculateConsistency([
        { durationMs: 1_000, typedCharacters: 5 },
        { durationMs: 1_000, typedCharacters: 0 },
      ]),
    ).toBe(0);
  });

  it("builds a normalized final partial pace bucket", () => {
    expect(buildPaceBuckets(2_250, [4, 5, 2])).toEqual([
      { durationMs: 1_000, typedCharacters: 4 },
      { durationMs: 1_000, typedCharacters: 5 },
      { durationMs: 250, typedCharacters: 2 },
    ]);
  });
});
