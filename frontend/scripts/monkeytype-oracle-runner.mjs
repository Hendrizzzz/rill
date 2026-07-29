import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import ts from "typescript";

const sourceRootValue = process.env.MONKEYTYPE_SOURCE_ROOT;
if (!sourceRootValue) {
  throw new Error(
    "Set MONKEYTYPE_SOURCE_ROOT to an external checkout of the pinned Monkeytype source.",
  );
}

const sourceRoot = resolve(sourceRootValue);
const fixture = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "test-fixtures/monkeytype-source-oracle.json"),
    "utf8",
  ),
);

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function normalizeSource(content) {
  return content.replace(/\r\n?/g, "\n");
}

function readPinnedSources() {
  return new Map(
    fixture.files.map(({ path, sha256: expectedSha256 }) => {
      const content = normalizeSource(
        readFileSync(resolve(sourceRoot, path), "utf8"),
      );
      const actualSha256 = sha256(content);
      if (actualSha256 !== expectedSha256) {
        throw new Error(
          `${path} SHA-256 mismatch: expected ${expectedSha256}, got ${actualSha256}`,
        );
      }
      return [path, content];
    }),
  );
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

function extractVariable(sourceText, relativePath, variableName) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const declaration = statement.declarationList.declarations.find(
      (candidate) =>
        ts.isIdentifier(candidate.name) && candidate.name.text === variableName,
    );
    if (declaration) {
      return statement.getText(sourceFile).replace(/^export\s+/, "");
    }
  }
  throw new Error(`${variableName} was not found in ${relativePath}`);
}

function assertTrace(trace) {
  const isWords =
    trace?.config?.mode === "words" &&
    Number.isSafeInteger(trace.config.modeValue) &&
    trace.config.modeValue >= 1 &&
    Array.isArray(trace.prompt) &&
    trace.prompt.length === trace.config.modeValue;
  const isTime =
    trace?.config?.mode === "time" &&
    (trace.config.modeValue === 15 ||
      trace.config.modeValue === 30 ||
      trace.config.modeValue === 60) &&
    Array.isArray(trace.prompt) &&
    trace.prompt.length > 0 &&
    trace.completionAtUs === trace.config.modeValue * 1_000_000;
  if (
    trace?.version !== "trace/1" ||
    (!isWords && !isTime) ||
    !trace.prompt.every(
      (word) => typeof word === "string" && word.length > 0 && !word.includes(" "),
    ) ||
    !Number.isSafeInteger(trace.completionAtUs) ||
    trace.completionAtUs < 0 ||
    trace.completionAtUs % 10 !== 0 ||
    !Array.isArray(trace.events)
  ) {
    throw new Error("Trace does not satisfy trace/1 word-canary requirements.");
  }

  let priorAtUs = -1;
  let priorSequence = -1;
  const sequences = new Set();
  for (const event of trace.events) {
    const valid =
      Number.isSafeInteger(event.atUs) &&
      event.atUs >= 0 &&
      event.atUs <= trace.completionAtUs &&
      event.atUs % 10 === 0 &&
      Number.isSafeInteger(event.sequence) &&
      !sequences.has(event.sequence) &&
      (event.atUs > priorAtUs ||
        (event.atUs === priorAtUs && event.sequence > priorSequence)) &&
      (event.type === "insert" || event.type === "delete") &&
      Number.isSafeInteger(event.wordIndex) &&
      event.wordIndex >= 0 &&
      event.wordIndex < trace.prompt.length &&
      typeof event.grapheme === "string" &&
      Array.from(event.grapheme).length <= 1;
    if (!valid) {
      throw new Error(`Invalid trace event at sequence ${String(event.sequence)}.`);
    }
    sequences.add(event.sequence);
    priorAtUs = event.atUs;
    priorSequence = event.sequence;
  }
}

function toMonkeytypeEventLog(trace) {
  const targetWords = trace.prompt.map((word, index) =>
    trace.config.mode === "words" && index === trace.prompt.length - 1
      ? word
      : `${word} `,
  );
  const inputByWord = new Map();
  const events = [];

  for (const event of trace.events) {
    const target = targetWords[event.wordIndex] ?? "";
    const previousInput = inputByWord.get(event.wordIndex) ?? "";
    let inputValue;
    let data;
    if (event.type === "insert") {
      inputValue = `${previousInput}${event.grapheme}`;
      data = {
        inputType: "insertText",
        data: event.grapheme,
        charIndex: previousInput.length,
        wordIndex: event.wordIndex,
        inputValue,
        correct: target[previousInput.length] === event.grapheme,
        ...(event.grapheme === " " ? { commitsWord: true } : {}),
        ...(event.wordIndex === trace.prompt.length - 1
          ? { lastWord: true }
          : {}),
      };
    } else {
      inputValue = previousInput.slice(0, -1);
      data = {
        inputType: "deleteContentBackward",
        charIndex: Math.max(0, previousInput.length - 1),
        wordIndex: event.wordIndex,
        inputValue,
      };
    }
    inputByWord.set(event.wordIndex, inputValue);
    events.push({
      type: "input",
      testMs: event.atUs / 1000,
      data,
      sequence: event.sequence,
    });
  }

  events.push(
    {
      type: "timer",
      testMs: 0,
      data: { event: "start", timer: 0, date: 0 },
      sequence: -1,
    },
    {
      type: "timer",
      testMs: trace.completionAtUs / 1000,
      data: {
        event: "end",
        timer: trace.completionAtUs / 1_000_000,
        date: trace.completionAtUs / 1000,
      },
      sequence: Number.MAX_SAFE_INTEGER,
    },
  );

  const tieRank = (type) => (type === "keyup" ? 0 : type === "keydown" ? 1 : type === "timer" ? 3 : 2);
  events.sort(
    (left, right) =>
      left.testMs - right.testMs ||
      tieRank(left.type) - tieRank(right.type) ||
      left.sequence - right.sequence,
  );
  for (const event of events) delete event.sequence;

  return {
    version: 1,
    events,
    context: {
      targetWords,
      mode: trace.config.mode,
      mode2: String(trace.config.modeValue),
      bailedOut: false,
      koreanStatus: false,
    },
  };
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
if (actualCommit !== fixture.commit) {
  throw new Error(
    `Monkeytype commit mismatch: expected ${fixture.commit}, got ${actualCommit}`,
  );
}

const sources = readPinnedSources();
const statsPath = "frontend/src/ts/test/events/stats.ts";
const helpersPath = "frontend/src/ts/test/events/helpers.ts";
const stringsPath = "frontend/src/ts/utils/strings.ts";
const frontendNumbersPath = "frontend/src/ts/utils/numbers.ts";
const utilNumbersPath = "packages/util/src/numbers.ts";
const statsSource = sources.get(statsPath);
const helpersSource = sources.get(helpersPath);
const stringsSource = sources.get(stringsPath);
const frontendNumbersSource = sources.get(frontendNumbersPath);
const utilNumbersSource = sources.get(utilNumbersPath);

const officialSource = `
type CharCounts = {
  allCorrect: number;
  correctWord: number;
  incorrect: number;
  extra: number;
  missed: number;
};
type TestEventNoMs = any;
type EventLog = any;
const Hangul = {
  disassemble(): never {
    throw new Error("The English-only oracle must not enter the Korean branch.");
  },
};
${extractVariable(stringsSource, stringsPath, "SPACE_CODE_POINTS")}
${extractFunction(stringsSource, stringsPath, "isSpace")}
${extractFunction(stringsSource, stringsPath, "countChars")}
${extractFunction(helpersSource, helpersPath, "getInputFromDom")}
${extractFunction(helpersSource, helpersPath, "getEventsPerWord")}
${extractFunction(utilNumbersSource, utilNumbersPath, "roundTo2")}
${extractFunction(utilNumbersSource, utilNumbersPath, "mean")}
${extractFunction(utilNumbersSource, utilNumbersPath, "stdDev")}
${extractFunction(utilNumbersSource, utilNumbersPath, "kogasa")}
${extractFunction(frontendNumbersSource, frontendNumbersPath, "calculateWpm")}
${extractFunction(statsSource, statsPath, "getRawLastKeypressToEndMs")}
${extractFunction(statsSource, statsPath, "isTimedTest")}
${extractFunction(statsSource, statsPath, "getTimerBoundaries")}
${extractFunction(statsSource, statsPath, "countPerInterval")}
${extractFunction(statsSource, statsPath, "getBurstHistory")}
${extractFunction(statsSource, statsPath, "getTestDurationMs")}
${extractFunction(statsSource, statsPath, "getTargetWord")}
${extractFunction(statsSource, statsPath, "countCharsForWordIndex")}
${extractFunction(statsSource, statsPath, "inferActiveWordIndex")}
${extractFunction(statsSource, statsPath, "getChars")}
${extractFunction(statsSource, statsPath, "getAccuracy")}
${extractFunction(statsSource, statsPath, "getErrorCountHistory")}
${extractFunction(statsSource, statsPath, "getWpmHistory")}
${extractFunction(statsSource, statsPath, "getRawHistory")}
`;

const compiledJavaScript = ts.transpileModule(officialSource, {
  compilerOptions: {
    module: ts.ModuleKind.None,
    target: ts.ScriptTarget.ES2023,
  },
}).outputText;

const official = new Function(
  `${compiledJavaScript}
  return {
    run(eventLog) {
      const chars = getChars(eventLog);
      const accuracy = getAccuracy(eventLog);
      const sourceDurationMs = getTestDurationMs(eventLog);
      const durationMs = Math.round(sourceDurationMs);
      if (
        Math.abs(sourceDurationMs - durationMs) > 0.000001 ||
        durationMs % 10 !== 0
      ) {
        throw new Error(
          \`Official non-custom duration did not canonicalize to the declared 10ms result grid: \${String(sourceDurationMs)}.\`,
        );
      }
      const durationSeconds = sourceDurationMs / 1000;
      const burst = getBurstHistory(eventLog);
      const averageBurst = mean(burst);
      const consistencyValue = roundTo2(kogasa(stdDev(burst) / averageBurst));
      const consistency =
        !consistencyValue || Number.isNaN(consistencyValue)
          ? 0
          : consistencyValue;
      return {
        durationMs,
        counters: {
          typedCharacters: chars.allCorrect + chars.incorrect + chars.extra,
          correctAttempts: accuracy.correct,
          incorrectAttempts: accuracy.incorrect,
          correctCharacters: chars.correctWord,
          incorrectCharacters: chars.incorrect,
          missingCharacters: chars.missed,
          extraAttempts: chars.extra,
        },
        metrics: {
          wpm: roundTo2(calculateWpm(chars.correctWord, durationSeconds)),
          rawWpm: roundTo2(
            calculateWpm(
              chars.allCorrect + chars.incorrect + chars.extra,
              durationSeconds,
            ),
          ),
          accuracy: roundTo2(accuracy.percentage),
          consistency,
        },
        graph: {
          boundariesMs: getTimerBoundaries(eventLog),
          wpm: getWpmHistory(eventLog),
          raw: getRawHistory(eventLog),
          burst,
          errors: getErrorCountHistory(eventLog),
        },
      };
    },
  };`,
)();

function runTrace(trace) {
  assertTrace(trace);
  return {
    version: "result/1",
    traceId: trace.id,
    ...official.run(toMonkeytypeEventLog(trace)),
  };
}

const input = JSON.parse(readFileSync(0, "utf8").replace(/^\uFEFF/, ""));
const source = {
  repository: fixture.repository,
  commit: actualCommit,
  adapter: "trace-1-to-monkeytype-event-log-2",
  durationResult:
    "official getTestDurationMs canonicalized to integer milliseconds; official metrics retain the source floating value",
};
const output =
  input?.version === "campaign/1"
    ? {
        version: "campaign-result/1",
        source,
        results: input.traces.map(runTrace),
      }
    : { source, ...runTrace(input) };
process.stdout.write(`${JSON.stringify(output)}\n`);
