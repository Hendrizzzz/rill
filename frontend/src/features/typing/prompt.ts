import type { Prompt, TestConfig } from "./types";
import { ENGLISH_WORDS_V1 } from "./wordList";

const PUNCTUATION = [".", ",", "?", "!", ":", ";"] as const;

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result = result + Math.imul(result ^ (result >>> 7), 61 | result) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function capitalise(word: string): string {
  return `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`;
}

function decorateWord(
  source: string,
  index: number,
  config: TestConfig,
  random: () => number,
): string {
  if (config.numbers && index > 0 && random() < 0.12) {
    return String(Math.floor(random() * 10_000));
  }

  let word = source;
  if (config.punctuation) {
    if (index === 0 || random() < 0.08) {
      word = capitalise(word);
    }
    if (random() < 0.17) {
      const punctuation =
        PUNCTUATION[Math.floor(random() * PUNCTUATION.length)] ?? ".";
      word += punctuation;
    }
  }
  return word;
}

export function createPromptSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] ?? 0;
}

export function generatePrompt(
  config: TestConfig,
  seed: number,
  requestedCount?: number,
): Prompt {
  const count = requestedCount ?? (config.mode === "words" ? config.modeValue : 500);
  const random = mulberry32(seed);
  const words: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const source =
      ENGLISH_WORDS_V1[Math.floor(random() * ENGLISH_WORDS_V1.length)] ?? "word";
    words.push(decorateWord(source, index, config, random));
  }

  return {
    id: [
      "gen1",
      "en-v1",
      seed >>> 0,
      config.mode,
      config.modeValue,
      config.punctuation ? "p1" : "p0",
      config.numbers ? "n1" : "n0",
    ].join("-"),
    seed: seed >>> 0,
    wordListVersion: "en-v1",
    generatorVersion: 1,
    words,
  };
}

export function extendPrompt(prompt: Prompt, config: TestConfig): Prompt {
  return generatePrompt(config, prompt.seed, prompt.words.length + 250);
}
