import type { RefObject } from "react";

import { TIME_VALUES, WORD_VALUES, type TestConfig, type TestMode } from "./types";

interface TestControlsProps {
  config: TestConfig;
  disabled: boolean;
  onChange: (next: TestConfig) => void;
  firstControlRef?: RefObject<HTMLButtonElement | null>;
}

export function TestControls({
  config,
  disabled,
  onChange,
  firstControlRef,
}: TestControlsProps) {
  const setMode = (mode: TestMode) => {
    onChange({
      ...config,
      mode,
      modeValue: mode === "time" ? 30 : 25,
    });
  };
  const values = config.mode === "time" ? TIME_VALUES : WORD_VALUES;

  return (
    <div className="test-controls" aria-label="Test configuration">
      <div className="control-group">
        {(["time", "words"] as const).map((mode) => (
          <button
            type="button"
            ref={mode === "time" ? firstControlRef : undefined}
            key={mode}
            disabled={disabled}
            aria-pressed={config.mode === mode}
            onClick={() => {
              setMode(mode);
            }}
          >
            {mode}
          </button>
        ))}
      </div>
      <span className="control-divider" aria-hidden="true" />
      <div className="control-group">
        {values.map((value) => (
          <button
            type="button"
            key={value}
            disabled={disabled}
            aria-pressed={config.modeValue === value}
            onClick={() => {
              onChange({ ...config, modeValue: value });
            }}
          >
            {value}
          </button>
        ))}
      </div>
      <span className="control-divider" aria-hidden="true" />
      <div className="control-group control-group--modifiers">
        <button
          type="button"
          disabled={disabled}
          aria-pressed={config.punctuation}
          onClick={() => {
            onChange({ ...config, punctuation: !config.punctuation });
          }}
        >
          punctuation
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-pressed={config.numbers}
          onClick={() => {
            onChange({ ...config, numbers: !config.numbers });
          }}
        >
          numbers
        </button>
      </div>
    </div>
  );
}
