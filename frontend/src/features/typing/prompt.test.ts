import { describe, expect, it } from "vitest";

import { extendPrompt, generatePrompt } from "./prompt";
import type { TestConfig } from "./types";

const config: TestConfig = {
  mode: "time",
  modeValue: 30,
  punctuation: true,
  numbers: true,
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
      },
      1,
    );
    expect(words.words).toHaveLength(25);
  });
});
