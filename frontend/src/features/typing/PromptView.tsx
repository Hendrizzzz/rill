import {
  Fragment,
  memo,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

import { codeSyntaxKinds } from "./codeSyntax";
import { segmentGraphemes } from "./inputAdapter";
import { leadingCodeIndentation, typableTarget } from "./targetText";
import type { CodeLanguage, TypingState } from "./types";

interface WordProps {
  index: number;
  target: string;
  input: readonly string[] | undefined;
  active: boolean;
  committed: boolean;
  language: string;
  codeLanguage?: CodeLanguage | undefined;
  compositionText: string;
  inputCorrectness?: readonly boolean[] | undefined;
}

const PromptWord = memo(function PromptWord({
  index,
  target,
  input = [],
  active,
  committed,
  language,
  codeLanguage,
  compositionText,
  inputCorrectness,
}: WordProps) {
  const targetCharacters = segmentGraphemes(target, language);
  const syntaxKinds = useMemo(
    () =>
      codeLanguage === undefined
        ? []
        : codeSyntaxKinds(target, codeLanguage),
    [codeLanguage, target],
  );
  const extras = input.slice(targetCharacters.length);
  const caretIndex = input.length;

  return (
    <span
      className="prompt-word"
      data-prompt-index={index}
      data-prompt-target={target}
    >
      {targetCharacters.map((character, index) => {
        const typed = input[index];
        const typedCorrectly =
          inputCorrectness?.[index] ?? typed === character;
        const stateClassName =
          typed === undefined
            ? committed
              ? "is-missing"
              : "is-pending"
            : typedCorrectly
              ? "is-correct"
              : "is-incorrect";
        const className = [
          "prompt-character",
          stateClassName,
          character === " " ? "is-whitespace" : "",
          syntaxKinds[index] === undefined
            ? ""
            : `syntax-${syntaxKinds[index]}`,
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <Fragment key={[String(index), character].join("-")}>
            {active && caretIndex === index ? (
              <>
                {compositionText.length > 0 ? (
                  <span className="prompt-composition-anchor">
                    <span className="prompt-composition">
                      {compositionText}
                    </span>
                  </span>
                ) : null}
                <span className="typing-caret" />
              </>
            ) : null}
            <span className="prompt-slot">
              <span className="prompt-slot-measure">{character}</span>
              <span className={className}>{character}</span>
            </span>
          </Fragment>
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
          {active ? (
            <>
              {compositionText.length > 0 ? (
                <span className="prompt-composition-anchor">
                  <span className="prompt-composition">
                    {compositionText}
                  </span>
                </span>
              ) : null}
              <span className="typing-caret" />
            </>
          ) : null}
        </span>
      ) : active && caretIndex >= targetCharacters.length ? (
        <>
          {compositionText.length > 0 ? (
            <span className="prompt-composition-anchor">
              <span className="prompt-composition">{compositionText}</span>
            </span>
          ) : null}
          <span className="typing-caret" />
        </>
      ) : null}
    </span>
  );
});

interface PromptViewProps {
  state: TypingState;
  captureRef: RefObject<HTMLTextAreaElement | null>;
  captureFocused: boolean;
  compositionText: string;
}

export function PromptView({
  state,
  captureRef,
  captureFocused,
  compositionText,
}: PromptViewProps) {
  const promptWindowRef = useRef<HTMLSpanElement>(null);
  const visualCaretRef = useRef<HTMLSpanElement>(null);
  const visualCaretPositionedRef = useRef(false);
  const [windowStart, setWindowStart] = useState(0);
  const visibleWindowStart =
    state.wordIndex < windowStart
      ? Math.max(0, state.wordIndex - 16)
      : windowStart;
  const windowEnd = Math.min(
    state.prompt.words.length,
    visibleWindowStart + 80,
  );
  const words = state.prompt.words.slice(visibleWindowStart, windowEnd);
  const inputCorrectnessByWord = useMemo(() => {
    const correctness = new Map<number, boolean[]>();
    for (const event of state.inputEvents) {
      const wordCorrectness = correctness.get(event.wordIndex) ?? [];
      if (event.type === "insert") {
        wordCorrectness.push(event.correct);
      } else {
        wordCorrectness.pop();
      }
      correctness.set(event.wordIndex, wordCorrectness);
    }
    return correctness;
  }, [state.inputEvents]);

  useLayoutEffect(() => {
    const windowElement = promptWindowRef.current;
    if (windowElement === null) {
      return;
    }

    const alignActiveLine = () => {
      if (state.wordIndex < windowStart) {
        setWindowStart(Math.max(0, state.wordIndex - 16));
        return;
      }

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
        previousRow.firstWordIndex > visibleWindowStart
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
    visibleWindowStart,
    windowStart,
  ]);

  useLayoutEffect(() => {
    const windowElement = promptWindowRef.current;
    if (
      windowElement === null ||
      state.config.contentType !== "code"
    ) {
      return;
    }
    const alignCaret = () => {
      const caret = windowElement.querySelector<HTMLElement>(".typing-caret");
      if (caret === null) {
        return;
      }

      const viewport = windowElement.getBoundingClientRect();
      const caretBounds = caret.getBoundingClientRect();
      const activeRow = caret.closest<HTMLElement>(".prompt-code-row");
      const lineNumber =
        activeRow?.querySelector<HTMLElement>(".prompt-code-line-number");
      const leftBoundary =
        (lineNumber?.getBoundingClientRect().right ?? viewport.left) + 12;
      const rightInset = 16;
      let nextScrollLeft = windowElement.scrollLeft;
      if (caretBounds.right > viewport.right - rightInset) {
        nextScrollLeft += caretBounds.right - (viewport.right - rightInset);
      } else if (caretBounds.left < leftBoundary) {
        nextScrollLeft += caretBounds.left - leftBoundary;
      }

      if (Math.abs(windowElement.scrollLeft - nextScrollLeft) > 1) {
        windowElement.scrollTo({
          left: Math.max(0, nextScrollLeft),
          behavior: "auto",
        });
      }
    };

    alignCaret();
    const observer = new ResizeObserver(alignCaret);
    observer.observe(windowElement);
    window.visualViewport?.addEventListener("resize", alignCaret);
    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener("resize", alignCaret);
    };
  }, [
    captureFocused,
    state.config.contentType,
    state.currentInput.length,
    state.wordIndex,
  ]);

  useLayoutEffect(() => {
    const windowElement = promptWindowRef.current;
    const visualCaret = visualCaretRef.current;
    if (windowElement === null || visualCaret === null) {
      return;
    }

    const alignVisualCaret = () => {
      const anchor = windowElement.querySelector<HTMLElement>(
        ".typing-caret",
      );
      if (anchor === null) {
        visualCaret.dataset.visible = "false";
        visualCaret.classList.remove("is-animated");
        visualCaretPositionedRef.current = false;
        return;
      }

      const viewport = windowElement.getBoundingClientRect();
      const anchorBounds = anchor.getBoundingClientRect();
      const windowStyles = window.getComputedStyle(windowElement);
      const parsedLineHeight = Number.parseFloat(windowStyles.lineHeight);
      const parsedFontSize = Number.parseFloat(windowStyles.fontSize);
      const fallbackLineHeight =
        (Number.isFinite(parsedLineHeight) ? parsedLineHeight : undefined) ??
        (Number.isFinite(parsedFontSize) ? parsedFontSize * 1.3 : 24);
      const anchorHeight = anchorBounds.height || fallbackLineHeight;
      const verticalInset = Math.min(2, anchorHeight / 4);
      const left =
        anchorBounds.left - viewport.left + windowElement.scrollLeft;
      const top =
        anchorBounds.top -
        viewport.top +
        windowElement.scrollTop +
        verticalInset;

      if (!visualCaretPositionedRef.current) {
        visualCaret.classList.remove("is-animated");
      }
      visualCaret.style.setProperty("--caret-x", `${String(left)}px`);
      visualCaret.style.setProperty("--caret-y", `${String(top)}px`);
      visualCaret.style.setProperty(
        "--caret-height",
        `${String(Math.max(2, anchorHeight - verticalInset * 2))}px`,
      );
      visualCaret.dataset.visible = "true";

      if (!visualCaretPositionedRef.current) {
        // Commit the initial position before enabling interpolation so focus and
        // restarts never animate the caret in from the corner of the prompt.
        void visualCaret.getBoundingClientRect();
        visualCaret.classList.add("is-animated");
        visualCaretPositionedRef.current = true;
      }
    };

    alignVisualCaret();
    const observer = new ResizeObserver(alignVisualCaret);
    observer.observe(windowElement);
    window.visualViewport?.addEventListener("resize", alignVisualCaret);
    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener(
        "resize",
        alignVisualCaret,
      );
    };
  }, [
    captureFocused,
    compositionText,
    state.config.contentType,
    state.currentInput.length,
    state.prompt.id,
    state.status,
    state.wordIndex,
    visibleWindowStart,
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
        className={[
          "prompt-window",
          state.config.contentType === "code" ? "prompt-window--code" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden="true"
        lang={state.prompt.language}
        dir={state.config.contentType === "code" ? "ltr" : "auto"}
      >
        <span
          ref={visualCaretRef}
          className="typing-caret-visual"
          data-visible="false"
        />
        {words.map((target, offset) => {
          const absoluteIndex = visibleWindowStart + offset;
          const codeMode = state.config.contentType === "code";
          const displayIndentation = codeMode
            ? leadingCodeIndentation(target)
            : 0;
          const inputTarget = typableTarget(
            target,
            state.config.contentType,
          );
          const isCurrent =
            absoluteIndex === state.wordIndex &&
            state.status !== "completed";
          const showCaret = isCurrent && captureFocused;
          const input =
            absoluteIndex < state.wordIndex
              ? state.committedWords[absoluteIndex]
              : absoluteIndex === state.wordIndex
                ? state.currentInput
                : undefined;
          const promptWord = (
            <PromptWord
              index={absoluteIndex}
              target={inputTarget}
              input={input}
              active={showCaret}
              committed={absoluteIndex < state.wordIndex}
              language={state.prompt.language}
              codeLanguage={
                codeMode
                  ? state.prompt.codeLanguage ??
                    state.config.codeLanguage ??
                    "python3"
                  : undefined
              }
              compositionText={showCaret ? compositionText : ""}
              inputCorrectness={inputCorrectnessByWord
                .get(absoluteIndex)
                ?.slice(0, input?.length)}
            />
          );
          return state.config.contentType === "code" ? (
            <span
              className="prompt-code-row"
              data-active={isCurrent ? "true" : undefined}
              data-source-line={target}
              key={[String(absoluteIndex), target].join("-")}
            >
              <span className="prompt-code-line-number">
                {String(absoluteIndex + 1)}
              </span>
              <span
                className="prompt-code-indent"
                data-indent-columns={displayIndentation}
                style={
                  {
                    "--code-indent-columns": displayIndentation,
                  } as CSSProperties
                }
                aria-hidden="true"
              />
              {promptWord}
            </span>
          ) : (
            <Fragment key={[String(absoluteIndex), target].join("-")}>
              {promptWord}
            </Fragment>
          );
        })}
      </span>
    </button>
  );
}
