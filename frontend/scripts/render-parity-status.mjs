import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..", "..");
const catalogPath = resolve(
  repositoryRoot,
  "docs",
  "testing",
  "parity-program.json",
);
const outputPath = resolve(
  process.env.PARITY_STATUS_PATH ??
    resolve(repositoryRoot, "docs", "testing", "PARITY_STATUS.md"),
);

function parseJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function isInside(parent, child) {
  const path = relative(parent, child);
  return path !== "" && !path.startsWith(`..${sep}`) && path !== "..";
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sourceDigest(catalog) {
  const hash = createHash("sha256");
  for (const path of [...catalog.evidence.sourceFiles].sort()) {
    const absolutePath = resolve(repositoryRoot, path);
    hash.update(path.replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(readFileSync(absolutePath));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function validateCatalog(catalog) {
  if (catalog?.schema !== "typethock-parity-program/1") {
    throw new Error("Unsupported or missing parity-program schema.");
  }
  if (!Array.isArray(catalog.lanes) || catalog.lanes.length !== 3) {
    throw new Error("Parity program must define exactly three evidence lanes.");
  }
  if (
    typeof catalog.evidence?.defaultPath !== "string" ||
    !Array.isArray(catalog.evidence?.sourceFiles) ||
    catalog.evidence.sourceFiles.length === 0 ||
    catalog.evidence.sourceFiles.some((path) => typeof path !== "string")
  ) {
    throw new Error("Parity program must define retained evidence ownership.");
  }
  const retainedPath = resolve(repositoryRoot, catalog.evidence.defaultPath);
  const evidenceRoot = resolve(repositoryRoot, "docs", "testing", "evidence");
  const playwrightOutput = resolve(repositoryRoot, "frontend", "test-results");
  if (
    !isInside(evidenceRoot, retainedPath) ||
    isInside(playwrightOutput, retainedPath)
  ) {
    throw new Error(
      "Default parity evidence must be retained under docs/testing/evidence and outside Playwright output.",
    );
  }
  const identifiers = new Set();
  for (const lane of catalog.lanes) {
    if (
      typeof lane.id !== "string" ||
      typeof lane.name !== "string" ||
      typeof lane.claim !== "string" ||
      typeof lane.blocking !== "boolean" ||
      !Array.isArray(lane.cases)
    ) {
      throw new Error("Malformed parity lane.");
    }
    if (identifiers.has(lane.id)) {
      throw new Error(`Duplicate parity identifier: ${lane.id}.`);
    }
    identifiers.add(lane.id);
    for (const testCase of lane.cases) {
      if (
        typeof testCase.id !== "string" ||
        typeof testCase.name !== "string" ||
        typeof testCase.command !== "string"
      ) {
        throw new Error(`Malformed case in lane ${lane.id}.`);
      }
      if (identifiers.has(testCase.id)) {
        throw new Error(`Duplicate parity identifier: ${testCase.id}.`);
      }
      identifiers.add(testCase.id);
    }
  }
  if (
    !catalog.lanes.some((lane) => lane.id === "exact-engine") ||
    !catalog.lanes.some((lane) => lane.id === "live-browser") ||
    !catalog.lanes.some((lane) => lane.id === "typethock-quality")
  ) {
    throw new Error("Required parity lanes are missing.");
  }
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function validateEvidence(evidence, catalog) {
  if (evidence?.version !== "typethock-parity-campaign/1") {
    throw new Error("Unsupported or missing parity campaign schema.");
  }
  if (evidence.source?.commit !== catalog.oracle.commit) {
    throw new Error("Campaign evidence uses the wrong Monkeytype commit.");
  }
  if (
    evidence.source?.adapter !== "trace-1-to-monkeytype-event-log-2" ||
    evidence.traceSchema !== "trace/1" ||
    evidence.resultSchema !== "result/1" ||
    evidence.timestampUnit !== "integer microseconds" ||
    evidence.timestampTieBreak !== "ascending explicit sequence"
  ) {
    throw new Error("Campaign evidence uses an unexpected trace contract.");
  }
  if (
    typeof evidence.generatedAt !== "string" ||
    !Number.isFinite(Date.parse(evidence.generatedAt)) ||
    !Number.isSafeInteger(evidence.seed) ||
    evidence.seed < 1 ||
    !Number.isSafeInteger(evidence.requestedRuns) ||
    evidence.requestedRuns < 1 ||
    !Number.isSafeInteger(evidence.executedRuns) ||
    evidence.executedRuns < 1 ||
    (evidence.replayTrace === null &&
      evidence.executedRuns > evidence.requestedRuns)
  ) {
    throw new Error("Campaign evidence has invalid run metadata.");
  }
  const classificationNames = [
    "equal",
    "typethock-rollover-correction",
    "typethock-terminal-rollover-correction",
    "different",
  ];
  if (
    classificationNames.some(
      (name) =>
        !Number.isSafeInteger(evidence.classifications?.[name]) ||
        evidence.classifications[name] < 0,
    ) ||
    !Array.isArray(evidence.missingCoverage) ||
    evidence.missingCoverage.some((name) => typeof name !== "string") ||
    evidence.coverage === null ||
    typeof evidence.coverage !== "object" ||
    Object.values(evidence.coverage).some(
      (count) => !Number.isSafeInteger(count) || count < 0,
    )
  ) {
    throw new Error("Campaign evidence is missing required fields.");
  }
  const classified =
    evidence.classifications.equal +
    evidence.classifications["typethock-rollover-correction"] +
    evidence.classifications["typethock-terminal-rollover-correction"] +
    evidence.classifications.different;
  if (classified !== evidence.executedRuns) {
    throw new Error("Campaign classifications do not equal executed runs.");
  }
  const allowlistIds = evidence.allowlist?.rules?.map((rule) => rule.id);
  if (
    !Array.isArray(allowlistIds) ||
    allowlistIds.length !== 2 ||
    allowlistIds[0] !== "TM-023" ||
    allowlistIds[1] !== "TM-024"
  ) {
    throw new Error("Campaign evidence has an unexpected difference allowlist.");
  }
  if (
    evidence.harness?.typethockSourceSha256 !== sourceDigest(catalog) ||
    typeof evidence.harness?.tooling?.node !== "string" ||
    typeof evidence.harness?.tooling?.vitest !== "string" ||
    typeof evidence.harness?.tooling?.fastCheck !== "string"
  ) {
    throw new Error("Campaign evidence is stale or lacks harness provenance.");
  }
  const { generatedAt: _generatedAt, campaignDigest, ...digestPayload } =
    evidence;
  if (
    typeof campaignDigest !== "string" ||
    campaignDigest !== digest(canonicalJson(digestPayload))
  ) {
    throw new Error("Campaign deterministic digest does not match its payload.");
  }
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

const catalog = parseJson(catalogPath);
validateCatalog(catalog);
if (process.argv.includes("--validate-catalog")) {
  process.stdout.write(
    `Validated ${String(catalog.lanes.length)} lanes and ${String(
      catalog.lanes.reduce((sum, lane) => sum + lane.cases.length, 0),
    )} cases.\n`,
  );
  process.exit(0);
}
const evidencePath = resolve(
  process.env.PARITY_EVIDENCE_PATH ??
    resolve(repositoryRoot, catalog.evidence.defaultPath),
);
if (!existsSync(evidencePath)) {
  throw new Error(`Parity campaign evidence not found: ${evidencePath}`);
}
const evidence = parseJson(evidencePath);
validateEvidence(evidence, catalog);

const exactPassed =
  evidence.executedRuns >= 10_000 &&
  evidence.classifications.different === 0 &&
  evidence.missingCoverage.length === 0;
const lines = [
  "<!-- Generated by frontend/scripts/render-parity-status.mjs. -->",
  "# TypeThock parity program status",
  "",
  `Generated from campaign evidence at \`${evidence.generatedAt}\`.`,
  "",
  "## Claim boundary",
  "",
  "The lanes below are intentionally independent. Exact engine evidence proves",
  "shared-trace mathematics. Public-site Browser evidence checks representative",
  "integration behavior without claiming identical clocks. TypeThock quality evidence",
  "covers this product's own accessibility, security, persistence, and deployment.",
  "",
  "## Lane summary",
  "",
  "| Lane | Gate | Current evidence |",
  "| --- | --- | --- |",
  `| Exact numerical parity | Blocking | ${exactPassed ? "PASS" : "NOT PASS"}: ${String(evidence.executedRuns)} traces; ${String(evidence.classifications.different)} unapproved differences |`,
  "| Public-site integration | Advisory | Recorded separately per live capture; never inferred from engine output |",
  "| TypeThock quality/security/deployment | Blocking | Recorded by the clean build, browser, backend, scan, and container runs |",
  "",
  "## Exact-engine campaign",
  "",
  `- Seed: \`${String(evidence.seed)}\``,
  `- Monkeytype commit: \`${evidence.source.commit}\``,
  `- Adapter: \`${evidence.source.adapter}\``,
  `- Executed: **${String(evidence.executedRuns)}**`,
  `- Exact matches: **${String(evidence.classifications.equal)}**`,
  `- Approved TM-023 rollover corrections: **${String(evidence.classifications["typethock-rollover-correction"])}**`,
  `- Approved TM-024 terminal-rollover corrections: **${String(evidence.classifications["typethock-terminal-rollover-correction"])}**`,
  `- Unapproved differences: **${String(evidence.classifications.different)}**`,
  `- Missing mandatory coverage bins: **${String(evidence.missingCoverage.length)}**`,
  `- Evidence SHA-256: \`${sha256(evidencePath)}\``,
  `- Deterministic campaign digest: \`${evidence.campaignDigest}\``,
  `- TypeThock/harness source SHA-256: \`${evidence.harness.typethockSourceSha256}\``,
  `- Tooling: Node \`${evidence.harness.tooling.node}\`, Vitest \`${evidence.harness.tooling.vitest}\`, fast-check \`${evidence.harness.tooling.fastCheck}\``,
  "",
  "The TM-023 rule accepts exactly one additional final TypeThock graph bucket when a",
  "word-test duration rounds upward to a whole second by at most 5 ms. Every",
  "non-graph field and every preceding graph sample must still match.",
  "",
  "The TM-024 rule accepts a changed final graph sample (and derived consistency)",
  "when a word-test terminal input lands less than 5 ms after an exact second",
  "that the aggregate duration rounds back to. Boundaries, earlier samples, all",
  "counters, and all other aggregate metrics must still match. The accepted final",
  "values are recomputed independently from the shared trace.",
  "",
  "## Coverage bins",
  "",
  "| Bin | Traces |",
  "| --- | ---: |",
  ...Object.entries(evidence.coverage).map(
    ([name, count]) => `| ${escapeCell(name)} | ${String(count)} |`,
  ),
  "",
  "## Catalog",
  "",
  "| Lane | Case | Purpose | Reproduction |",
  "| --- | --- | --- | --- |",
  ...catalog.lanes.flatMap((lane) =>
    lane.cases.map(
      (testCase) =>
        `| ${escapeCell(lane.name)} | ${escapeCell(testCase.id)} | ${escapeCell(testCase.name)} | \`${escapeCell(testCase.command)}\` |`,
    ),
  ),
  "",
  "## Remaining claim limits",
  "",
  "- Public Monkeytype does not expose a controllable clock and is not the",
  "  mathematical oracle.",
  "- Physical-device, browser/assistive-technology, and production-network",
  "  combinations require their named environments.",
  "- Multiplayer, leaderboards, Monkeytype ecosystem features, branding, and",
  "  novelty options are deliberately outside TypeThock's product scope.",
  "",
];

writeFileSync(outputPath, `${lines.join("\n")}\n`);
process.stdout.write(`Wrote ${outputPath}\n`);
