import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type CompositionEvent,
  type InputEvent as ReactInputEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";

import {
  normalizeInputGrapheme,
  segmentGraphemes,
  translateBeforeInput,
} from "./inputAdapter";

interface TypingCaptureProps {
  status: "ready" | "running" | "completed";
  codeMode?: boolean;
  runId: string;
  currentWordId: string;
  instructionsId: string;
  onInsert: (graphemes: readonly string[]) => void;
  onStart: () => void;
  onBackspace: () => void;
  onDeleteWordBackward: () => void;
  onCompositionChange: (value: string) => void;
  onFocusChange: (focused: boolean) => void;
  onRestart: () => void;
  onNavigateToRestart: () => void;
  onNotice: (message: string) => void;
  captureRef: RefObject<HTMLTextAreaElement | null>;
}

function isApplePlatform(): boolean {
  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform =
    navigatorWithUserAgentData.userAgentData?.platform ??
    navigator.platform;
  return /^(Mac|iPhone|iPad|iPod)/i.test(platform);
}

export function TypingCapture({
  status,
  codeMode = false,
  runId,
  currentWordId,
  instructionsId,
  onInsert,
  onStart,
  onBackspace,
  onDeleteWordBackward,
  onCompositionChange,
  onFocusChange,
  onRestart,
  onNavigateToRestart,
  onNotice,
  captureRef,
}: TypingCaptureProps) {
  const composing = useRef(false);
  const compositionRunId = useRef<string | null>(null);

  useEffect(() => {
    composing.current = false;
    compositionRunId.current = null;
    onCompositionChange("");
    if (captureRef.current !== null) {
      captureRef.current.value = "";
    }
    captureRef.current?.focus({ preventScroll: true });
  }, [captureRef, onCompositionChange, runId]);

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
        onInsert(decision.graphemes);
      } else if (decision.kind === "backspace") {
        onBackspace();
      } else if (decision.kind === "deleteWordBackward") {
        onDeleteWordBackward();
      } else if (decision.kind === "reject") {
        onNotice(
          decision.reason === "paste"
            ? "Paste is disabled during a test."
            : "Text replacement is disabled during a test.",
        );
      }
    },
    [onBackspace, onDeleteWordBackward, onInsert, onNotice],
  );

  useLayoutEffect(() => {
    const target = captureRef.current;
    if (target === null) {
      return;
    }

    const handleBeforeInput = (event: InputEvent) => {
      const decision = translateBeforeInput(
        event.inputType,
        event.data,
        composing.current || event.isComposing,
        codeMode,
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
  }, [applyDecision, captureRef, clearValue, codeMode]);

  const handleCompositionEnd = useCallback(
    (event: CompositionEvent<HTMLTextAreaElement>) => {
      composing.current = false;
      const belongsToCurrentRun = compositionRunId.current === runId;
      compositionRunId.current = null;
      onCompositionChange("");
      if (belongsToCurrentRun) {
        const graphemes = segmentGraphemes(event.data).map(
          normalizeInputGrapheme,
        );
        if (graphemes.length > 0) {
          onInsert(graphemes);
        }
      }
      event.currentTarget.value = "";
    },
    [onCompositionChange, onInsert, runId],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.nativeEvent.isComposing || composing.current) {
        return;
      }
      if (
        event.key === "Tab" &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        onNavigateToRestart();
        return;
      }
      if (
        event.key === "Backspace" &&
        !event.metaKey &&
        !event.nativeEvent.getModifierState("AltGraph") &&
        ((event.ctrlKey && !event.altKey) ||
          (event.altKey && !event.ctrlKey && isApplePlatform()))
      ) {
        event.preventDefault();
        onDeleteWordBackward();
        return;
      }
      if (
        event.key === "Home" ||
        event.key === "End" ||
        event.key === "PageUp" ||
        event.key === "PageDown" ||
        event.key.startsWith("Arrow")
      ) {
        event.preventDefault();
        return;
      }
      if (
        codeMode &&
        status !== "completed" &&
        event.key === "Enter" &&
        !event.repeat &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        onInsert(["\n"]);
        return;
      }
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
    [
      onBackspace,
      codeMode,
      onDeleteWordBackward,
      onInsert,
      onNavigateToRestart,
      onRestart,
      status,
    ],
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
      onFocus={() => {
        onFocusChange(true);
      }}
      onBlur={() => {
        onFocusChange(false);
      }}
      onCompositionStart={() => {
        composing.current = true;
        compositionRunId.current = runId;
        onCompositionChange("");
        onStart();
      }}
      onCompositionUpdate={(event) => {
        onCompositionChange(event.data);
      }}
      onCompositionEnd={handleCompositionEnd}
      onCopy={(event) => {
        event.preventDefault();
      }}
      onPaste={(event) => {
        event.preventDefault();
        onNotice("Paste is disabled during a test.");
      }}
      onDrop={(event) => {
        event.preventDefault();
        onNotice("Paste is disabled during a test.");
      }}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
    />
  );
}
