import type { PaceBucket } from "./types";

export const MINIMUM_PACE_ANALYSIS_WINDOW_MS = 250;

export function buildPaceAnalysisBuckets(
  buckets: readonly PaceBucket[],
): PaceBucket[] {
  const analysisBuckets = buckets.map((bucket) => ({ ...bucket }));
  if (analysisBuckets.length < 2) {
    return analysisBuckets;
  }

  const finalBucket = analysisBuckets.at(-1);
  const previousBucket = analysisBuckets.at(-2);
  if (
    finalBucket === undefined ||
    previousBucket === undefined ||
    finalBucket.durationMs <= 0 ||
    finalBucket.durationMs >= MINIMUM_PACE_ANALYSIS_WINDOW_MS ||
    previousBucket.durationMs <= 0
  ) {
    return analysisBuckets;
  }

  analysisBuckets.splice(-2, 2, {
    durationMs: previousBucket.durationMs + finalBucket.durationMs,
    typedCharacters:
      previousBucket.typedCharacters + finalBucket.typedCharacters,
  });
  return analysisBuckets;
}

export function calculateBucketWpm(bucket: PaceBucket): number {
  return bucket.durationMs > 0
    ? (bucket.typedCharacters * 12_000) / bucket.durationMs
    : 0;
}
