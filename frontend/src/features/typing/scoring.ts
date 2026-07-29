import type { PaceBucket, ResultCounters } from "./types";

function roundTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const average = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    values.length;
  return Math.sqrt(variance);
}

function consistencyFromCov(coefficientOfVariation: number): number {
  const cov = coefficientOfVariation;
  return (
    100 *
    (1 -
      Math.tanh(cov + cov ** 3 / 3 + cov ** 5 / 5))
  );
}

/**
 * Keep the operation order aligned with the pinned Monkeytype source.
 * Algebraically equivalent multiplication can land on the other side of a
 * floating-point .5 boundary before Math.round.
 */
export function calculateWpm(
  characterCount: number,
  durationMs: number,
): number {
  if (durationMs <= 0) return 0;
  return characterCount / 5 / (durationMs / 1_000 / 60);
}

export function bucketEndTimesMs(
  buckets: readonly PaceBucket[],
): number[] {
  let hundredthMillisecondTicks = 0;
  return buckets.map((bucket) => {
    hundredthMillisecondTicks += Math.round(bucket.durationMs * 100);
    return hundredthMillisecondTicks / 100;
  });
}

export function calculateConsistency(buckets: readonly PaceBucket[]): number {
  const burst = buckets.map((bucket) =>
    Math.round(calculateWpm(bucket.typedCharacters, bucket.durationMs)),
  );
  const average = mean(burst);
  const value =
    average === 0
      ? 0
      : consistencyFromCov(standardDeviation(burst) / average);
  return Number.isFinite(value) ? roundTwo(value) : 0;
}

export function calculateMetrics(
  durationMs: number,
  counters: ResultCounters,
  buckets: readonly PaceBucket[],
): Pick<ResultCounters, never> & {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
} {
  const safeDuration = Math.max(1, durationMs);
  const denominator = counters.correctAttempts + counters.incorrectAttempts;

  return {
    wpm: roundTwo(calculateWpm(counters.correctCharacters, safeDuration)),
    rawWpm: roundTwo(calculateWpm(counters.typedCharacters, safeDuration)),
    accuracy:
      denominator === 0
        ? 100
        : roundTwo((counters.correctAttempts / denominator) * 100),
    consistency: calculateConsistency(buckets),
  };
}
