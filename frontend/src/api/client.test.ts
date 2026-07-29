import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TypingResult } from "../features/typing/types";

const guestSession = {
  authenticated: false,
  csrfToken: "csrf-guest",
};

const accountSession = {
  authenticated: true,
  user: {
    id: "7f12cb7c-cf3a-43eb-a195-c611073c30c7",
    username: "river_reader",
    createdAt: "2026-07-26T00:00:00Z",
  },
  csrfToken: "csrf-account",
};

const localResult: TypingResult = {
  clientResultId: "5bf586b8-d887-47bb-b512-97ca796451f7",
  mode: "time",
  modeValue: 30,
  punctuation: false,
  numbers: false,
  contentType: "words",
  language: "en",
  wordListVersion: "en-v1",
  errorPolicy: "normal",
  durationMs: 30_000,
  typedCharacters: 100,
  correctAttempts: 95,
  incorrectAttempts: 5,
  correctCharacters: 92,
  incorrectCharacters: 3,
  missingCharacters: 1,
  extraAttempts: 2,
  correctedErrors: 3,
  wpm: 36.8,
  rawWpm: 40,
  accuracy: 95,
  consistency: 88,
  paceBuckets: [
    {
      durationMs: 1_000,
      typedCharacters: 3,
      correctCharacters: 3,
      rawCharacters: 3,
      errors: 0,
    },
  ],
  completedAt: "2026-07-26T00:00:00Z",
  completionReason: "time",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function serverResult(overrides: Record<string, unknown> = {}) {
  return {
    id: "0f644e55-a0d0-4b87-9aa7-c2836ac745cb",
    clientResultId: localResult.clientResultId,
    mode: "TIME",
    modeValue: 30,
    punctuation: false,
    numbers: false,
    contentType: "WORDS",
    language: "EN",
    wordListVersion: "en-v1",
    errorPolicy: "NORMAL",
    durationMs: 30_000,
    typedCharacters: 100,
    correctAttempts: 95,
    incorrectAttempts: 5,
    correctCharacters: 92,
    incorrectCharacters: 3,
    missingCharacters: 1,
    extraAttempts: 2,
    correctedErrors: 3,
    wpm: 36.8,
    rawWpm: 40,
    accuracy: 95,
    consistency: 88,
    paceBuckets: [
      {
        durationMs: 1_000,
        typedCharacters: 3,
        correctCharacters: 3,
        rawCharacters: 3,
        errors: 0,
      },
    ],
    completedAt: "2026-07-26T00:00:00Z",
    completionReason: "TIME",
    oldestResultsPruned: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API client", () => {
  it("deduplicates concurrent session bootstraps", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn<typeof fetch>().mockReturnValue(pendingResponse);
    vi.stubGlobal("fetch", fetchMock);
    const { bootstrapSession } = await import("./client");

    const first = bootstrapSession();
    const second = bootstrapSession();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveResponse?.(jsonResponse(guestSession));
    await expect(first).resolves.toEqual(guestSession);
    await expect(second).resolves.toEqual(guestSession);
  });

  it("bootstraps a CSRF token before a state-changing request", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(guestSession))
      .mockResolvedValueOnce(jsonResponse(accountSession));
    vi.stubGlobal("fetch", fetchMock);
    const { login } = await import("./client");

    await expect(login("river_reader", "a sufficiently long password")).resolves.toEqual(
      accountSession,
    );
    const secondCall = fetchMock.mock.calls[1];
    expect(secondCall?.[0]).toBe("/api/auth/login");
    expect(new Headers(secondCall?.[1]?.headers).get("X-XSRF-TOKEN")).toBe(
      "csrf-guest",
    );
    expect(secondCall?.[1]?.credentials).toBe("same-origin");
  });

  it("re-bootstraps once and retries a rejected CSRF request", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(guestSession))
      .mockResolvedValueOnce(
        jsonResponse(
          { code: "CSRF_REJECTED", detail: "Refresh the request token." },
          403,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({ ...guestSession, csrfToken: "csrf-refreshed" }),
      )
      .mockResolvedValueOnce(jsonResponse(accountSession));
    vi.stubGlobal("fetch", fetchMock);
    const { login } = await import("./client");

    await login("river_reader", "a sufficiently long password");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const retryCall = fetchMock.mock.calls[3];
    expect(new Headers(retryCall?.[1]?.headers).get("X-XSRF-TOKEN")).toBe(
      "csrf-refreshed",
    );
  });

  it("uses a safe fallback for non-JSON gateway and security errors", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(guestSession))
      .mockResolvedValueOnce(
        new Response("Invalid CORS request", {
          status: 403,
          headers: { "Content-Type": "text/plain" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { login } = await import("./client");

    await expect(
      login("river_reader", "a sufficiently long password"),
    ).rejects.toMatchObject({
      status: 403,
      message: "The service rejected the request.",
    });
  });

  it("maps only the declared result fields", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(guestSession))
      .mockResolvedValueOnce(jsonResponse(serverResult()));
    vi.stubGlobal("fetch", fetchMock);
    const { saveAccountResult } = await import("./client");

    const saved = await saveAccountResult(localResult);
    expect(saved).toEqual(localResult);
    expect(saved).not.toHaveProperty("id");
    expect(saved).not.toHaveProperty("oldestResultsPruned");
  });

  it("sends the minimum normalized word-test duration", async () => {
    const normalized: TypingResult = {
      ...localResult,
      mode: "words",
      modeValue: 10,
      durationMs: 250,
      typedCharacters: 1,
      correctAttempts: 1,
      incorrectAttempts: 0,
      correctCharacters: 1,
      incorrectCharacters: 0,
      missingCharacters: 0,
      extraAttempts: 0,
      correctedErrors: 0,
      wpm: 48,
      rawWpm: 48,
      accuracy: 100,
      consistency: 0,
      paceBuckets: [],
      completionReason: "finished",
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(guestSession))
      .mockResolvedValueOnce(
        jsonResponse(
          serverResult({
            mode: "WORDS",
            modeValue: 10,
            durationMs: 250,
            typedCharacters: 1,
            correctAttempts: 1,
            incorrectAttempts: 0,
            correctCharacters: 1,
            incorrectCharacters: 0,
            missingCharacters: 0,
            extraAttempts: 0,
            correctedErrors: 0,
            wpm: 48,
            rawWpm: 48,
            accuracy: 100,
            consistency: 0,
            paceBuckets: [],
            completionReason: "FINISHED",
          }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { saveAccountResult } = await import("./client");

    await expect(saveAccountResult(normalized)).resolves.toEqual(normalized);
    const requestBody = fetchMock.mock.calls[1]?.[1]?.body;
    expect(typeof requestBody).toBe("string");
    expect(
      typeof requestBody === "string"
        ? (JSON.parse(requestBody) as Record<string, unknown>).durationMs
        : undefined,
    ).toBe(250);
  });

  it("round trips the code language dimension", async () => {
    const codeResult: TypingResult = {
      ...localResult,
      mode: "words",
      modeValue: 7,
      contentType: "code",
      language: "en",
      codeLanguage: "go",
      wordListVersion: "code-v2",
      completionReason: "finished",
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(guestSession))
      .mockResolvedValueOnce(
        jsonResponse(
          serverResult({
            mode: "WORDS",
            modeValue: 7,
            contentType: "CODE",
            codeLanguage: "GO",
            wordListVersion: "code-v2",
            completionReason: "FINISHED",
          }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { saveAccountResult } = await import("./client");

    await expect(saveAccountResult(codeResult)).resolves.toEqual(codeResult);
    const request = fetchMock.mock.calls[1]?.[1];
    expect(typeof request?.body).toBe("string");
    const body: unknown =
      typeof request?.body === "string"
        ? (JSON.parse(request.body) as unknown)
        : null;
    expect(body).toMatchObject({
      contentType: "CODE",
      language: "EN",
      codeLanguage: "GO",
      wordListVersion: "code-v2",
    });
  });

  it("preserves a delayed code-v1 result through account sync", async () => {
    const legacyCodeResult: TypingResult = {
      ...localResult,
      mode: "words",
      modeValue: 7,
      contentType: "code",
      language: "en",
      codeLanguage: "python3",
      wordListVersion: "code-v1",
      completionReason: "finished",
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(guestSession))
      .mockResolvedValueOnce(
        jsonResponse(
          serverResult({
            mode: "WORDS",
            modeValue: 7,
            contentType: "CODE",
            codeLanguage: "PYTHON3",
            wordListVersion: "code-v1",
            completionReason: "FINISHED",
          }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { saveAccountResult } = await import("./client");

    await expect(saveAccountResult(legacyCodeResult)).resolves.toEqual(
      legacyCodeResult,
    );
    const body = fetchMock.mock.calls[1]?.[1]?.body;
    expect(typeof body).toBe("string");
    expect(
      typeof body === "string"
        ? (JSON.parse(body) as Record<string, unknown>).wordListVersion
        : undefined,
    ).toBe("code-v1");
  });

  it("maps a cursor-paginated result page without exposing server fields", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        items: [serverResult()],
        nextCursor: "next-page",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { loadAccountResults } = await import("./client");

    await expect(loadAccountResults("current-page", 12)).resolves.toEqual({
      items: [
        localResult,
      ],
      nextCursor: "next-page",
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/results?limit=12&cursor=current-page",
    );
  });

  it.each([
    {
      serverReason: "FINISHED",
      mode: "WORDS",
      modeValue: 10,
      durationMs: 2_000,
      expected: "finished",
    },
    {
      serverReason: "TIME",
      mode: "TIME",
      modeValue: 30,
      durationMs: 30_000,
      expected: "time",
    },
    {
      serverReason: "LIMIT",
      mode: "WORDS",
      modeValue: 10,
      durationMs: 600_000,
      expected: "limit",
    },
    {
      serverReason: "PROMPT_EXHAUSTED",
      mode: "WORDS",
      modeValue: 10,
      durationMs: 2_000,
      expected: "prompt-exhausted",
    },
  ])(
    "maps the $serverReason completion reason",
    async ({ serverReason, mode, modeValue, durationMs, expected }) => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
        jsonResponse({
          items: [
            serverResult({
              completionReason: serverReason,
              mode,
              modeValue,
              durationMs,
            }),
          ],
        }),
      );
      vi.stubGlobal("fetch", fetchMock);
      const { loadAccountResults } = await import("./client");

      await expect(loadAccountResults()).resolves.toMatchObject({
        items: [{ completionReason: expected }],
      });
    },
  );

  it("maps account totals and partitioned personal records", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        totalRuns: 4,
        totalPracticeMs: 120_000,
        highestWpm: 72.5,
        averageAccuracy: 96.25,
        records: [
          {
            key: {
              mode: "TIME",
              modeValue: 30,
              punctuation: false,
              numbers: false,
              contentType: "WORDS",
              language: "EN",
              wordListVersion: "en-v1",
              errorPolicy: "NORMAL",
            },
            result: serverResult({ wpm: 72.5 }),
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { loadAccountSummary } = await import("./client");

    await expect(loadAccountSummary()).resolves.toMatchObject({
      totalRuns: 4,
      highestWpm: 72.5,
      records: [
        {
          key: {
            mode: "time",
            modeValue: 30,
            contentType: "words",
            language: "en",
            wordListVersion: "en-v1",
            errorPolicy: "normal",
          },
          result: { wpm: 72.5, completionReason: "time" },
        },
      ],
    });
  });

  it("downloads an account export with the server filename", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response('{"schemaVersion":1}', {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": 'attachment; filename="rill-export-test.json"',
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { downloadAccountExport } = await import("./client");

    const exported = await downloadAccountExport();
    expect(exported.filename).toBe("rill-export-test.json");
    await expect(exported.blob.text()).resolves.toContain('"schemaVersion":1');
  });

  it("reports an expired session while exporting", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(
        { code: "AUTHENTICATION_REQUIRED", detail: "Sign in to continue." },
        401,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const expired = vi.fn();
    const { downloadAccountExport, SESSION_EXPIRED_EVENT } = await import("./client");
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);

    await expect(downloadAccountExport()).rejects.toMatchObject({
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
    });
    expect(expired).toHaveBeenCalledOnce();
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  });

  it("rejects malformed successful responses", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ ...guestSession, csrfToken: 42 }));
    vi.stubGlobal("fetch", fetchMock);
    const { ApiError, bootstrapSession } = await import("./client");

    await expect(bootstrapSession()).rejects.toMatchObject({
      name: ApiError.name,
      status: 502,
      code: "INVALID_RESPONSE",
    });
  });

  it("announces an expired authenticated session", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(
          { code: "AUTHENTICATION_REQUIRED", detail: "Sign in to continue." },
          401,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const expired = vi.fn();
    const { loadAccountResults, SESSION_EXPIRED_EVENT } = await import("./client");
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);

    await expect(loadAccountResults()).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(requestInit?.signal).toBeInstanceOf(AbortSignal);

    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  });
});
