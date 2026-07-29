import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as ClientModule from "../../api/client";
import type * as PendingResultsModule from "../../api/pendingResults";
import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./auth-context";

const mocks = vi.hoisted(() => ({
  bootstrapSession: vi.fn(),
  flushAccountResults: vi.fn(),
}));

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof ClientModule>();
  return {
    ...actual,
    bootstrapSession: mocks.bootstrapSession,
  };
});

vi.mock("../../api/pendingResults", async (importOriginal) => {
  const actual = await importOriginal<typeof PendingResultsModule>();
  return {
    ...actual,
    flushAccountResults: mocks.flushAccountResults,
  };
});

function AuthProbe() {
  const auth = useAuth();
  return (
    <>
      <span>{auth.status}</span>
      <span>{auth.syncNotice}</span>
      <button type="button" onClick={auth.clearSyncNotice}>
        clear
      </button>
    </>
  );
}

describe("AuthProvider pending-result feedback", () => {
  beforeEach(() => {
    mocks.bootstrapSession.mockResolvedValue({
      authenticated: true,
      user: {
        id: "account-a",
        username: "reader",
        createdAt: "2026-07-27T00:00:00Z",
      },
      csrfToken: "csrf",
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("surfaces and clears a permanent queued-result discard", async () => {
    mocks.flushAccountResults.mockResolvedValue({
      saved: 0,
      discarded: 1,
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText("authenticated")).toBeInTheDocument();
    expect(
      await screen.findByText(
        "One queued result could not be synced and was removed.",
      ),
    ).toBeInTheDocument();

    screen.getByRole("button", { name: "clear" }).click();
    await waitFor(() => {
      expect(
        screen.queryByText(
          "One queued result could not be synced and was removed.",
        ),
      ).not.toBeInTheDocument();
    });
  });

  it("does not announce a fully successful flush", async () => {
    mocks.flushAccountResults.mockResolvedValue({
      saved: 1,
      discarded: 0,
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText("authenticated")).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.flushAccountResults).toHaveBeenCalledWith(
        "account-a",
        expect.any(Function),
      );
    });
    expect(
      screen.queryByText(/could not be synced/i),
    ).not.toBeInTheDocument();
  });
});
