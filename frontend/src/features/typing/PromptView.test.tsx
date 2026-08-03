import { createRef } from "react";
import { render } from "@testing-library/react";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { PromptView } from "./PromptView";
import { createTypingState, typingReducer } from "./reducer";
import type { Prompt, TestConfig, TypingState } from "./types";

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
});

afterAll(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "scrollTo");
  vi.unstubAllGlobals();
});

const config: TestConfig = {
  mode: "words",
  modeValue: 3,
  punctuation: false,
  numbers: false,
  contentType: "code",
  language: "en",
  codeLanguage: "python3",
  errorPolicy: "normal",
};

const prompt: Prompt = {
  id: "code-v2-python3-layout",
  seed: 1,
  wordListVersion: "code-v2",
  generatorVersion: 1,
  language: "en",
  codeLanguage: "python3",
  words: [
    "def total(values):",
    "    for value in values:",
    "        return value",
  ],
};

function activeState(wordIndex: number): TypingState {
  return {
    ...createTypingState(config, prompt, "layout-run"),
    status: "running",
    wordIndex,
    committedWords:
      wordIndex === 0
        ? []
        : prompt.words
            .slice(0, wordIndex)
            .map((line) => Array.from(line.trimStart())),
    currentInput: [],
    startedAt: 0,
    deadline: 600_000,
  };
}

describe("code prompt presentation", () => {
  it("renders natural line numbers and structural four/eight-space indents", () => {
    const { container } = render(
      <PromptView
        state={activeState(1)}
        captureRef={createRef<HTMLTextAreaElement>()}
        captureFocused={true}
        compositionText=""
      />,
    );
    const rows = Array.from(
      container.querySelectorAll<HTMLElement>(".prompt-code-row"),
    );

    expect(
      rows.map(
        (row) =>
          row.querySelector(".prompt-code-line-number")?.textContent,
      ),
    ).toEqual(["1", "2", "3"]);
    expect(
      rows.map(
        (row) =>
          row.querySelector<HTMLElement>(".prompt-code-indent")?.dataset
            .indentColumns,
      ),
    ).toEqual(["0", "4", "8"]);
  });

  it("places the active caret at the first typable character after indentation", () => {
    const { container } = render(
      <PromptView
        state={activeState(2)}
        captureRef={createRef<HTMLTextAreaElement>()}
        captureFocused={true}
        compositionText=""
      />,
    );
    const activeRow = container.querySelector<HTMLElement>(
      '.prompt-code-row[data-active="true"]',
    );

    expect(activeRow?.dataset.sourceLine).toBe("        return value");
    expect(
      activeRow
        ?.querySelector<HTMLElement>("[data-prompt-target]")
        ?.dataset.promptTarget,
    ).toBe("return value");
    expect(
      activeRow?.querySelector<HTMLElement>(".prompt-code-indent")?.dataset
        .indentColumns,
    ).toBe("8");
    expect(activeRow?.querySelector(".typing-caret")).not.toBeNull();
  });

  it("adds restrained syntax classes without changing the visible source", () => {
    const { container } = render(
      <PromptView
        state={activeState(0)}
        captureRef={createRef<HTMLTextAreaElement>()}
        captureFocused={true}
        compositionText=""
      />,
    );
    const firstTarget = container.querySelector<HTMLElement>(
      '[data-prompt-index="0"]',
    );

    expect(firstTarget?.dataset.promptTarget).toBe("def total(values):");
    expect(firstTarget?.querySelectorAll(".syntax-keyword")).toHaveLength(3);
    expect(
      Array.from(
        firstTarget?.querySelectorAll(".prompt-character") ?? [],
        (character) => character.textContent,
      ).join(""),
    ).toBe("def total(values):");
  });

  it("keeps the current row but hides the caret when typing focus leaves", () => {
    const { container } = render(
      <PromptView
        state={activeState(1)}
        captureRef={createRef<HTMLTextAreaElement>()}
        captureFocused={false}
        compositionText=""
      />,
    );

    expect(
      container.querySelector('.prompt-code-row[data-active="true"]'),
    ).not.toBeNull();
    expect(container.querySelector(".typing-caret")).toBeNull();
  });
});

describe("strict prompt presentation", () => {
  it("keeps later matching characters red after the first mistake", () => {
    const strictConfig: TestConfig = {
      ...config,
      contentType: "words",
      errorPolicy: "strict",
      modeValue: 2,
    };
    const strictPrompt: Prompt = {
      ...prompt,
      id: "strict-presentation",
      words: ["cat", "dog"],
    };
    let state = createTypingState(
      strictConfig,
      strictPrompt,
      "strict-presentation-run",
    );
    let now = 0;
    for (const grapheme of ["c", "a", "x", " ", "d", "o", "g"]) {
      state = typingReducer(state, {
        type: "insert",
        grapheme,
        now,
        wallNow: 1_700_000_000_000 + now,
      });
      now += 20;
    }

    const { container } = render(
      <PromptView
        state={state}
        captureRef={createRef<HTMLTextAreaElement>()}
        captureFocused={true}
        compositionText=""
      />,
    );
    const firstWordCharacters = Array.from(
      container.querySelectorAll(
        '[data-prompt-index="0"] .prompt-character',
      ),
      (character) => character.classList.contains("is-incorrect"),
    );
    const secondWordCharacters = Array.from(
      container.querySelectorAll(
        '[data-prompt-index="1"] .prompt-character',
      ),
      (character) => character.classList.contains("is-incorrect"),
    );

    expect(firstWordCharacters).toEqual([false, false, true]);
    expect(secondWordCharacters).toEqual([true, true, true]);
  });
});
