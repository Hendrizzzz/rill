import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext, type AuthContextValue } from "../account/auth-context";
import { TypingPage } from "./TypingPage";

const guestAuth: AuthContextValue = {
  status: "guest",
  user: null,
  syncNotice: null,
  clearSyncNotice: vi.fn(),
  signIn: vi.fn(),
  register: vi.fn(),
  signOut: vi.fn(),
  deleteAccount: vi.fn(),
  retry: vi.fn(),
};

beforeEach(() => {
  class TestResizeObserver implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPage() {
  render(
    <AuthContext.Provider value={guestAuth}>
      <TypingPage />
    </AuthContext.Provider>,
  );
  return screen.getByRole("textbox", { name: "Typing input" });
}

describe("TypingPage focus recovery", () => {
  it("keeps a visible restart action in the typing flow", async () => {
    renderPage();
    const restart = screen.getByRole("button", { name: "Restart test" });

    expect(restart).toBeVisible();
    fireEvent.click(restart);
    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: "Typing input" }),
      ).toHaveFocus();
    });
  });

  it("keeps the current untyped word visually neutral", () => {
    renderPage();

    expect(document.querySelector('[data-prompt-index="0"]')).not.toHaveClass(
      "is-active",
    );
  });

  it("refocuses from non-editable chrome and swallows the recovery key", () => {
    const input = renderPage();
    const chromeButton = document.createElement("button");
    chromeButton.textContent = "outside control";
    document.body.append(chromeButton);
    chromeButton.focus();
    const event = new KeyboardEvent("keydown", {
      key: "x",
      code: "KeyX",
      bubbles: true,
      cancelable: true,
    });

    fireEvent(chromeButton, event);

    expect(event.defaultPrevented).toBe(true);
    expect(input).toHaveFocus();
    expect(document.querySelectorAll(".prompt-character.is-correct")).toHaveLength(
      0,
    );
  });

  it("prevents Space from scrolling when document body owns focus", () => {
    renderPage();
    document.body.tabIndex = -1;
    document.body.focus();
    const event = new KeyboardEvent("keydown", {
      key: " ",
      code: "Space",
      bubbles: true,
      cancelable: true,
    });

    fireEvent(document.body, event);

    expect(event.defaultPrevented).toBe(true);
  });

  it.each(["CapsLock", "NumLock", "ScrollLock", "AltGraph", "Fn"])(
    "does not refocus or swallow modifier key %s",
    (key) => {
      const input = renderPage();
      const chromeButton = document.createElement("button");
      document.body.append(chromeButton);
      chromeButton.focus();
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      });

      fireEvent(chromeButton, event);

      expect(event.defaultPrevented).toBe(false);
      expect(chromeButton).toHaveFocus();
      expect(input).not.toHaveFocus();
    },
  );
});
