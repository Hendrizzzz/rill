import { memo, useLayoutEffect, useRef, useState, type RefObject } from "react";

import { segmentGraphemes } from "./inputAdapter";
import type { TypingState } from "./types";

interface WordProps {
  index: number;
  target: string;
  input: readonly string[] | undefined;
  active: boolean;
  committed: boolean;
}

const PromptWord = memo(function PromptWord({
  index,
  target,
  input = [],
  active,
  committed,
}: WordProps) {
  const targetCharacters = segmentGraphemes(target);
  const extras = input.slice(targetCharacters.length);
  const caretIndex = input.length;

  return (
    <span
      className={`prompt-word${active ? " is-active" : ""}`}
      data-prompt-index={index}
      data-prompt-target={target}
    >
      {targetCharacters.map((character, index) => {
        const typed = input[index];
        const className =
          typed === undefined
            ? committed
              ? "is-missing"
              : "is-pending"
            : typed === character
              ? "is-correct"
              : "is-incorrect";
        return (
          <span
            className="prompt-slot"
            key={[String(index), character].join("-")}
          >
            {active && caretIndex === index ? (
              <span className="typing-caret" />
            ) : null}
            <span className="prompt-slot-measure">{character}</span>
            <span className={`prompt-character ${className}`}>
              {character}
            </span>
          </span>
        );
      })}
      {extras.length > 0 ? (
        <span className="prompt-extras">
          {extras.map((character, index) => (
            <span
              className="prompt-character is-extra"
              key={["extra", String(index), character].join("-")}
            >
              {character}
            </span>
          ))}
          {active ? <span className="typing-caret" /> : null}
        </span>
      ) : active && caretIndex >= targetCharacters.length ? (
        <span className="typing-caret" />
      ) : null}
    </span>
  );
});

interface PromptViewProps {
  state: TypingState;
  captureRef: RefObject<HTMLTextAreaElement | null>;
}

export function PromptView({ state, captureRef }: PromptViewProps) {
  const promptWindowRef = useRef<HTMLSpanElement>(null);
  const [windowStart, setWindowStart] = useState(0);
  const windowEnd = Math.min(state.prompt.words.length, windowStart + 80);
  const words = state.prompt.words.slice(windowStart, windowEnd);

  useLayoutEffect(() => {
    const windowElement = promptWindowRef.current;
    if (windowElement === null) {
      return;
    }

    const alignActiveLine = () => {
      const wordElements = Array.from(
        windowElement.querySelectorAll<HTMLElement>("[data-prompt-index]"),
      );
      const activeElement = wordElements.find(
        (element) =>
          Number(element.dataset.promptIndex) === state.wordIndex,
      );
      if (activeElement === undefined) {
        return;
      }

      const windowTop = windowElement.getBoundingClientRect().top;
      const currentScrollTop = windowElement.scrollTop;
      const rows: { top: number; firstWordIndex: number }[] = [];

      for (const element of wordElements) {
        const top = Math.round(
          element.getBoundingClientRect().top -
            windowTop +
            currentScrollTop,
        );
        const previousRow = rows.at(-1);
        if (previousRow === undefined || Math.abs(previousRow.top - top) > 1) {
          rows.push({
            top,
            firstWordIndex: Number(element.dataset.promptIndex),
          });
        }
      }

      const activeTop = Math.round(
        activeElement.getBoundingClientRect().top -
          windowTop +
          currentScrollTop,
      );
      const activeRowIndex = rows.findIndex(
        (row) => Math.abs(row.top - activeTop) <= 1,
      );
      const previousRow =
        activeRowIndex >= 2 ? rows[activeRowIndex - 1] : undefined;
      const nextScrollTop = previousRow?.top ?? 0;

      if (Math.abs(windowElement.scrollTop - nextScrollTop) > 1) {
        windowElement.scrollTo({ top: nextScrollTop, behavior: "auto" });
      }

      if (
        windowEnd < state.prompt.words.length &&
        state.wordIndex >= windowEnd - 16 &&
        previousRow !== undefined &&
        previousRow.firstWordIndex > windowStart
      ) {
        setWindowStart(previousRow.firstWordIndex);
      }
    };

    alignActiveLine();
    const observer = new ResizeObserver(alignActiveLine);
    observer.observe(windowElement);
    return () => {
      observer.disconnect();
    };
  }, [
    state.prompt.words.length,
    state.wordIndex,
    windowEnd,
    windowStart,
  ]);

  return (
    <button
      type="button"
      className="prompt-focus-surface"
      aria-label="Focus typing input"
      onPointerDown={(event) => {
        event.preventDefault();
        captureRef.current?.focus({ preventScroll: true });
      }}
      onClick={() => {
        captureRef.current?.focus({ preventScroll: true });
      }}
    >
      <span
        ref={promptWindowRef}
        className="prompt-window"
        aria-hidden="true"
      >
        {words.map((target, offset) => {
          const absoluteIndex = windowStart + offset;
          const input =
            absoluteIndex < state.wordIndex
              ? state.committedWords[absoluteIndex]
              : absoluteIndex === state.wordIndex
                ? state.currentInput
                : undefined;
          return (
            <PromptWord
              key={[String(absoluteIndex), target].join("-")}
              index={absoluteIndex}
              target={target}
              input={input}
              active={
                absoluteIndex === state.wordIndex &&
                state.status !== "completed"
              }
              committed={absoluteIndex < state.wordIndex}
            />
          );
        })}
      </span>
    </button>
  );
}
