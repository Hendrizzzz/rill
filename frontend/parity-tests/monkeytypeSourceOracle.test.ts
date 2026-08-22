import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  compareResults,
  runOracleBatch,
  runTypethock,
  type ParityTrace,
} from "./support/parityHarness";

describe("pinned Monkeytype full-field source oracle", () => {
  it("matches TypeThock for one complete shared trace", () => {
    const sourceRoot = process.env.MONKEYTYPE_SOURCE_ROOT;
    if (!sourceRoot) {
      throw new Error("MONKEYTYPE_SOURCE_ROOT is required for the parity oracle.");
    }
    const trace = JSON.parse(
      readFileSync(
        resolve("test-fixtures/parity-canary-trace.json"),
        "utf8",
      ),
    ) as ParityTrace;
    const oracle = runOracleBatch([trace], sourceRoot);

    expect(oracle.source).toEqual({
      repository: "monkeytypegame/monkeytype",
      commit: "7feea96c5df21a59af9553fa7c52eb33af5997b8",
      adapter: "trace-1-to-monkeytype-event-log-2",
      durationResult:
        "official getTestDurationMs canonicalized to integer milliseconds; official metrics retain the source floating value",
    });
    const oracleResult = oracle.results[0];
    expect(oracleResult).toBeDefined();
    if (oracleResult === undefined) throw new Error("Oracle returned no result.");
    expect(compareResults(trace, runTypethock(trace), oracleResult)).toEqual({
      kind: "equal",
      differences: [],
    });
  });
});
