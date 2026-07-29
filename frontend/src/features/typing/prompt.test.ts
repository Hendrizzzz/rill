import { describe, expect, it } from "vitest";

import {
  extendPrompt,
  generatePrompt,
  validateCustomText,
} from "./prompt";
import type { TestConfig } from "./types";

const config: TestConfig = {
  mode: "time",
  modeValue: 30,
  punctuation: true,
  numbers: true,
  contentType: "words",
  language: "en",
  errorPolicy: "normal",
};

describe("prompt generation", () => {
  it("is deterministic and versioned", () => {
    const first = generatePrompt(config, 42, 20);
    const second = generatePrompt(config, 42, 20);

    expect(first).toEqual(second);
    expect(first.id).toContain("gen1-en-v1-42");
    expect(first.words).toHaveLength(20);
  });

  it("extends without changing the existing prefix", () => {
    const initial = generatePrompt(config, 99, 12);
    const extended = extendPrompt(initial, config);

    expect(extended.words.slice(0, initial.words.length)).toEqual(initial.words);
    expect(extended.words).toHaveLength(262);
  });

  it("generates exactly the requested word-mode count", () => {
    const words = generatePrompt(
      {
        mode: "words",
        modeValue: 25,
        punctuation: false,
        numbers: false,
        contentType: "words",
        language: "en",
        errorPolicy: "normal",
      },
      1,
    );
    expect(words.words).toHaveLength(25);
  });

  it("generates a deterministic Spanish prompt with explicit metadata", () => {
    const spanishConfig: TestConfig = {
      ...config,
      mode: "words",
      modeValue: 10,
      punctuation: false,
      numbers: false,
      language: "es",
    };

    const first = generatePrompt(spanishConfig, 2025);
    const second = generatePrompt(spanishConfig, 2025);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      language: "es",
      wordListVersion: "es-v1",
    });
    expect(first.words).toHaveLength(10);
  });

  it("selects a versioned quote with visible attribution", () => {
    const quote = generatePrompt(
      {
        ...config,
        mode: "words",
        contentType: "quote",
        punctuation: false,
        numbers: false,
      },
      0,
    );

    expect(quote).toMatchObject({
      language: "en",
      wordListVersion: "quote-v1",
    });
    expect(quote.sourceId).toBeTruthy();
    expect(quote.attribution).toBeTruthy();
    expect(quote.words.length).toBeGreaterThanOrEqual(2);
  });

  it("builds a line-preserving code prompt with learning metadata", () => {
    const code = generatePrompt(
      {
        ...config,
        mode: "words",
        contentType: "code",
        codeLanguage: "python3",
        punctuation: false,
        numbers: false,
      },
      12,
    );

    expect(code).toMatchObject({
      language: "en",
      codeLanguage: "python3",
      wordListVersion: "code-v2",
    });
    expect(code.id).toMatch(/^code-v2-python3-/u);
    expect(code.title).toBeTruthy();
    expect(code.topic).toBeTruthy();
    expect(code.lesson).toBeTruthy();
    expect(code.assumptions).toBeTruthy();
    expect(code.complexity).toMatch(/^O\(/u);
    expect(code.words.length).toBeGreaterThanOrEqual(4);
    expect(code.words.some((line) => line.startsWith("    "))).toBe(true);
  });

  it("normalizes custom text locally and enforces its bounds", () => {
    expect(validateCustomText("  cafe\u0301\n  listo  ")).toEqual({
      ok: true,
      text: "café listo",
      words: ["café", "listo"],
    });
    expect(validateCustomText("alone")).toEqual({
      ok: false,
      message: "Enter at least two words.",
    });
    expect(validateCustomText(`${"a ".repeat(300)}a`)).toEqual({
      ok: false,
      message: "Custom text must be 300 words or fewer.",
    });
  });

  it("builds an ephemeral custom prompt without copying its text into the id", () => {
    const custom = generatePrompt(
      {
        ...config,
        mode: "words",
        contentType: "custom",
        language: "es",
        punctuation: false,
        numbers: false,
      },
      17,
      undefined,
      "café listo",
    );

    expect(custom).toMatchObject({
      sourceId: "local-ephemeral",
      language: "es",
      wordListVersion: "custom-v1",
      words: ["café", "listo"],
    });
    expect(custom.id).not.toContain("café");
  });
});
