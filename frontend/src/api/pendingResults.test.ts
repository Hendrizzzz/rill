import { describe, expect, it, vi } from "vitest";

import {
  flushAccountResults,
  queueAccountResult,
} from "./pendingResults";
import { ApiError } from "./client";
import type { TypingResult } from "../features/typing/types";

const KEY = "rill.pending-account-results.v1";

function result(clientResultId: string): TypingResult {
  return {
    clientResultId,
    mode: "words",
    modeValue: 10,
    punctuation: false,
    numbers: false,
    durationMs: 10_000,
    typedCharacters: 50,
    correctAttempts: 48,
    incorrectAttempts: 2,
    correctCharacters: 45,
    missingCharacters: 1,
    extraAttempts: 1,
    correctedErrors: 1,
    wpm: 54,
    rawWpm: 60,
    accuracy: 96,
    consistency: 90,
    paceBuckets: [{ durationMs: 1_000, typedCharacters: 5 }],
    completedAt: "2026-07-26T00:00:00Z",
    completionReason: "finished",
  };
}

function storedEntries(): Array<{ ownerId: string; result: TypingResult }> {
  const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") as {
    entries?: Array<{ ownerId: string; result: TypingResult }>;
  };
  return stored.entries ?? [];
}

describe("pending account results", () => {
  it("discards corrupt entries instead of sending them", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        entries: [
          { ownerId: "account-a", result: { clientResultId: "incomplete" } },
        ],
      }),
    );
    const save = vi.fn<(value: TypingResult) => Promise<void>>();

    await expect(flushAccountResults("account-a", save)).resolves.toEqual({
      saved: 0,
      discarded: 0,
    });
    expect(save).not.toHaveBeenCalled();
    expect(storedEntries()).toEqual([]);
  });

  it("flushes only the active account queue", async () => {
    queueAccountResult("account-a", result("a-1"));
    queueAccountResult("account-b", result("b-1"));
    const save = vi.fn<(value: TypingResult) => Promise<void>>().mockResolvedValue();

    await expect(flushAccountResults("account-a", save)).resolves.toEqual({
      saved: 1,
      discarded: 0,
    });
    expect(save).toHaveBeenCalledWith(result("a-1"));
    expect(storedEntries()).toEqual([
      { ownerId: "account-b", result: result("b-1") },
    ]);
  });

  it("stops after a failed save and retains unsent entries", async () => {
    queueAccountResult("account-a", result("a-1"));
    queueAccountResult("account-a", result("a-2"));
    const save = vi
      .fn<(value: TypingResult) => Promise<void>>()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error("offline"));

    await expect(flushAccountResults("account-a", save)).resolves.toEqual({
      saved: 1,
      discarded: 0,
    });
    expect(storedEntries()).toEqual([
      { ownerId: "account-a", result: result("a-2") },
    ]);
  });

  it("rejects saturation without evicting existing account entries", () => {
    queueAccountResult("account-b", result("b-1"));
    for (let index = 0; index < 20; index += 1) {
      expect(queueAccountResult("account-a", result(`a-${String(index)}`))).toBe(
        "queued",
      );
    }
    expect(queueAccountResult("account-a", result("overflow"))).toBe("full");

    const entries = storedEntries();
    expect(entries.filter((entry) => entry.ownerId === "account-a")).toHaveLength(
      20,
    );
    expect(entries).toContainEqual({
      ownerId: "account-b",
      result: result("b-1"),
    });
  });

  it("discards a permanent failure and continues with older entries", async () => {
    queueAccountResult("account-a", result("older"));
    queueAccountResult("account-a", result("poison"));
    const save = vi
      .fn<(value: TypingResult) => Promise<void>>()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(
        new ApiError(400, {
          code: "VALIDATION_FAILED",
          detail: "invalid result",
        }),
      );

    await expect(flushAccountResults("account-a", save)).resolves.toEqual({
      saved: 1,
      discarded: 1,
    });
    expect(storedEntries()).toEqual([]);
  });
});
