import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const frontendDirectory = resolve(scriptDirectory, "..");
const corpusPath = resolve(
  frontendDirectory,
  "src/features/typing/codeCorpus.ts",
);
const corpusSource = readFileSync(corpusPath, "utf8");
const transpiledCorpus = ts.transpileModule(corpusSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const corpus = await import(
  `data:text/javascript;base64,${Buffer.from(transpiledCorpus).toString("base64")}`
);

const temporaryDirectory = mkdtempSync(join(tmpdir(), "rill-code-corpus-"));
const results = [];

function commandResult(command, args, cwd = temporaryDirectory) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
}

function commandAvailable(command, versionArgs = ["--version"]) {
  const result = commandResult(command, versionArgs);
  return result.error === undefined && result.status === 0;
}

function requireSuccess(label, command, args, cwd) {
  const result = commandResult(command, args, cwd);
  if (result.error !== undefined || result.status !== 0) {
    const detail = [
      result.error?.message,
      `exit status: ${String(result.status)}`,
      result.signal ? `signal: ${result.signal}` : "",
      result.stdout,
      result.stderr,
    ]
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new Error(`${label} failed${detail ? `:\n${detail}` : "."}`);
  }
}

function compilerOperational(command, args, fileName, source) {
  const path = join(temporaryDirectory, fileName);
  writeFileSync(path, source, "utf8");
  const result = commandResult(command, [...args, path]);
  return result.error === undefined && result.status === 0;
}

function exercises(language) {
  return corpus.exercisesForLanguage(language);
}

function joined(language, separator = "\n\n") {
  return exercises(language)
    .map((exercise) => exercise.code)
    .join(separator);
}

function indent(value, spaces) {
  const prefix = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

const runtimeCases = {
  "Detect a repeated value": [
    { args: [[1, 2, 3]], expected: false },
    { args: [[1, 2, 1]], expected: true },
  ],
  "Check a palindrome": [
    { args: [""], expected: true },
    { args: ["level"], expected: true },
    { args: ["Racecar"], expected: false },
  ],
  "Reverse a string": [
    { args: [""], expected: "" },
    { args: ["abc"], expected: "cba" },
  ],
  "Sum an array": [
    { args: [[]], expected: 0 },
    { args: [[3, -1, 2]], expected: 4 },
  ],
  "Find the maximum": [
    { args: [[-7]], expected: -7 },
    { args: [[-7, -3, -9]], expected: -3 },
  ],
  "Count vowels": [
    { args: ["rhythm"], expected: 0 },
    { args: ["Education"], expected: 5 },
  ],
  "Binary search": [
    { args: [[], 4], expected: -1 },
    { args: [[1, 3, 4, 8], 4], expected: 2 },
  ],
  "Find a pair with a target sum": [
    { args: [[1, 2, 4], 8], expected: [] },
    { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
  ],
  "Validate brackets": [
    { args: ["{[()]}"], expected: true },
    { args: ["{a"], expected: false },
  ],
  "Merge sorted arrays": [
    { args: [[], [1, 2]], expected: [1, 2] },
    { args: [[1, 4], [2, 3]], expected: [1, 2, 3, 4] },
  ],
  "Move zeroes to the end": [
    {
      args: [[0, 1, 0, 3, 12]],
      expected: undefined,
      mutatedFirst: [1, 3, 12, 0, 0],
    },
    {
      args: [[0, 0]],
      expected: undefined,
      mutatedFirst: [0, 0],
    },
  ],
  "Find the missing number": [
    { args: [[]], expected: 0 },
    { args: [[3, 0, 1]], expected: 2 },
  ],
  "Check an anagram": [
    { args: ["listen", "silent"], expected: true },
    { args: ["rat", "car"], expected: false },
  ],
  "Find the first unique character": [
    { args: ["aabb"], expected: -1 },
    { args: ["leetcode"], expected: 0 },
  ],
  "Greatest common divisor": [
    { args: [0, 7], expected: 7 },
    { args: [-54, 24], expected: 6 },
  ],
  "Count stair-climbing paths": [
    { args: [0], expected: 1 },
    { args: [5], expected: 8 },
  ],
};

function valuesEqual(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function validateRuntime(language, toJavaScript) {
  const selected = exercises(language).filter(
    (exercise) => exercise.variation === 1,
  );
  let executed = 0;
  for (const exercise of selected) {
    const source = toJavaScript(exercise.code);
    const functionName = /function\s+([A-Za-z_$][\w$]*)\s*\(/u.exec(source)?.[1];
    if (functionName === undefined) {
      throw new Error(`Could not find the function name in ${exercise.id}.`);
    }
    const implementation = Function(
      `"use strict";\n${source}\nreturn ${functionName};`,
    )();
    const cases = runtimeCases[exercise.title];
    if (cases === undefined) {
      throw new Error(`No runtime cases exist for ${exercise.title}.`);
    }
    for (const testCase of cases) {
      const args = structuredClone(testCase.args);
      const actual = implementation(...args);
      if (!valuesEqual(actual, testCase.expected)) {
        throw new Error(
          `${exercise.id} returned ${JSON.stringify(actual)} instead of ${JSON.stringify(testCase.expected)}.`,
        );
      }
      if (
        "mutatedFirst" in testCase &&
        !valuesEqual(args[0], testCase.mutatedFirst)
      ) {
        throw new Error(
          `${exercise.id} mutated its array to ${JSON.stringify(args[0])} instead of ${JSON.stringify(testCase.mutatedFirst)}.`,
        );
      }
      executed += 1;
    }
  }
  return executed;
}

function validateAlwaysAvailableLanguages() {
  const javascriptPath = join(temporaryDirectory, "corpus.js");
  writeFileSync(javascriptPath, `${joined("javascript")}\n`, "utf8");
  requireSuccess("JavaScript syntax validation", process.execPath, [
    "--check",
    javascriptPath,
  ]);
  const javascriptCases = validateRuntime("javascript", (source) => source);
  results.push(
    `JavaScript: 64/64 parsed; ${String(javascriptCases)} behavior cases passed`,
  );

  const typescriptPath = join(temporaryDirectory, "corpus.ts");
  writeFileSync(typescriptPath, `${joined("typescript")}\n`, "utf8");
  const program = ts.createProgram([typescriptPath], {
    noEmit: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
    lib: ["lib.es2022.d.ts"],
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length > 0) {
    throw new Error(
      `TypeScript validation failed:\n${ts.formatDiagnosticsWithColorAndContext(
        diagnostics,
        {
          getCanonicalFileName: (name) => name,
          getCurrentDirectory: () => temporaryDirectory,
          getNewLine: () => "\n",
        },
      )}`,
    );
  }
  const typescriptCases = validateRuntime(
    "typescript",
    (source) =>
      ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.None,
        },
      }).outputText,
  );
  results.push(
    `TypeScript: 64/64 passed strict semantic validation; ${String(typescriptCases)} behavior cases passed`,
  );
}

function validateOptionalLanguages() {
  if (commandAvailable("python", ["--version"])) {
    const path = join(temporaryDirectory, "corpus.py");
    writeFileSync(path, `${joined("python3")}\n`, "utf8");
    requireSuccess("Python syntax validation", "python", [
      "-m",
      "py_compile",
      path,
    ]);
    results.push("Python 3: 64/64 compiled");
  } else {
    results.push("Python 3: skipped (python unavailable)");
  }

  if (commandAvailable("javac", ["-version"])) {
    const path = join(temporaryDirectory, "CorpusCheck.java");
    writeFileSync(
      path,
      `import java.util.*;\nclass CorpusCheck {\n${indent(joined("java"), 2)}\n}\n`,
      "utf8",
    );
    requireSuccess("Java compilation", "javac", ["--release", "21", path]);
    results.push("Java: 64/64 compiled in a java.util wrapper");
  } else {
    results.push("Java: skipped (javac unavailable)");
  }

  if (
    commandAvailable("gcc") &&
    compilerOperational(
      "gcc",
      ["-std=c17", "-fsyntax-only"],
      "probe.c",
      "int main(void) { return 0; }\n",
    )
  ) {
    const path = join(temporaryDirectory, "corpus.c");
    writeFileSync(
      path,
      [
        "#include <stdbool.h>",
        "#include <ctype.h>",
        "#include <stdlib.h>",
        "#include <string.h>",
        "",
        joined("c"),
        "",
      ].join("\n"),
      "utf8",
    );
    requireSuccess("C compilation", "gcc", [
      "-std=c17",
      "-Wall",
      "-Wextra",
      "-Werror",
      "-fsyntax-only",
      path,
    ]);
    results.push("C: 64/64 compiled in a standard-header wrapper");
  } else {
    results.push("C: skipped (gcc unavailable or not operational)");
  }

  if (
    commandAvailable("g++") &&
    compilerOperational(
      "g++",
      ["-std=c++20", "-fsyntax-only"],
      "probe.cpp",
      "int main() { return 0; }\n",
    )
  ) {
    const path = join(temporaryDirectory, "corpus.cpp");
    writeFileSync(
      path,
      `#include <bits/stdc++.h>\nusing namespace std;\n\n${joined("cpp")}\n`,
      "utf8",
    );
    requireSuccess("C++ compilation", "g++", [
      "-std=c++20",
      "-Wall",
      "-Wextra",
      "-Werror",
      "-fsyntax-only",
      path,
    ]);
    results.push("C++: 64/64 compiled in a standard-library wrapper");
  } else {
    results.push("C++: skipped (g++ unavailable or not operational)");
  }

  const dotnetSdks = commandResult("dotnet", ["--list-sdks"]);
  if (
    dotnetSdks.error === undefined &&
    dotnetSdks.status === 0 &&
    dotnetSdks.stdout.trim().length > 0
  ) {
    const projectDirectory = join(temporaryDirectory, "csharp");
    mkdirSync(projectDirectory);
    writeFileSync(
      join(projectDirectory, "CorpusCheck.csproj"),
      [
        '<Project Sdk="Microsoft.NET.Sdk">',
        "  <PropertyGroup>",
        "    <TargetFramework>net8.0</TargetFramework>",
        "    <ImplicitUsings>enable</ImplicitUsings>",
        "    <Nullable>enable</Nullable>",
        "  </PropertyGroup>",
        "</Project>",
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      join(projectDirectory, "CorpusCheck.cs"),
      `class CorpusCheck {\n${indent(joined("csharp"), 2)}\n}\n`,
      "utf8",
    );
    requireSuccess(
      "C# compilation",
      "dotnet",
      ["build", "--nologo", "--verbosity", "quiet"],
      projectDirectory,
    );
    results.push("C#: 64/64 compiled in an SDK wrapper");
  } else {
    results.push("C#: skipped (a .NET SDK is unavailable)");
  }

  if (commandAvailable("go", ["version"])) {
    const path = join(temporaryDirectory, "corpus.go");
    writeFileSync(
      path,
      `package corpus\n\nimport "strings"\n\n${joined("go")}\n`,
      "utf8",
    );
    requireSuccess("Go compilation", "go", ["test", path]);
    results.push("Go: 64/64 compiled in a package wrapper");
  } else {
    results.push("Go: skipped (go unavailable)");
  }
}

try {
  validateAlwaysAvailableLanguages();
  validateOptionalLanguages();
  for (const result of results) {
    process.stdout.write(`${result}\n`);
  }
} finally {
  if (process.env.RILL_KEEP_CORPUS_TMP === "true") {
    process.stderr.write(`Kept validation files at ${temporaryDirectory}\n`);
  } else {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}
