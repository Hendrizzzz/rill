import {
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
  type SyntheticEvent,
} from "react";

import { validateCustomText } from "./prompt";
import {
  CODE_EXERCISE_COUNT,
  CODE_LANGUAGES,
  CODE_PATTERN_COUNT,
} from "./codeCorpus";
import {
  TIME_VALUES,
  WORD_VALUES,
  type CodeLanguage,
  type ContentType,
  type TestConfig,
  type TestMode,
  type TypingLanguage,
} from "./types";

interface TestControlsProps {
  config: TestConfig;
  disabled: boolean;
  onChange: (next: TestConfig, customText?: string) => void;
  firstControlRef?: RefObject<HTMLButtonElement | null>;
}

export function TestControls({
  config,
  disabled,
  onChange,
  firstControlRef,
}: TestControlsProps) {
  const editorDescriptionId = useId();
  const editorErrorId = useId();
  const customButtonRef = useRef<HTMLButtonElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState("");
  const [customError, setCustomError] = useState("");
  const wordContent = config.contentType === "words";
  const codeContent = config.contentType === "code";
  const values = config.mode === "time" ? TIME_VALUES : WORD_VALUES;

  useEffect(() => {
    if (editorOpen) {
      editorRef.current?.focus({ preventScroll: true });
    }
  }, [editorOpen]);

  const setMode = (mode: TestMode) => {
    onChange({
      ...config,
      contentType: "words",
      mode,
      modeValue: mode === "time" ? 30 : 25,
    });
  };

  const setContent = (contentType: ContentType) => {
    if (contentType === "custom") {
      setCustomError("");
      setEditorOpen(true);
      return;
    }
    onChange({
      ...config,
      contentType,
      mode: contentType === "quote" ? "words" : config.mode,
      modeValue:
        contentType === "quote"
          ? config.modeValue
          : config.mode === "time"
            ? 30
            : 25,
      punctuation: contentType === "words" && config.punctuation,
      numbers: contentType === "words" && config.numbers,
      language: contentType === "quote" ? "en" : config.language,
    });
  };

  const setLanguage = (language: TypingLanguage) => {
    onChange({ ...config, language });
  };

  const setCodeLanguage = (codeLanguage: CodeLanguage) => {
    onChange({ ...config, codeLanguage });
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setCustomError("");
    requestAnimationFrame(() => {
      customButtonRef.current?.focus({ preventScroll: true });
    });
  };

  const applyCustomText = (
    event: SyntheticEvent<HTMLFormElement, SubmitEvent>,
  ) => {
    event.preventDefault();
    const validation = validateCustomText(customDraft);
    if (!validation.ok) {
      setCustomError(validation.message);
      return;
    }
    onChange(
      {
        ...config,
        contentType: "custom",
        mode: "words",
        modeValue: validation.words.length,
        punctuation: false,
        numbers: false,
      },
      validation.text,
    );
    setEditorOpen(false);
    setCustomError("");
  };

  return (
    <div className="test-controls" aria-label="Test configuration">
      <fieldset className="control-group">
        <legend className="sr-only">Text source</legend>
        {(["words", "quote", "code"] as const).map((contentType) => (
          <button
            type="button"
            ref={contentType === "words" ? firstControlRef : undefined}
            key={contentType}
            disabled={disabled}
            aria-pressed={config.contentType === contentType}
            onClick={() => {
              setContent(contentType);
            }}
          >
            {contentType}
          </button>
        ))}
        <button
          ref={customButtonRef}
          type="button"
          disabled={disabled}
          aria-expanded={editorOpen}
          aria-controls="custom-text-editor"
          aria-pressed={config.contentType === "custom"}
          onClick={() => {
            setContent("custom");
          }}
        >
          custom
        </button>
      </fieldset>

      {wordContent ? (
        <>
          <span className="control-divider" aria-hidden="true" />
          <fieldset className="control-group">
            <legend className="sr-only">Test limit</legend>
            {(["time", "words"] as const).map((mode) => (
              <button
                type="button"
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
          </fieldset>
          <fieldset className="control-group">
            <legend className="sr-only">
              {config.mode === "time" ? "Seconds" : "Word count"}
            </legend>
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
          </fieldset>
        </>
      ) : null}

      {codeContent ? (
        <>
          <span className="control-divider" aria-hidden="true" />
          <label className="code-language-control">
            <span className="sr-only">Code language</span>
            <select
              aria-label="Code language"
              disabled={disabled}
              value={config.codeLanguage ?? "python3"}
              onChange={(event) => {
                setCodeLanguage(event.currentTarget.value as CodeLanguage);
              }}
            >
              {CODE_LANGUAGES.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.label}
                </option>
              ))}
            </select>
            <span aria-hidden="true">
              {CODE_PATTERN_COUNT} patterns · {CODE_EXERCISE_COUNT} drills
            </span>
          </label>
        </>
      ) : null}

      {config.contentType === "words" ||
      config.contentType === "custom" ? (
        <>
          <span className="control-divider" aria-hidden="true" />
          <fieldset className="control-group">
            <legend className="sr-only">Language</legend>
            {(["en", "es"] as const).map((language) => (
              <button
                type="button"
                key={language}
                disabled={disabled}
                aria-label={language === "en" ? "English" : "Spanish"}
                aria-pressed={config.language === language}
                onClick={() => {
                  setLanguage(language);
                }}
              >
                {language}
              </button>
            ))}
          </fieldset>
        </>
      ) : null}

      {wordContent ? (
        <fieldset className="control-group control-group--modifiers">
          <legend className="sr-only">Word modifiers</legend>
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
        </fieldset>
      ) : null}

      <span className="control-divider" aria-hidden="true" />
      <fieldset className="control-group">
        <legend className="sr-only">Error behavior</legend>
        <button
          type="button"
          disabled={disabled}
          aria-pressed={config.errorPolicy === "strict"}
          onClick={() => {
            onChange({
              ...config,
              errorPolicy:
                config.errorPolicy === "strict" ? "normal" : "strict",
            });
          }}
        >
          strict
        </button>
      </fieldset>

      {editorOpen ? (
        <form
          id="custom-text-editor"
          className="custom-text-editor"
          onSubmit={applyCustomText}
        >
          <label htmlFor="custom-text">Your practice text</label>
          <textarea
            ref={editorRef}
            id="custom-text"
            rows={5}
            maxLength={2_000}
            value={customDraft}
            aria-describedby={[
              editorDescriptionId,
              customError ? editorErrorId : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onChange={(event) => {
              setCustomDraft(event.currentTarget.value);
              if (customError) setCustomError("");
            }}
          />
          <div className="custom-editor-meta">
            <p id={editorDescriptionId}>
              Plain text only. It stays in this tab and is never uploaded.
            </p>
            <span>{String(customDraft.length)}/2000</span>
          </div>
          {customError ? (
            <p id={editorErrorId} className="field-error" role="alert">
              {customError}
            </p>
          ) : null}
          <div className="custom-editor-actions">
            <button type="submit">use text</button>
            <button type="button" onClick={closeEditor}>
              cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
