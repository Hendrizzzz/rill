import { describe, expect, it } from "vitest";

import {
  bucketEndTimesMs,
  calculateConsistency,
  calculateMetrics,
  calculateWpm,
} from "./scoring";
import type { PaceBucket } from "./types";

function bucket(
  typedCharacters: number,
  overrides: Partial<PaceBucket> = {},
): PaceBucket {
  return {
    durationMs: 1_000,
    typedCharacters,
    correctCharacters: typedCharacters,
    rawCharacters: typedCharacters,
    errors: 0,
    ...overrides,
  };
}

describe("typing scoring", () => {
  it("separates final retained text from historical attempts", () => {
    const metrics = calculateMetrics(
      60_000,
      {
        typedCharacters: 240,
        correctAttempts: 230,
        incorrectAttempts: 20,
        correctCharacters: 225,
        incorrectCharacters: 10,
        missingCharacters: 5,
        extraAttempts: 5,
        correctedErrors: 8,
      },
      [bucket(4)],
    );

    expect(metrics).toEqual({
      wpm: 45,
      rawWpm: 48,
      accuracy: 92,
      consistency: 100,
    });
  });

  it("returns neutral metrics when no typing attempts exist", () => {
    expect(
      calculateMetrics(
        1_000,
        {
          typedCharacters: 0,
          correctAttempts: 0,
          incorrectAttempts: 0,
          correctCharacters: 0,
          incorrectCharacters: 0,
          missingCharacters: 0,
          extraAttempts: 0,
          correctedErrors: 0,
        },
        [],
      ),
    ).toEqual({
      wpm: 0,
      rawWpm: 0,
      accuracy: 100,
      consistency: 0,
    });
  });

  it("uses the nonlinear burst consistency mapping", () => {
    expect(calculateConsistency([bucket(5), bucket(0)])).toBe(8.9);
    expect(calculateConsistency([bucket(5), bucket(5)])).toBe(100);
    expect(calculateConsistency([])).toBe(0);
  });

  it("rounds each interval burst before calculating consistency", () => {
    expect(
      calculateConsistency([
        bucket(7, { durationMs: 1_000 }),
        bucket(8, { durationMs: 1_024 }),
      ]),
    ).toBe(94.38);
  });

  it("rounds positive half-bursts away from zero like JavaScript", () => {
    expect(
      calculateConsistency([
        bucket(1, { durationMs: 1_000 }),
        bucket(1, { durationMs: 960 }),
      ]),
    ).toBe(96);
  });

  it("preserves the source operation order at floating half boundaries", () => {
    expect(Math.round(calculateWpm(23, 24_000))).toBe(11);
    expect(Math.round(calculateWpm(12, 768))).toBe(187);
  });

  it("reconstructs canonical graph boundaries in hundredth-millisecond ticks", () => {
    expect(
      bucketEndTimesMs([
        ...Array.from({ length: 6 }, () => bucket(0)),
        bucket(0, { durationMs: 680.19 }),
      ]),
    ).toEqual([1_000, 2_000, 3_000, 4_000, 5_000, 6_000, 6_680.19]);
  });
});
