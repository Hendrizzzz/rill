import type { PaceBucket, ResultCounters } from "./types";
import {
  buildPaceAnalysisBuckets,
  calculateBucketWpm,
} from "./paceAnalysis";

function roundTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateConsistency(buckets: readonly PaceBucket[]): number {
  const analysisBuckets = buildPaceAnalysisBuckets(buckets);
  if (analysisBuckets.length <= 1) {
    return 100;
  }

  const pace = analysisBuckets.map(calculateBucketWpm);
  const mean = pace.reduce((sum, value) => sum + value, 0) / pace.length;
  if (mean === 0) {
    return 100;
  }

  const variance =
    pace.reduce((sum, value) => sum + (value - mean) ** 2, 0) / pace.length;
  const standardDeviation = Math.sqrt(variance);
  return roundTwo(100 * Math.max(0, 1 - standardDeviation / Math.max(mean, 1)));
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
  const minutes = safeDuration / 60_000;
  const denominator = counters.typedCharacters + counters.missingCharacters;

  return {
    wpm: roundTwo(counters.correctCharacters / 5 / minutes),
    rawWpm: roundTwo(counters.typedCharacters / 5 / minutes),
    accuracy:
      denominator === 0
        ? 100
        : roundTwo((counters.correctAttempts / denominator) * 100),
    consistency: calculateConsistency(buckets),
  };
}

export function buildPaceBuckets(
  durationMs: number,
  paceCounts: readonly number[],
): PaceBucket[] {
  const safeDuration = Math.max(1, Math.round(durationMs));
  const count = Math.max(1, Math.ceil(safeDuration / 1_000));
  const buckets: PaceBucket[] = [];

  for (let index = 0; index < count; index += 1) {
    const isFinal = index === count - 1;
    const duration = isFinal
      ? safeDuration - (count - 1) * 1_000
      : 1_000;
    buckets.push({
      durationMs: duration,
      typedCharacters: paceCounts[index] ?? 0,
    });
  }

  return buckets;
}
