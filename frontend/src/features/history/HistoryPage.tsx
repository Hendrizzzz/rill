import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import {
  loadAccountResults,
  loadAccountSummary,
  type ResultRecord,
  type ResultSummary,
} from "../../api/client";
import {
  hasLegacyPendingAccountResults,
  loadPendingAccountResults,
  PENDING_RESULTS_CHANGED_EVENT,
} from "../../api/pendingResults";
import { useAuth } from "../account/auth-context";
import { PaceChart } from "../typing/PaceChart";
import {
  hasLegacyGuestResults,
  loadGuestResults,
} from "../typing/storage";
import type { TypingResult } from "../typing/types";
import { codeLanguageLabel } from "../typing/codeCorpus";

const EMPTY_RESULTS: readonly TypingResult[] = [];
const EMPTY_SUMMARY: ResultSummary = {
  totalRuns: 0,
  totalPracticeMs: 0,
  highestWpm: 0,
  averageAccuracy: 0,
  records: [],
};

interface HistorySnapshot {
  ownerKey: string;
  results: TypingResult[];
  summary: ResultSummary;
  cursor?: string;
  state: "loading" | "ready" | "error";
}

function formatMode(result: TypingResult): string {
  const modifiers = [
    result.contentType === result.mode ? "" : result.contentType,
    result.codeLanguage === undefined
      ? ""
      : codeLanguageLabel(result.codeLanguage),
    result.language === "es" ? "español" : "",
    result.errorPolicy === "strict" ? "strict" : "",
    result.punctuation ? "punctuation" : "",
    result.numbers ? "numbers" : "",
  ].filter(Boolean);
  const limit =
    result.contentType === "words"
      ? [result.mode, String(result.modeValue)]
      : [
          `${String(result.modeValue)} ${result.contentType === "code" ? "lines" : "words"}`,
        ];
  return [...limit, ...modifiers].join(" · ");
}

function recordKey(result: TypingResult): string {
  return [
    result.mode,
    String(result.modeValue),
    String(result.punctuation),
    String(result.numbers),
    result.contentType,
    result.language,
    result.codeLanguage ?? "",
    result.wordListVersion,
    result.errorPolicy,
  ].join(":");
}

function isBetterRecord(candidate: TypingResult, current: TypingResult): boolean {
  return (
    candidate.wpm > current.wpm ||
    (candidate.wpm === current.wpm &&
      (candidate.accuracy > current.accuracy ||
        (candidate.accuracy === current.accuracy &&
          candidate.completedAt < current.completedAt)))
  );
}

function summarize(results: readonly TypingResult[]): ResultSummary {
  const records = new Map<string, TypingResult>();
  for (const result of results) {
    const key = recordKey(result);
    const current = records.get(key);
    if (current === undefined || isBetterRecord(result, current)) {
      records.set(key, result);
    }
  }
  return {
    totalRuns: results.length,
    totalPracticeMs: results.reduce(
      (total, result) => total + result.durationMs,
      0,
    ),
    highestWpm: results.reduce(
      (highest, result) => Math.max(highest, result.wpm),
      0,
    ),
    averageAccuracy:
      results.length === 0
        ? 0
        : results.reduce((total, result) => total + result.accuracy, 0) /
          results.length,
    records: [...records.values()].map((result) => ({
      key: {
        mode: result.mode,
        modeValue: result.modeValue,
        punctuation: result.punctuation,
        numbers: result.numbers,
        contentType: result.contentType,
        language: result.language,
        wordListVersion: result.wordListVersion,
        ...(result.codeLanguage === undefined
          ? {}
          : { codeLanguage: result.codeLanguage }),
        errorPolicy: result.errorPolicy,
      },
      result,
    })),
  };
}

function withPending(
  base: ResultSummary,
  pending: readonly TypingResult[],
): ResultSummary {
  if (pending.length === 0) {
    return base;
  }
  const totalRuns = base.totalRuns + pending.length;
  const accuracyTotal =
    base.averageAccuracy * base.totalRuns +
    pending.reduce((total, result) => total + result.accuracy, 0);
  const records = new Map<string, ResultRecord>(
    base.records.map((record) => [recordKey(record.result), record]),
  );
  for (const result of pending) {
    const key = recordKey(result);
    const current = records.get(key);
    if (current === undefined || isBetterRecord(result, current.result)) {
      records.set(key, {
        key: {
          mode: result.mode,
          modeValue: result.modeValue,
          punctuation: result.punctuation,
          numbers: result.numbers,
          contentType: result.contentType,
          language: result.language,
          wordListVersion: result.wordListVersion,
          ...(result.codeLanguage === undefined
            ? {}
            : { codeLanguage: result.codeLanguage }),
          errorPolicy: result.errorPolicy,
        },
        result,
      });
    }
  }
  return {
    totalRuns,
    totalPracticeMs:
      base.totalPracticeMs +
      pending.reduce((total, result) => total + result.durationMs, 0),
    highestWpm: pending.reduce(
      (highest, result) => Math.max(highest, result.wpm),
      base.highestWpm,
    ),
    averageAccuracy: accuracyTotal / totalRuns,
    records: [...records.values()],
  };
}

export function HistoryPage() {
  const auth = useAuth();
  const ownerKey =
    auth.user?.id ?? (auth.status === "loading" ? "loading" : "guest");
  const requestSequence = useRef(0);
  const [pendingRevision, setPendingRevision] = useState(0);
  const [reloadRevision, setReloadRevision] = useState(0);
  const [history, setHistory] = useState<HistorySnapshot | null>(null);

  useEffect(() => {
    const refreshPending = () => setPendingRevision((revision) => revision + 1);
    window.addEventListener(PENDING_RESULTS_CHANGED_EVENT, refreshPending);
    return () =>
      window.removeEventListener(PENDING_RESULTS_CHANGED_EVENT, refreshPending);
  }, []);

  const loadMore = useCallback(
    (nextCursor: string) => {
      if (auth.user === null) {
        return;
      }
      const requestId = ++requestSequence.current;
      const loadingOwner = auth.user.id;
      setHistory((current) =>
        current?.ownerKey === loadingOwner
          ? { ...current, state: "loading" }
          : current,
      );
      void loadAccountResults(nextCursor).then(
        (page) => {
          if (requestSequence.current !== requestId) {
            return;
          }
          setHistory((current) => ({
            ownerKey: loadingOwner,
            results:
              current?.ownerKey === loadingOwner
                ? [...current.results, ...page.items]
                : page.items,
            summary:
              current?.ownerKey === loadingOwner
                ? current.summary
                : EMPTY_SUMMARY,
            ...(page.nextCursor === undefined
              ? {}
              : { cursor: page.nextCursor }),
            state: "ready",
          }));
        },
        () => {
          if (requestSequence.current === requestId) {
            setHistory((current) =>
              current?.ownerKey === loadingOwner
                ? { ...current, state: "error" }
                : {
                    ownerKey: loadingOwner,
                    results: [],
                    summary: EMPTY_SUMMARY,
                    state: "error",
                  },
            );
          }
        },
      );
    },
    [auth.user],
  );

  useEffect(() => {
    if (auth.status === "loading") {
      return;
    }
    const requestId = ++requestSequence.current;
    const loadingOwner = ownerKey;
    const source =
      auth.user === null
        ? Promise.resolve().then(() => {
            const results = loadGuestResults();
            return {
              page: { items: results, nextCursor: undefined },
              summary: summarize(results),
            };
          })
        : Promise.all([loadAccountResults(), loadAccountSummary()]).then(
            ([page, summary]) => ({ page, summary }),
          );
    void source.then(
      ({ page, summary }) => {
        if (requestSequence.current === requestId) {
          setHistory({
            ownerKey: loadingOwner,
            results: page.items,
            summary,
            ...(page.nextCursor === undefined ? {} : { cursor: page.nextCursor }),
            state: "ready",
          });
        }
      },
      () => {
        if (requestSequence.current === requestId) {
          setHistory({
            ownerKey: loadingOwner,
            results: [],
            summary: EMPTY_SUMMARY,
            state: "error",
          });
        }
      },
    );
    return () => {
      if (requestSequence.current === requestId) {
        requestSequence.current += 1;
      }
    };
  }, [auth.status, auth.user, ownerKey, reloadRevision]);

  const serverResults =
    history?.ownerKey === ownerKey ? history.results : EMPTY_RESULTS;
  const pendingResults = useMemo(
    () => {
      void pendingRevision;
      return auth.user === null
        ? EMPTY_RESULTS
        : loadPendingAccountResults(auth.user.id);
    },
    [auth.user, pendingRevision],
  );
  const hasLegacyResults =
    auth.user === null
      ? hasLegacyGuestResults()
      : hasLegacyPendingAccountResults(auth.user.id);
  const serverIds = useMemo(
    () => new Set(serverResults.map((result) => result.clientResultId)),
    [serverResults],
  );
  const uniquePending = useMemo(
    () =>
      pendingResults.filter(
        (result) => !serverIds.has(result.clientResultId),
      ),
    [pendingResults, serverIds],
  );
  const rows = useMemo(
    () =>
      [
        ...uniquePending.map((result) => ({ result, pending: true })),
        ...serverResults.map((result) => ({ result, pending: false })),
      ].sort(
        (left, right) =>
          Date.parse(right.result.completedAt) -
          Date.parse(left.result.completedAt),
      ),
    [serverResults, uniquePending],
  );
  const summary = withPending(
    history?.ownerKey === ownerKey ? history.summary : EMPTY_SUMMARY,
    uniquePending,
  );
  const cursor = history?.ownerKey === ownerKey ? history.cursor : undefined;
  const state =
    auth.status === "loading" || history?.ownerKey !== ownerKey
      ? "loading"
      : history.state;
  const best = summary.records.reduce<TypingResult | null>(
    (current, record) =>
      current === null || isBetterRecord(record.result, current)
        ? record.result
        : current,
    null,
  );

  const retry = useCallback(() => {
    if (cursor !== undefined) {
      loadMore(cursor);
      return;
    }
    setHistory(null);
    setReloadRevision((revision) => revision + 1);
  }, [cursor, loadMore]);

  return (
    <main className="history-page">
      <div className="page-heading">
        <p className="eyebrow">
          {auth.user === null ? "this device" : "private history"}
        </p>
        <h1>History</h1>
        <p>
          {auth.user === null
            ? "The latest one hundred guest runs stay in this browser."
            : `Signed in as ${auth.user.username}. Results are ordered newest first.`}
        </p>
      </div>

      {hasLegacyResults ? (
        <p className="legacy-history-notice" role="status">
          Earlier pre-release results remain stored in this browser, but their
          older scoring data cannot be converted faithfully to the current
          statistics.
        </p>
      ) : null}

      {state === "loading" && rows.length === 0 ? (
        <section className="empty-state" aria-live="polite">
          <p>Loading history…</p>
        </section>
      ) : state === "error" && rows.length === 0 ? (
        <section className="empty-state" role="alert">
          <p>History could not be reached. Your local typing test still works.</p>
          <button type="button" onClick={() => window.location.reload()}>
            try again
          </button>
        </section>
      ) : rows.length === 0 ? (
        <section className="empty-state">
          <p>No saved runs yet. Finish a test and it will appear here.</p>
          <Link to="/">start a test</Link>
        </section>
      ) : (
        <>
          <section className="record-strip" aria-label="History summary">
            <div>
              <span>retained runs</span>
              <strong>{summary.totalRuns}</strong>
            </div>
            <div>
              <span>best</span>
              <strong>{Math.round(summary.highestWpm)} wpm</strong>
            </div>
            <div>
              <span>average accuracy</span>
              <strong>{summary.averageAccuracy.toFixed(1)}%</strong>
            </div>
          </section>
          {best !== null ? <PaceChart buckets={best.paceBuckets} /> : null}
          <section className="personal-records" aria-labelledby="records-title">
            <div>
              <p className="eyebrow">by test</p>
              <h2 id="records-title">Personal records</h2>
            </div>
            <ul>
              {summary.records.map((record) => (
                <li key={recordKey(record.result)}>
                  <span>{formatMode(record.result)}</span>
                  <strong>{Math.round(record.result.wpm)} wpm</strong>
                </li>
              ))}
            </ul>
          </section>
          <div className="history-table-wrap">
            <table className="history-table">
              <caption>
                {auth.user === null ? "Guest" : "Account"} typing results,
                newest first
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Test</th>
                  <th scope="col">WPM</th>
                  <th scope="col">Accuracy</th>
                  <th scope="col">Consistency</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ result, pending }) => (
                  <tr
                    key={result.clientResultId}
                    className={pending ? "is-pending-result" : undefined}
                  >
                    <td>
                      <span className="mobile-cell-label" aria-hidden="true">
                        Date
                      </span>
                      <time dateTime={result.completedAt}>
                        {new Intl.DateTimeFormat(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        }).format(new Date(result.completedAt))}
                      </time>
                      {pending ? (
                        <span className="pending-result">sync pending</span>
                      ) : null}
                    </td>
                    <td>
                      <span className="mobile-cell-label" aria-hidden="true">
                        Test
                      </span>
                      {formatMode(result)}
                    </td>
                    <td>
                      <span className="mobile-cell-label" aria-hidden="true">
                        WPM
                      </span>
                      {Math.round(result.wpm)}
                    </td>
                    <td>
                      <span className="mobile-cell-label" aria-hidden="true">
                        Accuracy
                      </span>
                      {result.accuracy.toFixed(1)}%
                    </td>
                    <td>
                      <span className="mobile-cell-label" aria-hidden="true">
                        Consistency
                      </span>
                      {result.consistency.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cursor === undefined ? null : (
            <button
              type="button"
              className="load-more"
              onClick={() => loadMore(cursor)}
              disabled={state === "loading"}
            >
              {state === "loading" ? "loading…" : "load earlier runs"}
            </button>
          )}
          {state === "error" ? (
            <p className="history-inline-error" role="alert">
              Server history could not be loaded. Locally queued runs remain
              visible.{" "}
              <button type="button" onClick={retry}>
                try again
              </button>
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}
