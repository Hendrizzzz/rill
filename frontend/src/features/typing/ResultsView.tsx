import type { TypingResult } from "./types";
import { PaceChart } from "./PaceChart";

interface ResultsViewProps {
  result: TypingResult;
  saveStatus: "idle" | "saved" | "queued" | "unavailable";
  onRestart: () => void;
  onChangeTest: () => void;
}

export function ResultsView({
  result,
  saveStatus,
  onRestart,
  onChangeTest,
}: ResultsViewProps) {
  return (
    <section className="results" aria-labelledby="results-title">
      <div className="result-primary">
        <p className="eyebrow">words per minute</p>
        <h2 id="results-title">{Math.round(result.wpm)}</h2>
      </div>
      <dl className="result-details">
        <div>
          <dt>accuracy</dt>
          <dd>{result.accuracy.toFixed(1)}%</dd>
        </div>
        <div>
          <dt>raw</dt>
          <dd>{Math.round(result.rawWpm)}</dd>
        </div>
        <div>
          <dt>consistency</dt>
          <dd>{result.consistency.toFixed(1)}%</dd>
        </div>
        <div>
          <dt>time</dt>
          <dd>{(result.durationMs / 1_000).toFixed(1)}s</dd>
        </div>
        <div>
          <dt>characters</dt>
          <dd>
            {result.correctCharacters}/{result.incorrectAttempts}/
            {result.missingCharacters}/{result.extraAttempts}
          </dd>
        </div>
      </dl>
      <PaceChart buckets={result.paceBuckets} />
      <div className="result-footer">
        <p className={`save-state save-state--${saveStatus}`}>
          {saveStatus === "saved"
            ? "saved"
            : saveStatus === "queued"
              ? "saved here · sync pending"
            : saveStatus === "unavailable"
              ? "result could not be saved"
              : "saving…"}
        </p>
        <div className="result-actions">
          <button type="button" onClick={onRestart}>
            again <kbd>enter</kbd>
          </button>
          <button type="button" onClick={onChangeTest}>
            change test
          </button>
        </div>
      </div>
    </section>
  );
}
