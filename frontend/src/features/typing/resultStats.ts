import type {
  PaceBucket,
  Prompt,
  TestConfig,
  TypingInputEvent,
} from "./types";
import { segmentGraphemes } from "./inputAdapter";
import { typableTarget } from "./targetText";

export interface CharacterStats {
  allCorrect: number;
  correctWord: number;
  incorrect: number;
  extra: number;
  missed: number;
}

function emptyCharacterStats(): CharacterStats {
  return {
    allCorrect: 0,
    correctWord: 0,
    incorrect: 0,
    extra: 0,
    missed: 0,
  };
}

export function countWordCharacters(
  inputWord: string,
  targetWord: string,
  creditPartial: boolean,
  locale = "en",
  separator = " ",
): CharacterStats {
  const counts = emptyCharacterStats();
  const inputCharacters = segmentGraphemes(inputWord, locale);
  const targetCharacters = segmentGraphemes(targetWord, locale);
  const wordCorrect =
    inputCharacters.length === targetCharacters.length &&
    inputCharacters.every(
      (character, index) => character === targetCharacters[index],
    );
  const wordPartiallyCorrect =
    inputCharacters.length <= targetCharacters.length &&
    inputCharacters.every(
      (character, index) => character === targetCharacters[index],
    );

  for (
    let index = 0;
    index < Math.max(inputCharacters.length, targetCharacters.length);
    index += 1
  ) {
    const inputCharacter = inputCharacters[index];
    const targetCharacter = targetCharacters[index];

    if (inputCharacter === targetCharacter) {
      if (
        targetCharacter === separator &&
        index === targetCharacters.length - 1 &&
        !wordCorrect
      ) {
        counts.extra += 1;
      } else {
        counts.allCorrect += 1;
      }
      if (wordCorrect || (creditPartial && wordPartiallyCorrect)) {
        counts.correctWord += 1;
      }
    } else if (inputCharacter === undefined) {
      if (!creditPartial) {
        counts.missed += 1;
      }
    } else if (
      targetCharacter === undefined ||
      (targetCharacter === separator &&
        inputCharacter !== separator &&
        !inputCharacters.includes(separator))
    ) {
      counts.extra += 1;
    } else {
      counts.incorrect += 1;
    }
  }

  return counts;
}

function targetWord(
  prompt: Prompt,
  config: TestConfig,
  wordIndex: number,
): string {
  const word = typableTarget(
    prompt.words[wordIndex] ?? "",
    config.contentType,
  );
  const finalWord =
    config.mode === "words" && wordIndex === prompt.words.length - 1;
  const separator = config.contentType === "code" ? "\n" : " ";
  return finalWord ? word : `${word}${separator}`;
}

function replayInputs(
  events: readonly TypingInputEvent[],
): Map<number, string[]> {
  const inputs = new Map<number, string[]>();
  events.forEach((event) => {
    const input = inputs.get(event.wordIndex) ?? [];
    if (event.type === "insert") {
      input.push(event.grapheme);
    } else {
      input.pop();
    }
    inputs.set(event.wordIndex, input);
  });
  return inputs;
}

function activeWordIndex(
  events: readonly TypingInputEvent[],
  inputs: ReadonlyMap<number, readonly string[]>,
  config: TestConfig,
  prompt: Prompt,
): number {
  const lastEvent = events.at(-1);
  if (lastEvent === undefined) {
    return 0;
  }
  const input = inputs.get(lastEvent.wordIndex) ?? [];
  const finalWord =
    config.mode === "words" &&
    lastEvent.wordIndex === prompt.words.length - 1;
  const separator = config.contentType === "code" ? "\n" : " ";
  return !finalWord && input.at(-1) === separator
    ? lastEvent.wordIndex + 1
    : lastEvent.wordIndex;
}

export function countCharacters(
  events: readonly TypingInputEvent[],
  prompt: Prompt,
  config: TestConfig,
  countPartialLastWord: boolean,
): CharacterStats {
  const inputs = replayInputs(events);
  const lastWordIndex = activeWordIndex(events, inputs, config, prompt);
  const total = emptyCharacterStats();

  for (let wordIndex = 0; wordIndex <= lastWordIndex; wordIndex += 1) {
    const input = (inputs.get(wordIndex) ?? []).join("");
    const counts = countWordCharacters(
      input,
      targetWord(prompt, config, wordIndex),
      wordIndex === lastWordIndex && countPartialLastWord,
      prompt.language,
      config.contentType === "code" ? "\n" : " ",
    );
    total.allCorrect += counts.allCorrect;
    total.correctWord += counts.correctWord;
    total.incorrect += counts.incorrect;
    total.extra += counts.extra;
    total.missed += counts.missed;
  }

  return total;
}

function roundTo2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Monkeytype records event offsets to two decimal places of a millisecond.
 * Keeping the same precision makes equality at graph boundaries deterministic.
 */
export function normalizeEventElapsedMs(rawDurationMs: number): number {
  return roundTo2(Math.max(0, rawDurationMs));
}

/**
 * Non-custom Monkeytype results display and score against a duration rounded
 * to two decimal places of a second (a 10 ms grid).
 */
export function normalizeTestDurationMs(rawDurationMs: number): number {
  return Math.round(roundTo2(Math.max(0, rawDurationMs) / 1_000) * 1_000);
}

function graphBoundaries(endMs: number, mode: TestConfig["mode"]): number[] {
  const boundaries: number[] = [];
  const completeSeconds = Math.floor(endMs / 1_000);
  for (let second = 1; second <= completeSeconds; second += 1) {
    boundaries.push(second * 1_000);
  }

  const normalizedEndMs = normalizeTestDurationMs(endMs);
  const roundedIntoNextWholeSecond =
    mode !== "time" &&
    normalizedEndMs > endMs &&
    normalizedEndMs % 1_000 === 0 &&
    normalizedEndMs - endMs <= 5;
  if (roundedIntoNextWholeSecond) {
    // The pinned reference drops up to 995 ms here because its rounded
    // fractional part rolls to zero. Rill deliberately keeps the normalized
    // whole-second boundary instead of copying that data-loss defect.
    boundaries.push(normalizedEndMs);
    return boundaries;
  }

  const roundedFraction = roundTo2(endMs / 1_000) % 1;
  if (mode !== "time" && Math.round(roundedFraction) >= 0.5) {
    boundaries.push(endMs);
  }
  return boundaries;
}

export function buildPaceBuckets(
  durationMs: number,
  events: readonly TypingInputEvent[],
  prompt: Prompt,
  config: TestConfig,
  graphEndMs: number,
): PaceBucket[] {
  const buckets: PaceBucket[] = [];
  const rawEndMs = normalizeEventElapsedMs(graphEndMs);
  const roundedEndMs = normalizeTestDurationMs(rawEndMs);
  const boundaries = graphBoundaries(rawEndMs, config.mode);
  const finalBoundary = boundaries.at(-1);
  const foldTerminalEventsIntoFinalSecond =
    config.mode !== "time" &&
    durationMs === roundedEndMs &&
    durationMs % 1_000 === 0 &&
    rawEndMs > durationMs &&
    rawEndMs - durationMs <= 5 &&
    finalBoundary === durationMs;
  let eventIndex = 0;
  let previousBoundary = 0;

  boundaries.forEach((boundary) => {
    const intervalStartIndex = eventIndex;
    const eventCutoff =
      foldTerminalEventsIntoFinalSecond && boundary === finalBoundary
        ? rawEndMs
        : boundary;
    while (
      eventIndex < events.length &&
      (events[eventIndex]?.elapsedMs ?? Number.POSITIVE_INFINITY) <=
        eventCutoff
    ) {
      eventIndex += 1;
    }

    const intervalEvents = events.slice(intervalStartIndex, eventIndex);
    const eventsToBoundary = events.slice(0, eventIndex);
    const counts = countCharacters(
      eventsToBoundary,
      prompt,
      config,
      true,
    );
    buckets.push({
      durationMs: normalizeEventElapsedMs(boundary - previousBoundary),
      typedCharacters: intervalEvents.filter(
        (event) => event.type === "insert",
      ).length,
      correctCharacters: counts.correctWord,
      rawCharacters:
        counts.allCorrect + counts.incorrect + counts.extra,
      errors: intervalEvents.filter(
        (event) => event.type === "insert" && !event.correct,
      ).length,
    });
    previousBoundary = boundary;
  });

  return buckets;
}
