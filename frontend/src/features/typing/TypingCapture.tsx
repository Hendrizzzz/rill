import {
  useCallback,
  useEffect,
  useRef,
  type CompositionEvent,
  type InputEvent as ReactInputEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";

import { segmentGraphemes, translateBeforeInput } from "./inputAdapter";

interface TypingCaptureProps {
  status: "ready" | "running" | "completed";
  currentWordId: string;
  instructionsId: string;
  onInsert: (grapheme: string) => void;
  onBackspace: () => void;
  onRestart: () => void;
  onNotice: (message: string) => void;
  captureRef: RefObject<HTMLTextAreaElement | null>;
}

export function TypingCapture({
  status,
  currentWordId,
  instructionsId,
  onInsert,
  onBackspace,
  onRestart,
  onNotice,
  captureRef,
}: TypingCaptureProps) {
  const composing = useRef(false);

  useEffect(() => {
    captureRef.current?.focus({ preventScroll: true });
  }, [captureRef]);

  const clearValue = useCallback(
    (target: HTMLTextAreaElement) => {
      if (!composing.current) {
        target.value = "";
      }
    },
    [],
  );

  const applyDecision = useCallback(
    (decision: ReturnType<typeof translateBeforeInput>) => {
      if (decision.kind === "insert") {
        decision.graphemes.forEach((grapheme) => {
          onInsert(grapheme);
        });
      } else if (decision.kind === "backspace") {
        onBackspace();
      } else if (decision.kind === "reject") {
        onNotice(
          decision.reason === "paste"
            ? "Paste is disabled during a test."
            : "Text replacement is disabled during a test.",
        );
      }
    },
    [onBackspace, onInsert, onNotice],
  );

  useEffect(() => {
    const target = captureRef.current;
    if (target === null) {
      return;
    }

    const handleBeforeInput = (event: InputEvent) => {
      const decision = translateBeforeInput(
        event.inputType,
        event.data,
        composing.current || event.isComposing,
      );

      if (decision.kind === "allow") {
        return;
      }
      event.preventDefault();
      applyDecision(decision);
      clearValue(target);
    };

    target.addEventListener("beforeinput", handleBeforeInput);
    return () => {
      target.removeEventListener("beforeinput", handleBeforeInput);
    };
  }, [applyDecision, captureRef, clearValue]);

  const handleCompositionEnd = useCallback(
    (event: CompositionEvent<HTMLTextAreaElement>) => {
      composing.current = false;
      segmentGraphemes(event.data).forEach(onInsert);
      event.currentTarget.value = "";
    },
    [onInsert],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        (event.repeat && event.key !== "Backspace") ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey
      ) {
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        onBackspace();
        return;
      }
      if (event.key === "Escape" || (event.key === "Enter" && status === "completed")) {
        event.preventDefault();
        onRestart();
      }
    },
    [onBackspace, onRestart, status],
  );

  const handleInput = useCallback(
    (event: ReactInputEvent<HTMLTextAreaElement>) => {
      clearValue(event.currentTarget);
    },
    [clearValue],
  );

  return (
    <textarea
      ref={captureRef}
      className="typing-capture"
      aria-label="Typing input"
      aria-describedby={
        status === "completed"
          ? undefined
          : `${currentWordId} ${instructionsId}`
      }
      autoCapitalize="none"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      rows={1}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={handleCompositionEnd}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
    />
  );
}
