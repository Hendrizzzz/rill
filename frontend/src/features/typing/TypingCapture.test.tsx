import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TypingCapture } from "./TypingCapture";

afterEach(cleanup);

function renderCapture() {
  const onInsert = vi.fn();
  const onBackspace = vi.fn();
  render(
    <TypingCapture
      status="ready"
      currentWordId="current-word"
      instructionsId="instructions"
      onInsert={onInsert}
      onBackspace={onBackspace}
      onRestart={vi.fn()}
      onNotice={vi.fn()}
      captureRef={createRef<HTMLTextAreaElement>()}
    />,
  );
  return {
    input: screen.getByRole("textbox", { name: "Typing input" }),
    onInsert,
    onBackspace,
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
    expect(onInsert).toHaveBeenNthCalledWith(1, "a");
    expect(onInsert).toHaveBeenNthCalledWith(2, "b");
  });

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
});
