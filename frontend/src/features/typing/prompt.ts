import type { Prompt, TestConfig } from "./types";
import { codeLanguageLabel, selectCodeExercise } from "./codeCorpus";
import { PRACTICE_QUOTES_V3 } from "./quotes";
import { SPANISH_WORDS_V1 } from "./spanishWordList";
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

export type CustomTextValidation =
  | { ok: true; text: string; words: string[] }
  | { ok: false; message: string };

export function validateCustomText(value: string): CustomTextValidation {
  const text = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (text.length < 3) {
    return { ok: false, message: "Enter at least two words." };
  }
  if (text.length > 2_000) {
    return {
      ok: false,
      message: "Custom text must be 2,000 characters or fewer.",
    };
  }
  const words = text.split(" ");
  if (words.length < 2) {
    return { ok: false, message: "Enter at least two words." };
  }
  if (words.length > 300) {
    return { ok: false, message: "Custom text must be 300 words or fewer." };
  }
  if (words.some((word) => Array.from(word).length > 64)) {
    return {
      ok: false,
      message: "Individual words must be 64 characters or fewer.",
    };
  }
  return { ok: true, text, words };
}

export function generatePrompt(
  config: TestConfig,
  seed: number,
  requestedCount?: number,
  customText?: string,
): Prompt {
  if (config.contentType === "code") {
    const exercise = selectCodeExercise(config.codeLanguage ?? "python3", seed);
    const lines = exercise.code.split("\n");
    return {
      id: exercise.id,
      seed: seed >>> 0,
      wordListVersion: "code-v4",
      generatorVersion: 1,
      language: "en",
      codeLanguage: exercise.language,
      sourceId: exercise.id,
      title: exercise.title,
      topic: exercise.topic,
      lesson: exercise.lesson,
      assumptions: exercise.assumptions,
      complexity: exercise.complexity,
      attribution: `${codeLanguageLabel(exercise.language)} · original practice implementation`,
      words: lines,
    };
  }

  if (config.contentType === "custom") {
    const custom = validateCustomText(customText ?? "");
    if (!custom.ok) {
      throw new Error(custom.message);
    }
    return {
      id: `custom-v1-${String(seed >>> 0)}-${String(custom.words.length)}`,
      seed: seed >>> 0,
      wordListVersion: "custom-v1",
      generatorVersion: 1,
      language: config.language,
      sourceId: "local-ephemeral",
      words: custom.words,
    };
  }

  if (config.contentType === "quote") {
    const quote =
      PRACTICE_QUOTES_V3[(seed >>> 0) % PRACTICE_QUOTES_V3.length] ??
      PRACTICE_QUOTES_V3[0];
    if (quote === undefined) {
      throw new Error("The quote corpus is empty.");
    }
    const words = quote.text.normalize("NFC").split(/\s+/u);
    return {
      id: `quote-v3-${quote.id}`,
      seed: seed >>> 0,
      wordListVersion: "quote-v3",
      generatorVersion: 1,
      language: "en",
      sourceId: quote.id,
      attribution: quote.attribution,
      sourceUrl: quote.sourceUrl,
      theme: quote.theme,
      words,
    };
  }

  const count =
    requestedCount ?? (config.mode === "words" ? config.modeValue : 500);
  const random = mulberry32(seed);
  const words: string[] = [];
  const sourceWords =
    config.language === "es" ? SPANISH_WORDS_V1 : ENGLISH_WORDS_V1;

  for (let index = 0; index < count; index += 1) {
    const source =
      sourceWords[Math.floor(random() * sourceWords.length)] ??
      (config.language === "es" ? "palabra" : "word");
    words.push(decorateWord(source, index, config, random));
  }

  const wordListVersion = config.language === "es" ? "es-v1" : "en-v1";
  return {
    id: [
      "gen1",
      wordListVersion,
      seed >>> 0,
      config.mode,
      config.modeValue,
      config.punctuation ? "p1" : "p0",
      config.numbers ? "n1" : "n0",
    ].join("-"),
    seed: seed >>> 0,
    wordListVersion,
    generatorVersion: 1,
    language: config.language,
    words,
  };
}

export function extendPrompt(prompt: Prompt, config: TestConfig): Prompt {
  if (config.contentType !== "words") return prompt;
  return generatePrompt(config, prompt.seed, prompt.words.length + 250);
}
