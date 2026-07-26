import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_CONFIG,
  loadGuestResults,
  loadTestConfig,
  saveGuestResult,
  saveTestConfig,
} from "./storage";
import type { TypingResult } from "./types";

const result: TypingResult = {
  clientResultId: "result-1",
  mode: "time",
  modeValue: 30,
  punctuation: false,
  numbers: false,
  durationMs: 30_000,
  typedCharacters: 100,
  correctAttempts: 95,
  incorrectAttempts: 5,
  correctCharacters: 92,
  missingCharacters: 1,
  extraAttempts: 2,
  correctedErrors: 3,
  wpm: 36.8,
  rawWpm: 40,
  accuracy: 94.06,
  consistency: 88,
  paceBuckets: [{ durationMs: 1_000, typedCharacters: 3 }],
  completedAt: "2026-07-26T00:00:00.000Z",
  completionReason: "time",
};

describe("typing local storage", () => {
  it("falls back from corrupt configuration", () => {
    localStorage.setItem("rill.test-config.v1", "{broken");
    expect(loadTestConfig()).toEqual(DEFAULT_CONFIG);
  });

  it("round trips a valid test configuration", () => {
    const config = {
      mode: "words",
      modeValue: 25,
      punctuation: true,
      numbers: false,
    } as const;
    expect(saveTestConfig(config)).toBe(true);
    expect(loadTestConfig()).toEqual(config);
  });

  it("deduplicates result persistence by client id", () => {
    expect(saveGuestResult(result)).toEqual({ ok: true, deduplicated: false });
    expect(saveGuestResult(result)).toEqual({ ok: true, deduplicated: true });
    expect(loadGuestResults()).toEqual([result]);
  });

  it("reports unavailable storage without throwing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(saveGuestResult(result)).toEqual({
      ok: false,
      deduplicated: false,
    });
  });

  it("drops structurally plausible results with invalid dates", () => {
    localStorage.setItem(
      "rill.guest-results.v1",
      JSON.stringify({
        version: 1,
        results: [{ ...result, completedAt: "not-a-date" }],
      }),
    );

    expect(loadGuestResults()).toEqual([]);
  });
});
