import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import ts from "typescript";

const sourceRootValue = process.env.MONKEYTYPE_SOURCE_ROOT;
if (!sourceRootValue) {
  throw new Error(
    "Set MONKEYTYPE_SOURCE_ROOT to a checkout of the pinned Monkeytype source.",
  );
}

const sourceRoot = resolve(sourceRootValue);
const fixturePath = resolve(
  process.cwd(),
  "test-fixtures/monkeytype-timing-golden.json",
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function readPinnedSource(relativePath, expectedSha256) {
  const content = readFileSync(resolve(sourceRoot, relativePath), "utf8");
  const actualSha256 = sha256(content);
  if (actualSha256 !== expectedSha256) {
    throw new Error(
      `${relativePath} SHA-256 mismatch: expected ${expectedSha256}, got ${actualSha256}`,
    );
  }
  return content;
}

function extractFunction(sourceText, relativePath, functionName) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const declaration = sourceFile.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === functionName,
  );
  if (!declaration) {
    throw new Error(`${functionName} was not found in ${relativePath}`);
  }
  return declaration.getText(sourceFile).replace(/^export\s+/, "");
}

const actualCommit = execFileSync(
  "git",
  [
    "-c",
    `safe.directory=${sourceRoot.replaceAll("\\", "/")}`,
    "-C",
    sourceRoot,
    "rev-parse",
    "HEAD",
  ],
  { encoding: "utf8" },
).trim();
if (actualCommit !== fixture.source.commit) {
  throw new Error(
    `Monkeytype commit mismatch: expected ${fixture.source.commit}, got ${actualCommit}`,
  );
}

const statsSource = readPinnedSource(
  fixture.source.statsPath,
  fixture.source.statsSha256,
);
const numbersSource = readPinnedSource(
  fixture.source.numbersPath,
  fixture.source.numbersSha256,
);

const extractedTypeScript = `
type EventLog = {
  context: { mode: string; bailedOut: boolean };
  events: Array<{
    type: string;
    testMs: number;
    data: { event: string };
  }>;
};
function isTimedTest(eventLog: EventLog): boolean {
  return eventLog.context.mode === "time";
}
function getRawLastKeypressToEndMs(): number {
  return 0;
}
${extractFunction(numbersSource, fixture.source.numbersPath, "roundTo2")}
${extractFunction(statsSource, fixture.source.statsPath, "getTimerBoundaries")}
${extractFunction(statsSource, fixture.source.statsPath, "getTestDurationMs")}
`;

const compiledJavaScript = ts.transpileModule(extractedTypeScript, {
  compilerOptions: {
    module: ts.ModuleKind.None,
    target: ts.ScriptTarget.ES2023,
  },
}).outputText;

const officialTiming = new Function(
  `${compiledJavaScript}
  return { getTimerBoundaries, getTestDurationMs };`,
)();

const actualVectors = fixture.vectors.map(({ rawEndMs }) => {
  const eventLog = {
    context: { mode: "words", bailedOut: false },
    events: [{ type: "timer", testMs: rawEndMs, data: { event: "end" } }],
  };
  return {
    rawEndMs,
    aggregateDurationMs: officialTiming.getTestDurationMs(eventLog),
    timerBoundariesMs: officialTiming.getTimerBoundaries(eventLog),
  };
});

if (JSON.stringify(actualVectors) !== JSON.stringify(fixture.vectors)) {
  console.error("Expected:", fixture.vectors);
  console.error("Actual:", actualVectors);
  throw new Error("Pinned Monkeytype timing output differs from the fixture.");
}

console.table(actualVectors);
console.log(
  `Verified ${actualVectors.length} vectors by executing functions extracted from Monkeytype ${actualCommit}.`,
);
