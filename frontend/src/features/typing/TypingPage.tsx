import { useCallback, useEffect, useRef, useState } from "react";

import { PromptView } from "./PromptView";
import { ResultsView } from "./ResultsView";
import { TestControls } from "./TestControls";
import { TypingCapture } from "./TypingCapture";
import { useTypingSession } from "./useTypingSession";

export function TypingPage() {
  const {
    state,
    elapsedMs,
    remainingMs,
    saveStatus,
    insert,
    backspace,
    restart,
    changeConfig,
  } = useTypingSession();
  const captureRef = useRef<HTMLTextAreaElement>(null);
  const firstControlRef = useRef<HTMLButtonElement>(null);
  const [notice, setNotice] = useState("");
  const currentWord = state.prompt.words[state.wordIndex] ?? "";
  const controlsDisabled = state.status === "running";

  const focusCapture = useCallback(() => {
    requestAnimationFrame(() => {
      captureRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const restartAndFocus = useCallback(() => {
    restart();
    focusCapture();
  }, [focusCapture, restart]);

  useEffect(() => {
    if (state.status !== "completed") {
      return undefined;
    }

    const handleCompletedEnter = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.key !== "Enter" ||
        event.repeat ||
        event.isComposing ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof Element &&
        (target.closest("dialog[open]") !== null ||
          target.closest(
            'button, a[href], textarea, select, input:not([type="range"]), [contenteditable="true"]',
          ) !== null)
      ) {
        return;
      }

      event.preventDefault();
      restartAndFocus();
    };

    window.addEventListener("keydown", handleCompletedEnter);
    return () => {
      window.removeEventListener("keydown", handleCompletedEnter);
    };
  }, [restartAndFocus, state.status]);

  const changeTest = () => {
    restart();
    requestAnimationFrame(() => {
      firstControlRef.current?.focus({ preventScroll: true });
    });
  };

  return (
    <main className={`test-page test-page--${state.status}`}>
      <h1 className="sr-only">Rill typing test</h1>
      {state.status !== "completed" ? (
        <>
          <TestControls
            firstControlRef={firstControlRef}
            config={state.config}
            disabled={controlsDisabled}
            onChange={(config) => {
              changeConfig(config);
              focusCapture();
            }}
          />
          <div className="test-status" aria-hidden="true">
            <span>
              {state.config.mode === "time"
                ? [
                    String(
                      Math.ceil(
                        (remainingMs ?? state.config.modeValue * 1_000) / 1_000,
                      ),
                    ),
                    "s",
                  ].join("")
                : [
                    String(
                      Math.min(
                        state.wordIndex + 1,
                        state.prompt.words.length,
                      ),
                    ),
                    String(state.prompt.words.length),
                  ].join("/")}
            </span>
            <span>
              {state.status === "ready"
                ? "begin when ready"
                : [(elapsedMs / 1_000).toFixed(1), " elapsed"].join("")}
            </span>
          </div>
          <PromptView
            key={state.runId}
            state={state}
            captureRef={captureRef}
          />
          <div className="typing-accessibility">
            <p id="typing-instructions">
              {state.status === "ready"
                ? "Start typing to begin. Press Escape to restart. Tab moves to controls."
                : "Typing test in progress. Elapsed time continues if focus leaves the input."}{" "}
              {state.config.mode === "time"
                ? `${String(state.config.modeValue)} second test.`
                : `${String(state.config.modeValue)} word test.`}
            </p>
            <p id="current-target" aria-live="polite" aria-atomic="true">
              Current word: {currentWord}.{" "}
              {state.config.mode === "time"
                ? `${String(Math.ceil((remainingMs ?? state.config.modeValue * 1_000) / 1_000))} seconds remaining.`
                : `Word ${String(state.wordIndex + 1)} of ${String(state.config.modeValue)}.`}
            </p>
          </div>
        </>
      ) : state.result !== null ? (
        <ResultsView
          result={state.result}
          saveStatus={saveStatus}
          onRestart={restartAndFocus}
          onChangeTest={changeTest}
        />
      ) : null}
      <TypingCapture
        captureRef={captureRef}
        status={state.status}
        currentWordId="current-target"
        instructionsId="typing-instructions"
        onInsert={insert}
        onBackspace={backspace}
        onRestart={restartAndFocus}
        onNotice={setNotice}
      />
      <p className="sr-only" role="status" aria-live="polite">
        {notice}
        {state.status === "completed" && state.result !== null
          ? [
              " Test complete. ",
              String(Math.round(state.result.wpm)),
              " words per minute, ",
              state.result.accuracy.toFixed(1),
              " percent accuracy.",
            ].join("")
          : ""}
      </p>
    </main>
  );
}
