import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_CONFIG,
  hasLegacyGuestResults,
  loadGuestResults,
  loadTestConfig,
  saveGuestResult,
  saveTestConfig,
} from "./storage";
import { calculateConsistency } from "./scoring";
import type { TypingResult } from "./types";

const result: TypingResult = {
  clientResultId: "result-1",
  mode: "words",
  modeValue: 10,
  punctuation: false,
  numbers: false,
  contentType: "words",
  language: "en",
  wordListVersion: "en-v1",
  errorPolicy: "normal",
  durationMs: 1_000,
  typedCharacters: 3,
  correctAttempts: 3,
  incorrectAttempts: 0,
  correctCharacters: 3,
  incorrectCharacters: 0,
  missingCharacters: 0,
  extraAttempts: 0,
  correctedErrors: 0,
  wpm: 36,
  rawWpm: 36,
  accuracy: 100,
  consistency: 100,
  paceBuckets: [
    {
      durationMs: 1_000,
      typedCharacters: 3,
      correctCharacters: 3,
      rawCharacters: 3,
      errors: 0,
    },
  ],
  completedAt: "2026-07-26T00:00:00.000Z",
  completionReason: "finished",
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
      contentType: "words",
      language: "en",
      errorPolicy: "normal",
    } as const;
    expect(saveTestConfig(config)).toBe(true);
    expect(loadTestConfig()).toEqual(config);
  });

  it("migrates the legacy configuration to explicit default dimensions", () => {
    localStorage.setItem(
      "rill.test-config.v1",
      JSON.stringify({
        mode: "words",
        modeValue: 50,
        punctuation: true,
        numbers: false,
      }),
    );

    expect(loadTestConfig()).toEqual({
      mode: "words",
      modeValue: 50,
      punctuation: true,
      numbers: false,
      contentType: "words",
      language: "en",
      errorPolicy: "normal",
    });
  });

  it("never restores private custom text as an active source", () => {
    expect(
      saveTestConfig({
        mode: "words",
        modeValue: 2,
        punctuation: false,
        numbers: false,
        contentType: "custom",
        language: "es",
        errorPolicy: "strict",
      }),
    ).toBe(true);

    expect(loadTestConfig()).toEqual({
      mode: "words",
      modeValue: 25,
      punctuation: false,
      numbers: false,
      contentType: "words",
      language: "es",
      errorPolicy: "strict",
    });
    expect(localStorage.getItem("rill.test-config.v2")).not.toContain("custom");
  });

  it("migrates v2 guest results to the original words-mode dimensions", () => {
    const legacy: Record<string, unknown> = { ...result };
    Reflect.deleteProperty(legacy, "contentType");
    Reflect.deleteProperty(legacy, "language");
    Reflect.deleteProperty(legacy, "errorPolicy");
    localStorage.setItem(
      "rill.guest-results.v2",
      JSON.stringify({ version: 2, results: [legacy] }),
    );

    expect(loadGuestResults()).toEqual([result]);
  });

  it("segregates unversioned pre-release code results as code-v1", () => {
    const legacyCode: Record<string, unknown> = {
      ...result,
      contentType: "code",
      codeLanguage: "python3",
    };
    Reflect.deleteProperty(legacyCode, "wordListVersion");
    localStorage.setItem(
      "rill.guest-results.v4",
      JSON.stringify({ version: 4, results: [legacyCode] }),
    );

    expect(loadGuestResults()).toEqual([
      {
        ...legacyCode,
        wordListVersion: "code-v1",
      },
    ]);
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
      "rill.guest-results.v2",
      JSON.stringify({
        version: 2,
        results: [{ ...result, completedAt: "not-a-date" }],
      }),
    );

    expect(loadGuestResults()).toEqual([]);
  });

  it("rejects structurally valid results with fabricated derived metrics", () => {
    localStorage.setItem(
      "rill.guest-results.v2",
      JSON.stringify({
        version: 2,
        results: [
          {
            ...result,
            wpm: 500,
            rawWpm: 499,
            accuracy: 12.34,
          },
        ],
      }),
    );

    expect(loadGuestResults()).toEqual([]);
  });

  it("rejects corrected errors without a corresponding incorrect attempt", () => {
    localStorage.setItem(
      "rill.guest-results.v2",
      JSON.stringify({
        version: 2,
        results: [{ ...result, correctedErrors: 1 }],
      }),
    );

    expect(loadGuestResults()).toEqual([]);
  });

  it.each([
    { completionReason: "time" },
    { completionReason: "limit" },
  ])(
    "rejects an impossible words/$completionReason completion combination",
    ({ completionReason }) => {
      localStorage.setItem(
        "rill.guest-results.v2",
        JSON.stringify({
          version: 2,
          results: [{ ...result, completionReason }],
        }),
      );

      expect(loadGuestResults()).toEqual([]);
    },
  );

  it("round trips a fractional source-compatible graph tail", () => {
    const fractional: TypingResult = {
      ...result,
      durationMs: 500,
      typedCharacters: 1,
      correctAttempts: 1,
      correctCharacters: 1,
      wpm: 24,
      rawWpm: 24,
      paceBuckets: [
        {
          durationMs: 495,
          typedCharacters: 1,
          correctCharacters: 1,
          rawCharacters: 1,
          errors: 0,
        },
      ],
    };

    expect(saveGuestResult(fractional)).toEqual({
      ok: true,
      deduplicated: false,
    });
    expect(loadGuestResults()).toEqual([fractional]);
  });

  it("round trips a canonical fractional tail after a whole second", () => {
    const fractional: TypingResult = {
      ...result,
      durationMs: 1_500,
      wpm: 24,
      rawWpm: 24,
      paceBuckets: [
        {
          durationMs: 1_000,
          typedCharacters: 2,
          correctCharacters: 2,
          rawCharacters: 2,
          errors: 0,
        },
        {
          durationMs: 500.04,
          typedCharacters: 1,
          correctCharacters: 3,
          rawCharacters: 3,
          errors: 0,
        },
      ],
    };

    expect(saveGuestResult(fractional)).toEqual({
      ok: true,
      deduplicated: false,
    });
    expect(loadGuestResults()).toEqual([fractional]);
  });

  it("round trips a terminal event folded into a whole-second bucket", () => {
    const paceBuckets = [
      {
        durationMs: 1_000,
        typedCharacters: 2,
        correctCharacters: 2,
        rawCharacters: 2,
        errors: 0,
      },
      {
        durationMs: 1_000,
        typedCharacters: 1,
        correctCharacters: 3,
        rawCharacters: 3,
        errors: 0,
      },
    ];
    const rollover: TypingResult = {
      ...result,
      durationMs: 2_000,
      wpm: 18,
      rawWpm: 18,
      consistency: calculateConsistency(paceBuckets),
      paceBuckets,
    };

    expect(saveGuestResult(rollover)).toEqual({
      ok: true,
      deduplicated: false,
    });
    expect(loadGuestResults()).toEqual([rollover]);
  });

  it("rejects a raw graph duration at the next aggregate boundary", () => {
    localStorage.setItem(
      "rill.guest-results.v2",
      JSON.stringify({
        version: 2,
        results: [
          {
            ...result,
            durationMs: 500,
            typedCharacters: 1,
            correctAttempts: 1,
            correctCharacters: 1,
            wpm: 24,
            rawWpm: 24,
            paceBuckets: [
              {
                durationMs: 505,
                typedCharacters: 1,
                correctCharacters: 1,
                rawCharacters: 1,
                errors: 0,
              },
            ],
          },
        ],
      }),
    );

    expect(loadGuestResults()).toEqual([]);
  });

  it("drops results whose pace buckets do not match their totals", () => {
    localStorage.setItem(
      "rill.guest-results.v2",
      JSON.stringify({
        version: 2,
        results: [
          {
            ...result,
            paceBuckets: [
              {
                durationMs: 999,
                typedCharacters: 2,
                correctCharacters: 2,
                rawCharacters: 2,
                errors: 0,
              },
            ],
          },
        ],
      }),
    );

    expect(loadGuestResults()).toEqual([]);
  });

  it("drops a cumulative pace count that precedes its insertions", () => {
    const paceBuckets = [
      {
        durationMs: 1_000,
        typedCharacters: 1,
        correctCharacters: 2,
        rawCharacters: 2,
        errors: 0,
      },
      {
        durationMs: 1_000,
        typedCharacters: 2,
        correctCharacters: 3,
        rawCharacters: 3,
        errors: 0,
      },
    ];
    localStorage.setItem(
      "rill.guest-results.v4",
      JSON.stringify({
        version: 4,
        results: [
          {
            ...result,
            durationMs: 2_000,
            wpm: 18,
            rawWpm: 18,
            consistency: calculateConsistency(paceBuckets),
            paceBuckets,
          },
        ],
      }),
    );

    expect(loadGuestResults()).toEqual([]);
  });

  it("keeps a cumulative pace count that decreases after correction", () => {
    const paceBuckets = [
      {
        durationMs: 1_000,
        typedCharacters: 3,
        correctCharacters: 3,
        rawCharacters: 3,
        errors: 0,
      },
      {
        durationMs: 1_000,
        typedCharacters: 1,
        correctCharacters: 1,
        rawCharacters: 1,
        errors: 0,
      },
    ];
    const corrected: TypingResult = {
      ...result,
      durationMs: 2_000,
      typedCharacters: 1,
      correctAttempts: 4,
      correctCharacters: 1,
      wpm: 6,
      rawWpm: 6,
      consistency: calculateConsistency(paceBuckets),
      paceBuckets,
    };

    expect(saveGuestResult(corrected)).toEqual({
      ok: true,
      deduplicated: false,
    });
    expect(loadGuestResults()).toEqual([corrected]);
  });

  it("rejects a word-result tail below the canonical 500ms cutoff", () => {
    localStorage.setItem(
      "rill.guest-results.v2",
      JSON.stringify({
        version: 2,
        results: [
          {
            ...result,
            durationMs: 2_020,
            typedCharacters: 15,
            correctAttempts: 15,
            correctCharacters: 15,
            wpm: 89.11,
            rawWpm: 89.11,
            paceBuckets: [
              {
                durationMs: 1_000,
                typedCharacters: 7,
                correctCharacters: 7,
                rawCharacters: 7,
                errors: 0,
              },
              {
                durationMs: 1_000,
                typedCharacters: 7,
                correctCharacters: 14,
                rawCharacters: 14,
                errors: 0,
              },
              {
                durationMs: 20,
                typedCharacters: 1,
                correctCharacters: 15,
                rawCharacters: 15,
                errors: 0,
              },
            ],
          },
        ],
      }),
    );

    expect(loadGuestResults()).toEqual([]);
  });

  it("preserves and reports incompatible pre-release guest history", () => {
    const legacy = {
      ...result,
      incorrectCharacters: undefined,
      paceBuckets: [{ durationMs: 1_000, typedCharacters: 3 }],
    };
    localStorage.setItem(
      "rill.guest-results.v1",
      JSON.stringify({ version: 1, results: [legacy] }),
    );

    expect(hasLegacyGuestResults()).toBe(true);
    expect(loadGuestResults()).toEqual([]);
    expect(saveGuestResult(result)).toEqual({
      ok: true,
      deduplicated: false,
    });
    expect(localStorage.getItem("rill.guest-results.v1")).toContain(
      "result-1",
    );
    expect(loadGuestResults()).toEqual([result]);
  });
});
