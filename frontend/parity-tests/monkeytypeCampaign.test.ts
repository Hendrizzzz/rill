import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  compareResults,
  runOracleBatch,
  runTypethock,
  type ParityResult,
  type ParityTrace,
} from "./support/parityHarness";
import {
  coverageTags,
  descriptorArbitrary,
  TARGETED_DESCRIPTORS,
  traceFromDescriptor,
  type TraceDescriptor,
} from "./support/traceGenerator";

const DEFAULT_SEED = 20_260_727;
const DEFAULT_RUNS = 10_000;
const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const parityProgram = JSON.parse(
  readFileSync(
    resolve(repositoryRoot, "docs", "testing", "parity-program.json"),
    "utf8",
  ),
) as {
  evidence: {
    defaultPath: string;
    sourceFiles: string[];
  };
};
const retainedEvidencePath = resolve(
  repositoryRoot,
  parityProgram.evidence.defaultPath,
);
const REQUIRED_COVERAGE = [
  "mode:words",
  "mode:time",
  "strategy:perfect",
  "strategy:corrected-substitution",
  "strategy:corrected-extra",
  "strategy:retained-substitution",
  "strategy:retained-extra",
  "strategy:missing-suffix",
  "timing:uniform",
  "timing:bursts",
  "timing:front-loaded",
  "timing:back-loaded",
  "timing:exact-second",
  "timing:duplicate",
  "timing:exact-second-event",
  "duration:subsecond",
  "duration:long",
  "duration:rollover-window",
  "duration:terminal-rollover-window",
  "content:punctuation",
  "content:numbers",
] as const;

function isInside(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path !== "" && !path.startsWith(`..${sep}`) && path !== "..";
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function sourceDigest(): string {
  const hash = createHash("sha256");
  for (const path of [...parityProgram.evidence.sourceFiles].sort()) {
    const absolutePath = resolve(repositoryRoot, path);
    hash.update(path.replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(readFileSync(absolutePath));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function writeJsonAtomically(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${String(process.pid)}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      flag: "wx",
    });
    renameSync(temporaryPath, path);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

function positiveIntegerFromEnvironment(
  name: string,
  fallback: number,
): number {
  const value = process.env[name];
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function sourceRoot(): string {
  const root = process.env.MONKEYTYPE_SOURCE_ROOT;
  if (!root) {
    throw new Error("MONKEYTYPE_SOURCE_ROOT is required for the parity campaign.");
  }
  return root;
}

function replayTrace(): ParityTrace | undefined {
  const path = process.env.PARITY_REPLAY_TRACE;
  return path === undefined
    ? undefined
    : (JSON.parse(readFileSync(resolve(path), "utf8")) as ParityTrace);
}

function cloneResult(result: ParityResult): ParityResult {
  return JSON.parse(JSON.stringify(result)) as ParityResult;
}

function shrinkRandomFailure(
  seed: number,
  failureIndex: number,
  descriptors: readonly TraceDescriptor[],
  oracleResults: readonly ParityResult[],
  oracleRoot: string,
) {
  const randomFailureIndex = failureIndex - TARGETED_DESCRIPTORS.length;
  if (randomFailureIndex < 0) {
    return {
      status: "targeted-case",
      reason: "Targeted boundary vectors are already minimal descriptors.",
    };
  }

  const cachedByDescriptor = new Map<string, ParityResult>();
  descriptors
    .slice(TARGETED_DESCRIPTORS.length)
    .forEach((descriptor, randomIndex) => {
      const result =
        oracleResults[TARGETED_DESCRIPTORS.length + randomIndex];
      if (result !== undefined) {
        cachedByDescriptor.set(JSON.stringify(descriptor), result);
      }
    });

  const details = fc.check(
    fc.property(descriptorArbitrary, (descriptor) => {
      const trace = traceFromDescriptor(descriptor, "shrink-candidate");
      const cached = cachedByDescriptor.get(JSON.stringify(descriptor));
      const oracleResult =
        cached === undefined
          ? runOracleBatch([trace], oracleRoot).results[0]
          : { ...cached, traceId: trace.id };
      if (oracleResult === undefined) return false;
      return compareResults(trace, runTypethock(trace), oracleResult).kind !== "different";
    }),
    {
      seed,
      numRuns: randomFailureIndex + 1,
      endOnFailure: true,
      verbose: 1,
    },
  );
  const descriptor = details.counterexample?.[0];
  if (!details.failed || descriptor === undefined) {
    return {
      status: "unreproduced",
      reason:
        "The failing sampled descriptor did not reproduce in fast-check property replay.",
    };
  }
  const trace = traceFromDescriptor(descriptor, "shrunk-failure");
  const oracleResult = runOracleBatch([trace], oracleRoot).results[0];
  const comparison =
    oracleResult === undefined
      ? { kind: "different" as const, differences: ["Oracle returned no result."] }
      : compareResults(trace, runTypethock(trace), oracleResult);
  return {
    status: "shrunk",
    path: details.counterexamplePath,
    numRuns: details.numRuns,
    numShrinks: details.numShrinks,
    descriptor,
    trace,
    differences: comparison.differences,
  };
}

describe("pinned Monkeytype deterministic parity campaign", () => {
  it("retains its default evidence outside runner-owned output", () => {
    const evidenceRoot = resolve(
      repositoryRoot,
      "docs",
      "testing",
      "evidence",
    );
    const playwrightOutput = resolve(repositoryRoot, "frontend", "test-results");
    expect(isInside(evidenceRoot, retainedEvidencePath)).toBe(true);
    expect(isInside(playwrightOutput, retainedEvidencePath)).toBe(false);
  });

  it(
    "compares every requested field across stratified and seeded traces",
    () => {
      const seed = positiveIntegerFromEnvironment("PARITY_SEED", DEFAULT_SEED);
      const requestedRuns = positiveIntegerFromEnvironment(
        "PARITY_RUNS",
        DEFAULT_RUNS,
      );
      const replay = replayTrace();
      const randomRuns = Math.max(0, requestedRuns - TARGETED_DESCRIPTORS.length);
      const randomDescriptors =
        replay === undefined
          ? fc.sample(descriptorArbitrary, {
              seed,
              numRuns: randomRuns,
            })
          : [];
      const descriptors: TraceDescriptor[] = [
        ...TARGETED_DESCRIPTORS,
        ...randomDescriptors,
      ].slice(0, requestedRuns);
      const traces =
        replay === undefined
          ? descriptors.map((descriptor, index) =>
              traceFromDescriptor(
                descriptor,
                index < TARGETED_DESCRIPTORS.length
                  ? `targeted-${String(index).padStart(3, "0")}`
                  : `seed-${String(seed)}-case-${String(index).padStart(5, "0")}`,
              ),
            )
          : [replay];
      const oracleRoot = sourceRoot();
      const oracle = runOracleBatch(traces, oracleRoot);
      expect(oracle.results).toHaveLength(traces.length);

      const coverage = new Map<string, number>();
      descriptors.forEach((descriptor, index) => {
        const trace = traces[index];
        if (trace === undefined) return;
        coverageTags(descriptor, trace).forEach((tag) => {
          coverage.set(tag, (coverage.get(tag) ?? 0) + 1);
        });
      });
      const classifications = {
        equal: 0,
        "typethock-rollover-correction": 0,
        "typethock-terminal-rollover-correction": 0,
        different: 0,
      };
      let firstFailure:
        | {
            index: number;
            trace: ParityTrace;
            descriptor: TraceDescriptor | undefined;
            differences: string[];
          }
        | undefined;

      traces.forEach((trace, index) => {
        const oracleResult = oracle.results[index];
        if (oracleResult === undefined) {
          throw new Error(`Oracle omitted result ${String(index)}.`);
        }
        const comparison = compareResults(trace, runTypethock(trace), oracleResult);
        classifications[comparison.kind] += 1;
        if (comparison.kind === "different" && firstFailure === undefined) {
          firstFailure = {
            index,
            trace,
            descriptor: descriptors[index],
            differences: comparison.differences,
          };
        }
      });

      const evidencePath = resolve(
        process.env.PARITY_EVIDENCE_PATH ??
          (replay === undefined
            ? retainedEvidencePath
            : resolve(dirname(retainedEvidencePath), "replays", `${replay.id}.json`)),
      );
      const missingCoverage =
        replay === undefined
          ? REQUIRED_COVERAGE.filter((tag) => !coverage.has(tag))
          : [];
      const shrink =
        firstFailure === undefined
          ? null
          : shrinkRandomFailure(
              seed,
              firstFailure.index,
              descriptors,
              oracle.results,
              oracleRoot,
            );
      const packageMetadata = JSON.parse(
        readFileSync(resolve(repositoryRoot, "frontend", "package.json"), "utf8"),
      ) as {
        devDependencies: Record<string, string>;
      };
      const evidenceWithoutDigest = {
        version: "typethock-parity-campaign/1",
        generatedAt: new Date().toISOString(),
        seed,
        requestedRuns,
        executedRuns: traces.length,
        replayTrace: process.env.PARITY_REPLAY_TRACE ?? null,
        source: oracle.source,
        harness: {
          typethockSourceSha256: sourceDigest(),
          tooling: {
            node: process.version,
            vitest: packageMetadata.devDependencies.vitest,
            fastCheck: packageMetadata.devDependencies["fast-check"],
          },
        },
        traceSchema: "trace/1",
        resultSchema: "result/1",
        timestampUnit: "integer microseconds",
        timestampTieBreak: "ascending explicit sequence",
        comparedFields: [
          "durationMs",
          "counters.typedCharacters",
          "counters.correctAttempts",
          "counters.incorrectAttempts",
          "counters.correctCharacters",
          "counters.incorrectCharacters",
          "counters.missingCharacters",
          "counters.extraAttempts",
          "metrics.wpm",
          "metrics.rawWpm",
          "metrics.accuracy",
          "metrics.consistency",
          "graph.boundariesMs",
          "graph.wpm",
          "graph.raw",
          "graph.burst",
          "graph.errors",
        ],
        classifications,
        allowlist: {
          rules: [
            {
              id: "TM-023",
              description:
                "TypeThock retains one normalized final graph bucket when a word test rounds upward to an exact second by at most 5ms; all non-graph fields and graph prefixes must match.",
            },
            {
              id: "TM-024",
              description:
                "TypeThock includes terminal input in the existing final graph bucket when a word test rounds downward to an exact second by less than 5ms; only recomputed consistency and the recomputed final WPM/raw/burst sample may differ.",
            },
          ],
        },
        coverage: Object.fromEntries([...coverage.entries()].sort()),
        missingCoverage,
        firstFailure: firstFailure ?? null,
        shrink,
        replayCommands: {
          powershell:
            "$env:PARITY_REPLAY_TRACE='<trace.json>'; npm.cmd run test:parity:campaign",
          posix:
            "PARITY_REPLAY_TRACE='<trace.json>' npm run test:parity:campaign",
        },
      };
      const { generatedAt: _generatedAt, ...digestPayload } =
        evidenceWithoutDigest;
      void _generatedAt;
      const evidence = {
        ...evidenceWithoutDigest,
        campaignDigest: sha256(canonicalJson(digestPayload)),
      };
      writeJsonAtomically(evidencePath, evidence);
      if (firstFailure !== undefined) {
        const failureTracePath = resolve(
          dirname(evidencePath),
          "first-failing-trace.json",
        );
        writeJsonAtomically(failureTracePath, firstFailure.trace);
        if (shrink?.status === "shrunk") {
          writeJsonAtomically(
            resolve(dirname(evidencePath), "shrunk-failing-trace.json"),
            shrink.trace,
          );
        }
        throw new Error(
          `Parity difference at case ${String(firstFailure.index)}. Trace: ${failureTracePath}\n${firstFailure.differences.slice(0, 20).join("\n")}`,
        );
      }
      expect(missingCoverage).toEqual([]);
      expect(classifications.different).toBe(0);
      expect(
        classifications.equal +
          classifications["typethock-rollover-correction"] +
          classifications["typethock-terminal-rollover-correction"],
      ).toBe(traces.length);
    },
    600_000,
  );

  it("detects a mutation in a required field", () => {
    const trace = traceFromDescriptor(
      TARGETED_DESCRIPTORS[0] as TraceDescriptor,
      "mutation-sentinel",
    );
    const baseline = runTypethock(trace);
    const mutant = cloneResult(baseline);
    mutant.metrics.wpm += 1;
    const comparison = compareResults(trace, baseline, mutant);
    expect(comparison.kind).toBe("different");
    expect(comparison.differences.some((line) => line.startsWith("metrics.wpm:"))).toBe(true);
  });

  it("recomputes every allowed rollover sample field", () => {
    const descriptor = TARGETED_DESCRIPTORS.find(
      (candidate) =>
        candidate.mode === "words" && candidate.durationUs === 1_995_000,
    );
    expect(descriptor).toBeDefined();
    if (descriptor === undefined) return;

    const trace = traceFromDescriptor(descriptor, "rollover-sentinel");
    const oracleResult = runOracleBatch([trace], sourceRoot()).results[0];
    expect(oracleResult).toBeDefined();
    if (oracleResult === undefined) return;

    const baseline = runTypethock(trace);
    expect(compareResults(trace, baseline, oracleResult).kind).toBe(
      "typethock-rollover-correction",
    );

    for (const series of ["wpm", "raw", "burst", "errors"] as const) {
      const mutant = cloneResult(baseline);
      const finalIndex = mutant.graph[series].length - 1;
      mutant.graph[series][finalIndex] =
        (mutant.graph[series][finalIndex] ?? 0) + 1;
      expect(
        compareResults(trace, mutant, oracleResult).kind,
        `mutated graph.${series}`,
      ).toBe("different");
    }

    const consistencyMutant = cloneResult(baseline);
    consistencyMutant.metrics.consistency += 0.01;
    expect(compareResults(trace, consistencyMutant, oracleResult).kind).toBe(
      "different",
    );
  });

  it("keeps the terminal-rollover correction narrow", () => {
    const descriptor = TARGETED_DESCRIPTORS.find(
      (candidate) =>
        candidate.mode === "words" && candidate.durationUs === 1_000_010,
    );
    expect(descriptor).toBeDefined();
    if (descriptor === undefined) return;

    const trace = traceFromDescriptor(descriptor, "terminal-rollover-sentinel");
    const oracleResult = runOracleBatch([trace], sourceRoot()).results[0];
    expect(oracleResult).toBeDefined();
    if (oracleResult === undefined) return;

    const baseline = runTypethock(trace);
    expect(compareResults(trace, baseline, oracleResult).kind).toBe(
      "typethock-terminal-rollover-correction",
    );

    const aggregateMutant = cloneResult(baseline);
    aggregateMutant.counters.correctAttempts += 1;
    expect(compareResults(trace, aggregateMutant, oracleResult).kind).toBe(
      "different",
    );

    const finalSampleMutant = cloneResult(baseline);
    const finalIndex = finalSampleMutant.graph.wpm.length - 1;
    finalSampleMutant.graph.wpm[finalIndex] =
      (finalSampleMutant.graph.wpm[finalIndex] ?? 0) + 1;
    expect(compareResults(trace, finalSampleMutant, oracleResult).kind).toBe(
      "different",
    );
  });
});
