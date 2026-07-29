import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { createTypingState, typingReducer } from "../../src/features/typing/reducer";
import {
  bucketEndTimesMs,
  calculateConsistency,
  calculateWpm,
} from "../../src/features/typing/scoring";
import type {
  PaceBucket,
  Prompt,
  TestConfig,
  TypingAction,
} from "../../src/features/typing/types";

export interface TraceEvent {
  atUs: number;
  sequence: number;
  type: "insert" | "delete";
  wordIndex: number;
  grapheme: string;
}

export interface ParityTrace {
  version: "trace/1";
  id: string;
  config: {
    mode: "words" | "time";
    modeValue: number;
    punctuation: boolean;
    numbers: boolean;
  };
  prompt: readonly string[];
  completionAtUs: number;
  events: readonly TraceEvent[];
}

export interface ParityResult {
  version: "result/1";
  traceId: string;
  durationMs: number;
  counters: {
    typedCharacters: number;
    correctAttempts: number;
    incorrectAttempts: number;
    correctCharacters: number;
    incorrectCharacters: number;
    missingCharacters: number;
    extraAttempts: number;
  };
  metrics: {
    wpm: number;
    rawWpm: number;
    accuracy: number;
    consistency: number;
  };
  graph: {
    boundariesMs: number[];
    wpm: number[];
    raw: number[];
    burst: number[];
    errors: number[];
  };
}

export interface OracleBatch {
  version: "campaign-result/1";
  source: {
    repository: string;
    commit: string;
    adapter: string;
    durationResult: string;
  };
  results: ParityResult[];
}

function graphFromBuckets(buckets: readonly PaceBucket[]) {
  const boundariesMs = bucketEndTimesMs(buckets);
  const roundedWpm = (characters: number, durationMs: number) =>
    Math.round(calculateWpm(characters, durationMs));
  return {
    boundariesMs,
    wpm: buckets.map((bucket, index) => {
      const duration = boundariesMs[index] ?? 0;
      return roundedWpm(bucket.correctCharacters, duration);
    }),
    raw: buckets.map((bucket, index) => {
      const duration = boundariesMs[index] ?? 0;
      return roundedWpm(bucket.rawCharacters, duration);
    }),
    burst: buckets.map((bucket) =>
      roundedWpm(bucket.typedCharacters, bucket.durationMs),
    ),
    errors: buckets.map((bucket) => bucket.errors),
  };
}

export function runRill(trace: ParityTrace): ParityResult {
  const config: TestConfig = {
    ...trace.config,
    contentType: "words",
    language: "en",
    errorPolicy: "normal",
  };
  const prompt: Prompt = {
    id: trace.id,
    seed: 0,
    wordListVersion: "en-v1",
    generatorVersion: 1,
    language: "en",
    words: trace.prompt,
  };
  let state = createTypingState(config, prompt, trace.id);
  const startedAt = 10_000;
  for (const event of trace.events) {
    if (state.status === "completed") break;
    if (state.wordIndex !== event.wordIndex) {
      throw new Error(
        `${trace.id}: event ${String(event.sequence)} targets word ${String(event.wordIndex)}, Rill is on ${String(state.wordIndex)}.`,
      );
    }
    const now = startedAt + event.atUs / 1_000;
    const action: TypingAction =
      event.type === "insert"
        ? {
            type: "insert",
            grapheme: event.grapheme,
            now,
            wallNow: now,
          }
        : { type: "backspace", now, wallNow: now };
    state = typingReducer(state, action);
  }

  if (trace.config.mode === "time" && state.status !== "completed") {
    const now = startedAt + trace.completionAtUs / 1_000;
    state = typingReducer(state, { type: "tick", now, wallNow: now });
  }

  const result = state.result;
  if (result === null) {
    throw new Error(`${trace.id}: Rill did not complete the trace.`);
  }
  return {
    version: "result/1",
    traceId: trace.id,
    durationMs: result.durationMs,
    counters: {
      typedCharacters: result.typedCharacters,
      correctAttempts: result.correctAttempts,
      incorrectAttempts: result.incorrectAttempts,
      correctCharacters: result.correctCharacters,
      incorrectCharacters: result.incorrectCharacters,
      missingCharacters: result.missingCharacters,
      extraAttempts: result.extraAttempts,
    },
    metrics: {
      wpm: result.wpm,
      rawWpm: result.rawWpm,
      accuracy: result.accuracy,
      consistency: result.consistency,
    },
    graph: graphFromBuckets(result.paceBuckets),
  };
}

export function runOracleBatch(
  traces: readonly ParityTrace[],
  sourceRoot: string,
): OracleBatch {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [resolve("scripts/monkeytype-oracle-runner.mjs")],
      {
        cwd: process.cwd(),
        env: {
          MONKEYTYPE_SOURCE_ROOT: sourceRoot,
          PATH: process.env.PATH,
        },
        input: JSON.stringify({
          version: "campaign/1",
          traces,
        }),
        encoding: "utf8",
        timeout: 600_000,
        maxBuffer: 128 * 1024 * 1024,
      },
    ),
  ) as OracleBatch;
}

export interface Comparison {
  kind:
    | "equal"
    | "rill-rollover-correction"
    | "rill-terminal-rollover-correction"
    | "different";
  differences: string[];
}

function collectDifferences(
  left: unknown,
  right: unknown,
  path = "",
): string[] {
  if (Object.is(left, right)) return [];
  if (Array.isArray(left) && Array.isArray(right)) {
    const differences: string[] = [];
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      differences.push(
        ...collectDifferences(
          left[index],
          right[index],
          `${path}[${String(index)}]`,
        ),
      );
    }
    return differences;
  }
  if (
    typeof left === "object" &&
    left !== null &&
    typeof right === "object" &&
    right !== null
  ) {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    return [...new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)])]
      .sort()
      .flatMap((key) =>
        collectDifferences(
          leftRecord[key],
          rightRecord[key],
          path.length === 0 ? key : `${path}.${key}`,
        ),
      );
  }
  return [`${path}: Rill=${JSON.stringify(left)} oracle=${JSON.stringify(right)}`];
}

function samePrefix<T>(longer: readonly T[], shorter: readonly T[]): boolean {
  return shorter.every((value, index) => Object.is(longer[index], value));
}

function insertedCharactersByInterval(
  trace: ParityTrace,
  boundariesMs: readonly number[],
): number[] {
  let previousBoundaryUs = 0;
  return boundariesMs.map((boundaryMs, index) => {
    const cutoffUs =
      index === boundariesMs.length - 1
        ? trace.completionAtUs
        : boundaryMs * 1_000;
    const count = trace.events.filter(
      (event) =>
        event.type === "insert" &&
        event.atUs <= cutoffUs &&
        (index === 0
          ? event.atUs >= 0
          : event.atUs > previousBoundaryUs),
    ).length;
    previousBoundaryUs = boundaryMs * 1_000;
    return count;
  });
}

function incorrectInsertionsInInterval(
  trace: ParityTrace,
  startUs: number,
  endUs: number,
): number {
  const inputByWord = new Map<number, string[]>();
  let errors = 0;
  for (const event of trace.events) {
    if (event.atUs > endUs) break;
    const previousInput = inputByWord.get(event.wordIndex) ?? [];
    if (event.type === "delete") {
      inputByWord.set(event.wordIndex, previousInput.slice(0, -1));
      continue;
    }
    const target =
      trace.config.mode === "words" &&
      event.wordIndex === trace.prompt.length - 1
        ? trace.prompt[event.wordIndex] ?? ""
        : `${trace.prompt[event.wordIndex] ?? ""} `;
    const correct = Array.from(target)[previousInput.length] === event.grapheme;
    if ((event.atUs > startUs || (startUs === 0 && event.atUs === 0)) && !correct) {
      errors += 1;
    }
    inputByWord.set(event.wordIndex, [...previousInput, event.grapheme]);
  }
  return errors;
}

function expectedConsistency(
  trace: ParityTrace,
  boundariesMs: readonly number[],
): number {
  const insertedCharacters = insertedCharactersByInterval(trace, boundariesMs);
  let previousBoundary = 0;
  return calculateConsistency(
    boundariesMs.map((boundary, index) => {
      const durationMs = boundary - previousBoundary;
      previousBoundary = boundary;
      return {
        durationMs,
        typedCharacters: insertedCharacters[index] ?? 0,
        correctCharacters: 0,
        rawCharacters: 0,
        errors: 0,
      };
    }),
  );
}

function isRillRolloverCorrection(
  trace: ParityTrace,
  rill: ParityResult,
  oracle: ParityResult,
): boolean {
  if (trace.config.mode !== "words") return false;
  const rawEndMs = trace.completionAtUs / 1_000;
  const normalizedEndMs = Math.round(rawEndMs / 10) * 10;
  if (
    normalizedEndMs <= rawEndMs ||
    normalizedEndMs % 1_000 !== 0 ||
    normalizedEndMs - rawEndMs > 5
  ) {
    return false;
  }

  const withoutGraphAndConsistency = (result: ParityResult) => ({
    ...result,
    metrics: { ...result.metrics, consistency: 0 },
    graph: {
      boundariesMs: [],
      wpm: [],
      raw: [],
      burst: [],
      errors: [],
    },
  });
  if (
    collectDifferences(
      withoutGraphAndConsistency(rill),
      withoutGraphAndConsistency(oracle),
    ).length > 0
  ) {
    return false;
  }

  const finalIndex = rill.graph.boundariesMs.length - 1;
  const previousBoundary = rill.graph.boundariesMs[finalIndex - 1] ?? 0;
  const finalDuration = normalizedEndMs - previousBoundary;
  const insertedCharacters = insertedCharactersByInterval(
    trace,
    rill.graph.boundariesMs,
  );
  const expectedWpm = Math.round(
    calculateWpm(rill.counters.correctCharacters, normalizedEndMs),
  );
  const expectedRaw = Math.round(
    calculateWpm(rill.counters.typedCharacters, normalizedEndMs),
  );
  const expectedBurst = Math.round(
    calculateWpm(insertedCharacters[finalIndex] ?? 0, finalDuration),
  );
  const expectedErrors = incorrectInsertionsInInterval(
    trace,
    previousBoundary * 1_000,
    trace.completionAtUs,
  );
  const graphSeriesHaveExpectedLength = [
    rill.graph.wpm,
    rill.graph.raw,
    rill.graph.burst,
    rill.graph.errors,
  ].every((series) => series.length === rill.graph.boundariesMs.length);

  return (
    finalIndex >= 0 &&
    rill.durationMs === normalizedEndMs &&
    oracle.durationMs === normalizedEndMs &&
    rill.graph.boundariesMs.length === oracle.graph.boundariesMs.length + 1 &&
    rill.graph.boundariesMs.at(-1) === normalizedEndMs &&
    graphSeriesHaveExpectedLength &&
    samePrefix(rill.graph.boundariesMs, oracle.graph.boundariesMs) &&
    samePrefix(rill.graph.wpm, oracle.graph.wpm) &&
    samePrefix(rill.graph.raw, oracle.graph.raw) &&
    samePrefix(rill.graph.burst, oracle.graph.burst) &&
    samePrefix(rill.graph.errors, oracle.graph.errors) &&
    rill.graph.wpm[finalIndex] === expectedWpm &&
    rill.graph.raw[finalIndex] === expectedRaw &&
    rill.graph.burst[finalIndex] === expectedBurst &&
    rill.graph.errors[finalIndex] === expectedErrors &&
    rill.metrics.consistency ===
      expectedConsistency(trace, rill.graph.boundariesMs)
  );
}

function isRillTerminalRolloverCorrection(
  trace: ParityTrace,
  rill: ParityResult,
  oracle: ParityResult,
): boolean {
  if (trace.config.mode !== "words") return false;
  const rawEndMs = trace.completionAtUs / 1_000;
  const normalizedEndMs = Math.round(rawEndMs / 10) * 10;
  const terminalEvent = trace.events.at(-1);
  if (
    rawEndMs <= normalizedEndMs ||
    normalizedEndMs % 1_000 !== 0 ||
    rawEndMs - normalizedEndMs >= 5 ||
    terminalEvent?.type !== "insert" ||
    terminalEvent.atUs !== trace.completionAtUs
  ) {
    return false;
  }

  const neutralizeFinalSample = (values: readonly number[]) =>
    values.map((value, index) => (index === values.length - 1 ? 0 : value));
  const withoutCorrectedTerminalSample = (result: ParityResult) => ({
    ...result,
    metrics: { ...result.metrics, consistency: 0 },
    graph: {
      boundariesMs: result.graph.boundariesMs,
      wpm: neutralizeFinalSample(result.graph.wpm),
      raw: neutralizeFinalSample(result.graph.raw),
      burst: neutralizeFinalSample(result.graph.burst),
      errors: result.graph.errors,
    },
  });
  if (
    collectDifferences(
      withoutCorrectedTerminalSample(rill),
      withoutCorrectedTerminalSample(oracle),
    ).length > 0
  ) {
    return false;
  }

  const finalIndex = rill.graph.boundariesMs.length - 1;
  const previousBoundary = rill.graph.boundariesMs[finalIndex - 1] ?? 0;
  const finalDuration = normalizedEndMs - previousBoundary;
  const finalInsertCount = trace.events.filter(
    (event) =>
      event.type === "insert" &&
      event.atUs <= trace.completionAtUs &&
      (finalIndex === 0
        ? event.atUs >= 0
        : event.atUs > previousBoundary * 1_000),
  ).length;
  const expectedWpm = Math.round(
    calculateWpm(rill.counters.correctCharacters, normalizedEndMs),
  );
  const expectedRaw = Math.round(
    calculateWpm(rill.counters.typedCharacters, normalizedEndMs),
  );
  const expectedBurst = Math.round(
    calculateWpm(finalInsertCount, finalDuration),
  );
  const recomputedConsistency = expectedConsistency(
    trace,
    rill.graph.boundariesMs,
  );
  return (
    finalIndex >= 0 &&
    rill.durationMs === normalizedEndMs &&
    oracle.durationMs === normalizedEndMs &&
    rill.graph.wpm[finalIndex] === expectedWpm &&
    rill.graph.raw[finalIndex] === expectedRaw &&
    rill.graph.burst[finalIndex] === expectedBurst &&
    rill.metrics.consistency === recomputedConsistency &&
    collectDifferences(rill, oracle).some((difference) =>
      [
        `graph.wpm[${String(finalIndex)}]`,
        `graph.raw[${String(finalIndex)}]`,
        `graph.burst[${String(finalIndex)}]`,
      ].some((path) => difference.startsWith(`${path}:`)),
    )
  );
}

export function compareResults(
  trace: ParityTrace,
  rill: ParityResult,
  oracle: ParityResult,
): Comparison {
  const differences = collectDifferences(rill, oracle);
  if (differences.length === 0) {
    return { kind: "equal", differences: [] };
  }
  if (isRillRolloverCorrection(trace, rill, oracle)) {
    return { kind: "rill-rollover-correction", differences };
  }
  if (isRillTerminalRolloverCorrection(trace, rill, oracle)) {
    return { kind: "rill-terminal-rollover-correction", differences };
  }
  return { kind: "different", differences };
}
