import { useCallback, useEffect, useRef, useState } from "react";

import { PromptView } from "./PromptView";
import { ResultsView } from "./ResultsView";
import { leadingCodeIndentation, typableTarget } from "./targetText";
import { TestControls } from "./TestControls";
import { TypingCapture } from "./TypingCapture";
import { useTypingSession } from "./useTypingSession";

const MODIFIER_KEYS = new Set([
  "Alt",
  "AltGraph",
  "CapsLock",
  "Control",
  "Fn",
  "FnLock",
  "Hyper",
  "Meta",
  "NumLock",
  "OS",
  "Scroll",
  "ScrollLock",
  "Shift",
  "Super",
  "Symbol",
  "SymbolLock",
]);

export function TypingPage() {
  const {
    state,
    elapsedMs,
    remainingMs,
    saveStatus,
    insert,
    start,
    backspace,
    deleteWordBackward,
    restart,
    changeConfig,
  } = useTypingSession();
  const captureRef = useRef<HTMLTextAreaElement>(null);
  const firstControlRef = useRef<HTMLButtonElement>(null);
  const restartButtonRef = useRef<HTMLButtonElement>(null);
  const [notice, setNotice] = useState("");
  const [compositionText, setCompositionText] = useState("");
  const [captureFocused, setCaptureFocused] = useState(false);
  const currentWord = state.prompt.words[state.wordIndex] ?? "";
  const leadingSpaceCount = leadingCodeIndentation(currentWord);
  const currentTypableTarget = typableTarget(
    currentWord,
    state.config.contentType,
  );
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

  useEffect(() => {
    if (state.status === "completed") {
      return undefined;
    }

    const recoverTypingFocus = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (
        event.code === "Space" &&
        (activeElement === document.body ||
          activeElement === document.documentElement)
      ) {
        event.preventDefault();
        return;
      }
      if (
        event.defaultPrevented ||
        captureRef.current === document.activeElement ||
        event.ctrlKey ||
        event.metaKey ||
        MODIFIER_KEYS.has(event.key) ||
        ["Enter", "Escape", " ", "Tab"].includes(event.key)
      ) {
        return;
      }
      if (
        document.querySelector("dialog[open]") !== null ||
        (activeElement instanceof Element &&
          activeElement.matches(
            'input, textarea, select, [contenteditable="true"]',
          ))
      ) {
        return;
      }

      captureRef.current?.focus({ preventScroll: true });
      event.preventDefault();
      setNotice("Typing input refocused. Press the key again.");
    };

    document.addEventListener("keydown", recoverTypingFocus);
    return () => {
      document.removeEventListener("keydown", recoverTypingFocus);
    };
  }, [state.status]);

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
            onChange={(config, customText) => {
              changeConfig(config, customText);
              focusCapture();
            }}
          />
          <div className="typing-stage">
            <div className="test-status" aria-hidden="true">
              <span>
                {state.config.mode === "time"
                  ? [
                      String(
                        Math.ceil(
                          (remainingMs ?? state.config.modeValue * 1_000) /
                            1_000,
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
            <div className="typing-stage-main">
              <div className="prompt-context">
                {state.config.contentType === "code" ? (
                  <header className="code-prompt-intro">
                    <div className="code-prompt-title">
                      <p>{state.prompt.attribution}</p>
                      <h2 id="code-exercise-title">{state.prompt.title}</h2>
                    </div>
                    <div className="code-prompt-learning">
                      <p>{state.prompt.lesson}</p>
                      <small className="code-prompt-assumptions">
                        Assumes {state.prompt.assumptions}.
                      </small>
                    </div>
                    <p className="code-prompt-facts">
                      <span>{state.prompt.topic}</span>
                      <span>{state.prompt.complexity}</span>
                    </p>
                  </header>
                ) : state.prompt.attribution ? (
                  <p className="prompt-attribution">
                    {state.prompt.sourceUrl ? (
                      <a
                        href={state.prompt.sourceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {state.prompt.attribution}
                        {state.prompt.theme ? (
                          <span className="prompt-theme">
                            {" "}· {state.prompt.theme}
                          </span>
                        ) : null}
                        <span className="sr-only">
                          {" "}(opens source in a new tab)
                        </span>
                      </a>
                    ) : (
                      state.prompt.attribution
                    )}
                  </p>
                ) : null}
              </div>
              {state.config.contentType === "code" ? (
                <section
                  className="code-workbench"
                  data-capture-focused={captureFocused ? "true" : undefined}
                  aria-labelledby="code-exercise-title"
                >
                  <PromptView
                    key={state.runId}
                    state={state}
                    captureRef={captureRef}
                    captureFocused={captureFocused}
                    compositionText={compositionText}
                  />
                  <footer className="code-editor-status" aria-hidden="true">
                    <span>spaces: 4</span>
                    <span>
                      line {String(state.wordIndex + 1)} of{" "}
                      {String(state.prompt.words.length)}
                    </span>
                  </footer>
                </section>
              ) : (
                <PromptView
                  key={state.runId}
                  state={state}
                  captureRef={captureRef}
                  captureFocused={captureFocused}
                  compositionText={compositionText}
                />
              )}
              <div className="test-restart-row">
                <button
                  ref={restartButtonRef}
                  type="button"
                  className="test-restart"
                  aria-label="Restart test"
                  title="Restart test"
                  onClick={restartAndFocus}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="M19 7v5h-5" />
                    <path d="M18.1 12a6.5 6.5 0 1 1-1.9-4.6L19 10" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="typing-accessibility">
            <p id="typing-instructions">
              {state.status === "ready"
                ? "Start typing to begin. Press Tab then Enter to restart. Escape also restarts. Use Shift plus Tab to move back through the prompt and test controls."
                : "Typing test in progress. Elapsed time continues if focus leaves the input."}{" "}
              {state.config.errorPolicy === "strict"
                ? "Strict errors are on; later input remains marked incorrect until all retained mistakes are corrected. "
                : ""}
              {state.config.mode === "time"
                ? `${String(state.config.modeValue)} second test.`
                : state.config.contentType === "code"
                  ? `${String(state.prompt.words.length)} line code exercise. Press Enter after each line. Leading indentation is automatic.`
                : `${String(state.prompt.words.length)} word test.`}
            </p>
            <p id="current-target" aria-live="polite" aria-atomic="true">
              {state.config.contentType === "code" ? (
                <>
                  Current line, automatically indented{" "}
                  {String(leadingSpaceCount)}{" "}
                  {leadingSpaceCount === 1 ? "space" : "spaces"}:{" "}
                  <span lang={state.prompt.language} dir="auto">
                    {currentTypableTarget}
                  </span>
                </>
              ) : (
                <>
                  Current word:{" "}
                  <span lang={state.prompt.language} dir="auto">
                    {currentWord}
                  </span>
                </>
              )}
              .
              {state.config.mode === "words"
                ? ` ${state.config.contentType === "code" ? "Line" : "Word"} ${String(state.wordIndex + 1)} of ${String(state.prompt.words.length)}.`
                : null}
            </p>
            {state.config.mode === "time" ? (
              <p role="timer" aria-live="off" aria-atomic="true">
                {String(
                  Math.ceil(
                    (remainingMs ?? state.config.modeValue * 1_000) / 1_000,
                  ),
                )}{" "}
                seconds remaining.
              </p>
            ) : null}
          </div>
        </>
      ) : state.result !== null ? (
        <ResultsView
          result={state.result}
          saveStatus={saveStatus}
          restartButtonRef={restartButtonRef}
          onRestart={restartAndFocus}
          onChangeTest={changeTest}
        />
      ) : null}
      <TypingCapture
        key={state.runId}
        captureRef={captureRef}
        status={state.status}
        codeMode={state.config.contentType === "code"}
        runId={state.runId}
        currentWordId="current-target"
        instructionsId="typing-instructions"
        onInsert={insert}
        onStart={start}
        onBackspace={backspace}
        onDeleteWordBackward={deleteWordBackward}
        onCompositionChange={setCompositionText}
        onFocusChange={setCaptureFocused}
        onRestart={restartAndFocus}
        onNavigateToRestart={() => {
          restartButtonRef.current?.focus({ preventScroll: true });
        }}
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
