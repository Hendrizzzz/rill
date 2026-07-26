import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { extendPrompt, generatePrompt, createPromptSeed } from "./prompt";
import { createTypingState, typingReducer } from "./reducer";
import {
  loadTestConfig,
  saveGuestResult,
  saveTestConfig,
} from "./storage";
import type { TestConfig } from "./types";
import { isRetryableApiError, saveAccountResult } from "../../api/client";
import { queueAccountResult } from "../../api/pendingResults";
import { useAuth } from "../account/auth-context";

function newRunId(): string {
  return crypto.randomUUID();
}

function makeInitialState() {
  const config = loadTestConfig();
  return createTypingState(config, generatePrompt(config, createPromptSeed()), newRunId());
}

export function useTypingSession() {
  const auth = useAuth();
  const [state, dispatch] = useReducer(typingReducer, undefined, makeInitialState);
  const [displayNow, setDisplayNow] = useState(() => performance.now());
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saved" | "queued" | "unavailable"
  >("idle");
  const persistedId = useRef<string | null>(null);

  const insert = useCallback((grapheme: string) => {
    dispatch({
      type: "insert",
      grapheme,
      now: performance.now(),
      wallNow: Date.now(),
    });
  }, []);

  const backspace = useCallback(() => {
    dispatch({
      type: "backspace",
      now: performance.now(),
      wallNow: Date.now(),
    });
  }, []);

  const restart = useCallback(() => {
    const prompt = generatePrompt(state.config, createPromptSeed());
    persistedId.current = null;
    setSaveStatus("idle");
    dispatch({
      type: "restart",
      runId: newRunId(),
      config: state.config,
      prompt,
    });
  }, [state.config]);

  const changeConfig = useCallback(
    (next: TestConfig) => {
      saveTestConfig(next);
      persistedId.current = null;
      setSaveStatus("idle");
      dispatch({
        type: "restart",
        runId: newRunId(),
        config: next,
        prompt: generatePrompt(next, createPromptSeed()),
      });
    },
    [],
  );

  useEffect(() => {
    if (
      state.config.mode === "time" &&
      state.prompt.words.length - state.wordIndex < 60
    ) {
      dispatch({
        type: "extendPrompt",
        prompt: extendPrompt(state.prompt, state.config),
      });
    }
  }, [state.config, state.prompt, state.wordIndex]);

  useEffect(() => {
    if (state.status !== "running") {
      return;
    }

    let frame = 0;
    let lastDisplay = 0;
    const renderClock = (now: number) => {
      if (now - lastDisplay >= 100) {
        lastDisplay = now;
        setDisplayNow(now);
      }
      if (state.deadline !== null && now >= state.deadline) {
        dispatch({ type: "tick", now, wallNow: Date.now() });
        return;
      }
      frame = requestAnimationFrame(renderClock);
    };
    frame = requestAnimationFrame(renderClock);

    const delay =
      state.deadline === null
        ? 0
        : Math.max(0, Math.min(2_147_483_647, state.deadline - performance.now()));
    const deadlineTimer = window.setTimeout(() => {
      dispatch({
        type: "tick",
        now: performance.now(),
        wallNow: Date.now(),
      });
    }, delay);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(deadlineTimer);
    };
  }, [state.deadline, state.status]);

  useEffect(() => {
    const result = state.result;
    if (
      result === null ||
      auth.status === "loading" ||
      persistedId.current === result.clientResultId
    ) {
      return;
    }
    persistedId.current = result.clientResultId;
    const resultId = result.clientResultId;
    const accountUser = auth.user;
    const persistence =
      accountUser === null
        ? Promise.resolve().then(() => {
            const saved = saveGuestResult(result);
            return saved.ok ? ("saved" as const) : ("unavailable" as const);
          })
        : saveAccountResult(result).then(
            () => "saved" as const,
            (error: unknown) => {
              if (!isRetryableApiError(error)) {
                return "unavailable" as const;
              }
              const outcome = queueAccountResult(accountUser.id, result);
              return outcome === "queued" || outcome === "duplicate"
                ? ("queued" as const)
                : ("unavailable" as const);
            },
          );
    void persistence.then((nextStatus) => {
      if (persistedId.current === resultId) {
        setSaveStatus(nextStatus);
      }
    });
  }, [auth.status, auth.user, state.result]);

  const elapsedMs = useMemo(() => {
    if (state.startedAt === null) {
      return 0;
    }
    if (state.completedAt !== null) {
      return state.completedAt - state.startedAt;
    }
    return Math.max(0, displayNow - state.startedAt);
  }, [displayNow, state.completedAt, state.startedAt]);

  const remainingMs =
    state.config.mode === "time"
      ? Math.max(0, state.config.modeValue * 1_000 - elapsedMs)
      : null;

  return {
    state,
    elapsedMs,
    remainingMs,
    saveStatus,
    insert,
    backspace,
    restart,
    changeConfig,
  };
}
