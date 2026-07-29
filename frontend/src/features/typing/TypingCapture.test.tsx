import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TypingCapture } from "./TypingCapture";

afterEach(cleanup);
afterEach(() => {
  vi.restoreAllMocks();
});

function renderCapture(
  status: "ready" | "running" | "completed" = "ready",
  codeMode = false,
) {
  const onInsert = vi.fn();
  const onStart = vi.fn();
  const onBackspace = vi.fn();
  const onDeleteWordBackward = vi.fn();
  const onCompositionChange = vi.fn();
  const onFocusChange = vi.fn();
  const onRestart = vi.fn();
  const onNavigateToRestart = vi.fn();
  const onNotice = vi.fn();
  render(
    <TypingCapture
      status={status}
      codeMode={codeMode}
      runId="run-1"
      currentWordId="current-word"
      instructionsId="instructions"
      onInsert={onInsert}
      onStart={onStart}
      onBackspace={onBackspace}
      onDeleteWordBackward={onDeleteWordBackward}
      onCompositionChange={onCompositionChange}
      onFocusChange={onFocusChange}
      onRestart={onRestart}
      onNavigateToRestart={onNavigateToRestart}
      onNotice={onNotice}
      captureRef={createRef<HTMLTextAreaElement>()}
    />,
  );
  return {
    input: screen.getByRole("textbox", { name: "Typing input" }),
    onInsert,
    onStart,
    onBackspace,
    onDeleteWordBackward,
    onCompositionChange,
    onFocusChange,
    onRestart,
    onNavigateToRestart,
    onNotice,
  };
}

describe("TypingCapture", () => {
  it("scores native beforeinput text without relying on React's synthetic event", () => {
    const { input, onInsert } = renderCapture();
    const event = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      data: "ab",
      inputType: "insertText",
    });

    fireEvent(input, event);

    expect(event.defaultPrevented).toBe(true);
    expect(onInsert).toHaveBeenCalledOnce();
    expect(onInsert).toHaveBeenCalledWith(["a", "b"]);
  });

  it("handles native word deletion as one logical action", () => {
    const { input, onBackspace, onDeleteWordBackward } = renderCapture(
      "running",
    );
    const event = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "deleteWordBackward",
    });

    fireEvent(input, event);

    expect(event.defaultPrevented).toBe(true);
    expect(onDeleteWordBackward).toHaveBeenCalledOnce();
    expect(onBackspace).not.toHaveBeenCalled();
  });

  it("starts timing at composition start and commits the final batch once", () => {
    const {
      input,
      onInsert,
      onStart,
      onCompositionChange,
    } = renderCapture();

    fireEvent.compositionStart(input);
    fireEvent.compositionUpdate(input, { data: "\u3042" });
    fireEvent.compositionEnd(input, { data: "\u3042" });

    expect(onStart).toHaveBeenCalledOnce();
    expect(onCompositionChange).toHaveBeenCalledWith("\u3042");
    expect(onCompositionChange).toHaveBeenLastCalledWith("");
    expect(onInsert).toHaveBeenCalledOnce();
    expect(onInsert).toHaveBeenCalledWith(["\u3042"]);
  });

  it("does not commit a late composition result into a restarted run", () => {
    const onInsert = vi.fn();
    const onCompositionChange = vi.fn();
    const captureRef = createRef<HTMLTextAreaElement>();
    const sharedProps = {
      status: "running" as const,
      currentWordId: "current-word",
      instructionsId: "instructions",
      onInsert,
      onStart: vi.fn(),
      onBackspace: vi.fn(),
      onDeleteWordBackward: vi.fn(),
      onCompositionChange,
      onFocusChange: vi.fn(),
      onRestart: vi.fn(),
      onNavigateToRestart: vi.fn(),
      onNotice: vi.fn(),
      captureRef,
    };
    const { rerender } = render(
      <TypingCapture {...sharedProps} runId="run-1" />,
    );
    const input = screen.getByRole("textbox", { name: "Typing input" });

    fireEvent.compositionStart(input);
    rerender(<TypingCapture {...sharedProps} runId="run-2" />);
    fireEvent.compositionEnd(input, { data: "\u3042" });

    expect(onInsert).not.toHaveBeenCalled();
    expect(onCompositionChange).toHaveBeenLastCalledWith("");
  });

  it.each(["formatBold", "insertLineBreak", "deleteContentForward"])(
    "blocks unsupported native mutation %s",
    (inputType) => {
      const { input, onInsert, onBackspace } = renderCapture("running");
      const event = new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType,
      });

      fireEvent(input, event);

      expect(event.defaultPrevented).toBe(true);
      expect(onInsert).not.toHaveBeenCalled();
      expect(onBackspace).not.toHaveBeenCalled();
    },
  );

  it("turns physical and virtual-keyboard Enter into code line breaks", () => {
    const { input, onInsert } = renderCapture("running", true);

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onInsert).toHaveBeenCalledWith(["\n"]);

    onInsert.mockClear();
    const event = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertLineBreak",
    });
    fireEvent(input, event);

    expect(event.defaultPrevented).toBe(true);
    expect(onInsert).toHaveBeenCalledWith(["\n"]);
  });

  it.each(["paste", "drop", "copy"])(
    "prevents direct %s events on the capture field",
    (eventName) => {
      const { input } = renderCapture("running");
      const event = new Event(eventName, {
        bubbles: true,
        cancelable: true,
      });

      fireEvent(input, event);

      expect(event.defaultPrevented).toBe(true);
    },
  );

  it("handles physical backspace while the capture field remains empty", () => {
    const { input, onBackspace } = renderCapture();

    fireEvent.keyDown(input, { key: "Backspace" });

    expect(onBackspace).toHaveBeenCalledOnce();
  });

  it("allows held Backspace to repeat", () => {
    const { input, onBackspace } = renderCapture();

    fireEvent.keyDown(input, { key: "Backspace", repeat: true });

    expect(onBackspace).toHaveBeenCalledOnce();
  });

  it("deletes the active word with Control+Backspace", () => {
    const { input, onBackspace, onDeleteWordBackward } = renderCapture(
      "running",
    );
    const event = new KeyboardEvent("keydown", {
      key: "Backspace",
      code: "Backspace",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    fireEvent(input, event);

    expect(event.defaultPrevented).toBe(true);
    expect(onDeleteWordBackward).toHaveBeenCalledOnce();
    expect(onBackspace).not.toHaveBeenCalled();
  });

  it("uses Option+Backspace as a macOS word-delete fallback", () => {
    vi.spyOn(window.navigator, "platform", "get").mockReturnValue("MacIntel");
    const { input, onBackspace, onDeleteWordBackward } = renderCapture(
      "running",
    );
    const event = new KeyboardEvent("keydown", {
      key: "Backspace",
      code: "Backspace",
      altKey: true,
      bubbles: true,
      cancelable: true,
    });

    fireEvent(input, event);

    expect(event.defaultPrevented).toBe(true);
    expect(onDeleteWordBackward).toHaveBeenCalledOnce();
    expect(onBackspace).not.toHaveBeenCalled();
  });

  it("leaves Alt+Backspace alone on non-Apple platforms", () => {
    vi.spyOn(window.navigator, "platform", "get").mockReturnValue("Win32");
    const { input, onBackspace, onDeleteWordBackward } = renderCapture(
      "running",
    );
    const event = new KeyboardEvent("keydown", {
      key: "Backspace",
      code: "Backspace",
      altKey: true,
      bubbles: true,
      cancelable: true,
    });

    fireEvent(input, event);

    expect(event.defaultPrevented).toBe(false);
    expect(onDeleteWordBackward).not.toHaveBeenCalled();
    expect(onBackspace).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "AltGraph-style Control+Alt",
      ctrlKey: true,
      altKey: true,
      metaKey: false,
    },
    {
      label: "Meta",
      ctrlKey: false,
      altKey: false,
      metaKey: true,
    },
  ])(
    "does not mistake $label+Backspace for word deletion",
    ({ ctrlKey, altKey, metaKey }) => {
      const { input, onBackspace, onDeleteWordBackward } = renderCapture(
        "running",
      );
      const event = new KeyboardEvent("keydown", {
        key: "Backspace",
        code: "Backspace",
        ctrlKey,
        altKey,
        metaKey,
        bubbles: true,
        cancelable: true,
      });

      fireEvent(input, event);

      expect(event.defaultPrevented).toBe(false);
      expect(onDeleteWordBackward).not.toHaveBeenCalled();
      expect(onBackspace).not.toHaveBeenCalled();
    },
  );

  it("does not mutate typing state for Backspace during composition", () => {
    const { input, onBackspace, onDeleteWordBackward } = renderCapture(
      "running",
    );

    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Backspace" });

    expect(onBackspace).not.toHaveBeenCalled();
    expect(onDeleteWordBackward).not.toHaveBeenCalled();
  });

  it.each(["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"])(
    "prevents %s from moving the hidden capture caret or scrolling",
    (key) => {
      const { input } = renderCapture("running");
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      });

      fireEvent(input, event);

      expect(event.defaultPrevented).toBe(true);
    },
  );

  it.each([
    { key: "ArrowLeft", ctrlKey: true, altKey: false, metaKey: false },
    { key: "ArrowRight", ctrlKey: false, altKey: true, metaKey: false },
    { key: "Home", ctrlKey: false, altKey: false, metaKey: true },
  ])(
    "prevents modified navigation key $key",
    ({ key, ctrlKey, altKey, metaKey }) => {
      const { input } = renderCapture("running");
      const event = new KeyboardEvent("keydown", {
        key,
        ctrlKey,
        altKey,
        metaKey,
        bubbles: true,
        cancelable: true,
      });

      fireEvent(input, event);

      expect(event.defaultPrevented).toBe(true);
    },
  );

  it.each([
    { label: "next tab while ready", shiftKey: false, status: "ready" as const },
    {
      label: "previous tab while ready",
      shiftKey: true,
      status: "ready" as const,
    },
    {
      label: "next tab while running",
      shiftKey: false,
      status: "running" as const,
    },
    {
      label: "previous tab while running",
      shiftKey: true,
      status: "running" as const,
    },
  ])(
    "leaves Ctrl+Tab browser navigation untouched for $label",
    ({ shiftKey, status }) => {
      const {
        input,
        onInsert,
        onBackspace,
        onRestart,
        onNavigateToRestart,
        onNotice,
      } = renderCapture(status);
      const event = new KeyboardEvent("keydown", {
        key: "Tab",
        code: "Tab",
        ctrlKey: true,
        shiftKey,
        bubbles: true,
        cancelable: true,
      });

      fireEvent(input, event);

      expect(event.defaultPrevented).toBe(false);
      expect(onInsert).not.toHaveBeenCalled();
      expect(onBackspace).not.toHaveBeenCalled();
      expect(onRestart).not.toHaveBeenCalled();
      expect(onNavigateToRestart).not.toHaveBeenCalled();
      expect(onNotice).not.toHaveBeenCalled();
    },
  );

  it("leaves reverse Tab traversal native", () => {
    const { input, onNavigateToRestart } = renderCapture("running");
    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      code: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    fireEvent(input, event);

    expect(event.defaultPrevented).toBe(false);
    expect(onNavigateToRestart).not.toHaveBeenCalled();
  });

  it.each(["ready", "running", "completed"] as const)(
    "moves plain Tab to restart without mutating a %s test",
    (status) => {
      const {
        input,
        onInsert,
        onBackspace,
        onDeleteWordBackward,
        onRestart,
        onNavigateToRestart,
        onNotice,
      } = renderCapture(status);
      const event = new KeyboardEvent("keydown", {
        key: "Tab",
        code: "Tab",
        bubbles: true,
        cancelable: true,
      });

      fireEvent(input, event);

      expect(event.defaultPrevented).toBe(true);
      expect(onInsert).not.toHaveBeenCalled();
      expect(onBackspace).not.toHaveBeenCalled();
      expect(onDeleteWordBackward).not.toHaveBeenCalled();
      expect(onRestart).not.toHaveBeenCalled();
      expect(onNavigateToRestart).toHaveBeenCalledOnce();
      expect(onNotice).not.toHaveBeenCalled();
    },
  );

  it.each(["ready", "running", "completed"] as const)(
    "restarts a %s test with Escape",
    (status) => {
      const { input, onRestart } = renderCapture(status);
      const event = new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        bubbles: true,
        cancelable: true,
      });

      fireEvent(input, event);

      expect(event.defaultPrevented).toBe(true);
      expect(onRestart).toHaveBeenCalledOnce();
    },
  );

  it.each([
    { status: "ready" as const, restarts: false },
    { status: "running" as const, restarts: false },
    { status: "completed" as const, restarts: true },
  ])(
    "uses Enter restart only when the test is $status",
    ({ status, restarts }) => {
      const { input, onRestart } = renderCapture(status);
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
        cancelable: true,
      });

      fireEvent(input, event);

      expect(event.defaultPrevented).toBe(restarts);
      expect(onRestart).toHaveBeenCalledTimes(restarts ? 1 : 0);
    },
  );
});
