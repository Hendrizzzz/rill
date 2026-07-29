import fc from "fast-check";

import type { ParityTrace, TraceEvent } from "./parityHarness";

const WORDS = [
  "amber",
  "brook",
  "calm",
  "drift",
  "ember",
  "field",
  "grain",
  "harbor",
  "ivory",
  "june",
  "kind",
  "linen",
  "moss",
  "north",
  "oak",
  "plain",
] as const;

export type WordStrategy =
  | "perfect"
  | "corrected-substitution"
  | "corrected-extra"
  | "retained-substitution"
  | "retained-extra"
  | "missing-suffix";

export type TimingProfile =
  | "uniform"
  | "bursts"
  | "front-loaded"
  | "back-loaded"
  | "exact-second";

export interface TraceDescriptor {
  mode: "words" | "time";
  timeSeconds: 15 | 30 | 60;
  wordCount: number;
  wordOffset: number;
  strategies: WordStrategy[];
  punctuation: boolean;
  numbers: boolean;
  finishPartial: boolean;
  timingProfile: TimingProfile;
  durationUs: number;
}

export const descriptorArbitrary: fc.Arbitrary<TraceDescriptor> = fc.record({
  mode: fc.constantFrom("words" as const, "time" as const),
  timeSeconds: fc.constantFrom(15 as const, 30 as const, 60 as const),
  wordCount: fc.integer({ min: 2, max: 12 }),
  wordOffset: fc.integer({ min: 0, max: WORDS.length - 1 }),
  strategies: fc.array(
    fc.constantFrom<WordStrategy>(
      "perfect",
      "corrected-substitution",
      "corrected-extra",
      "retained-substitution",
      "retained-extra",
      "missing-suffix",
    ),
    { minLength: 1, maxLength: 12 },
  ),
  punctuation: fc.boolean(),
  numbers: fc.boolean(),
  finishPartial: fc.boolean(),
  timingProfile: fc.constantFrom<TimingProfile>(
    "uniform",
    "bursts",
    "front-loaded",
    "back-loaded",
    "exact-second",
  ),
  durationUs: fc
    .integer({ min: 10_000, max: 12_000_000 })
    .map((value) => Math.round(value / 10) * 10),
});

interface UntimedEvent {
  type: "insert" | "delete";
  wordIndex: number;
  grapheme: string;
}

function wrongFor(character: string): string {
  return character === "x" ? "z" : "x";
}

function targetWords(descriptor: TraceDescriptor): string[] {
  const promptWordCount =
    descriptor.mode === "time"
      ? descriptor.wordCount + 8
      : descriptor.wordCount;
  const words = Array.from({ length: promptWordCount }, (_, index) => {
    let word = WORDS[(descriptor.wordOffset + index) % WORDS.length] ?? "word";
    if (descriptor.numbers && index % 5 === 1) word = `${word}42`;
    if (descriptor.punctuation && index % 4 === 2) word = `${word},`;
    return word;
  });
  return words;
}

function eventsForWord(
  word: string,
  wordIndex: number,
  strategy: WordStrategy,
  commit: boolean,
): UntimedEvent[] {
  const events: UntimedEvent[] = [];
  const characters = Array.from(word);
  const errorIndex = Math.floor(characters.length / 2);

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index] ?? "";
    if (
      (strategy === "corrected-substitution" ||
        strategy === "retained-substitution") &&
      index === errorIndex
    ) {
      const wrong = wrongFor(character);
      events.push({ type: "insert", wordIndex, grapheme: wrong });
      if (strategy === "corrected-substitution") {
        events.push({ type: "delete", wordIndex, grapheme: wrong });
        events.push({ type: "insert", wordIndex, grapheme: character });
      }
      continue;
    }
    if (
      strategy === "missing-suffix" &&
      index >= Math.max(1, characters.length - 2)
    ) {
      break;
    }
    events.push({ type: "insert", wordIndex, grapheme: character });
  }

  if (strategy === "corrected-extra" || strategy === "retained-extra") {
    const extra = "x";
    events.push({ type: "insert", wordIndex, grapheme: extra });
    if (strategy === "corrected-extra") {
      events.push({ type: "delete", wordIndex, grapheme: extra });
    }
  }
  if (commit) {
    events.push({ type: "insert", wordIndex, grapheme: " " });
  }
  return events;
}

function normalizedDescriptor(descriptor: TraceDescriptor): TraceDescriptor {
  return {
    ...descriptor,
    wordCount: Math.max(2, Math.min(12, descriptor.wordCount)),
    strategies:
      descriptor.strategies.length === 0 ? ["perfect"] : descriptor.strategies,
    durationUs: Math.max(10_000, Math.round(descriptor.durationUs / 10) * 10),
  };
}

function createUntimedEvents(
  descriptor: TraceDescriptor,
  words: readonly string[],
): UntimedEvent[] {
  const events: UntimedEvent[] = [];
  const typedWordCount =
    descriptor.mode === "time" ? descriptor.wordCount : words.length;
  for (let wordIndex = 0; wordIndex < typedWordCount; wordIndex += 1) {
    const finalWord = wordIndex === typedWordCount - 1;
    let strategy =
      descriptor.strategies[wordIndex % descriptor.strategies.length] ??
      "perfect";
    if (descriptor.mode === "words" && finalWord) strategy = "perfect";
    const commit =
      !finalWord ||
      (descriptor.mode === "time" && !descriptor.finishPartial);
    events.push(
      ...eventsForWord(words[wordIndex] ?? "word", wordIndex, strategy, commit),
    );
  }
  return events;
}

function roundTen(value: number): number {
  return Math.round(value / 10) * 10;
}

function eventTimes(
  count: number,
  completionAtUs: number,
  mode: TraceDescriptor["mode"],
  profile: TimingProfile,
): number[] {
  if (count <= 1) return [0];
  const activityEnd =
    mode === "words"
      ? completionAtUs
      : Math.max(10, Math.floor(completionAtUs * 0.85));
  const maximum = mode === "time" ? completionAtUs - 10 : activityEnd;
  const result: number[] = [];

  for (let index = 0; index < count; index += 1) {
    const ratio = index / (count - 1);
    let shaped = ratio;
    if (profile === "front-loaded") shaped = ratio ** 2;
    if (profile === "back-loaded") shaped = Math.sqrt(ratio);
    let atUs = roundTen(shaped * maximum);
    if (profile === "bursts" && index > 0 && index % 3 !== 0) {
      atUs = result[index - 1] ?? atUs;
    }
    result.push(atUs);
  }

  if (profile === "exact-second" && maximum >= 1_000_000) {
    const desiredSecond =
      Math.max(1, Math.min(Math.floor(maximum / 1_000_000), 3)) * 1_000_000;
    let nearestIndex = 1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    result.forEach((value, index) => {
      const distance = Math.abs(value - desiredSecond);
      if (index > 0 && index < result.length - 1 && distance < nearestDistance) {
        nearestIndex = index;
        nearestDistance = distance;
      }
    });
    result[nearestIndex] = desiredSecond;
    for (let index = nearestIndex - 1; index >= 0; index -= 1) {
      result[index] = Math.min(result[index] ?? 0, desiredSecond);
    }
    for (let index = nearestIndex + 1; index < result.length; index += 1) {
      result[index] = Math.max(result[index] ?? desiredSecond, desiredSecond);
    }
  }

  result[0] = 0;
  if (mode === "words") result[result.length - 1] = completionAtUs;
  return result.map((value, index) =>
    Math.max(
      index === 0 ? 0 : (result[index - 1] ?? 0),
      Math.min(maximum, roundTen(value)),
    ),
  );
}

export function traceFromDescriptor(
  rawDescriptor: TraceDescriptor,
  id: string,
): ParityTrace {
  const descriptor = normalizedDescriptor(rawDescriptor);
  const prompt = targetWords(descriptor);
  const untimed = createUntimedEvents(descriptor, prompt);
  const completionAtUs =
    descriptor.mode === "time"
      ? descriptor.timeSeconds * 1_000_000
      : descriptor.durationUs;
  const times = eventTimes(
    untimed.length,
    completionAtUs,
    descriptor.mode,
    descriptor.timingProfile,
  );
  const events: TraceEvent[] = untimed.map((event, sequence) => ({
    ...event,
    atUs: times[sequence] ?? 0,
    sequence,
  }));

  return {
    version: "trace/1",
    id,
    config: {
      mode: descriptor.mode,
      modeValue:
        descriptor.mode === "time" ? descriptor.timeSeconds : prompt.length,
      punctuation: descriptor.punctuation,
      numbers: descriptor.numbers,
    },
    prompt,
    completionAtUs,
    events,
  };
}

const BASE: TraceDescriptor = {
  mode: "words",
  timeSeconds: 15,
  wordCount: 3,
  wordOffset: 0,
  strategies: ["perfect"],
  punctuation: false,
  numbers: false,
  finishPartial: false,
  timingProfile: "uniform",
  durationUs: 2_000_000,
};

const CORE_TARGETED_DESCRIPTORS: readonly TraceDescriptor[] = [
  { ...BASE, durationUs: 10_000 },
  {
    ...BASE,
    wordCount: 2,
    strategies: ["corrected-extra", "perfect"],
    durationUs: 768_000,
  },
  { ...BASE, durationUs: 499_990 },
  { ...BASE, durationUs: 500_000 },
  { ...BASE, durationUs: 500_010 },
  { ...BASE, durationUs: 994_990 },
  { ...BASE, durationUs: 995_000 },
  { ...BASE, durationUs: 995_010 },
  { ...BASE, durationUs: 999_990 },
  { ...BASE, durationUs: 999_000 },
  { ...BASE, durationUs: 1_000_000 },
  { ...BASE, durationUs: 1_000_010 },
  { ...BASE, durationUs: 1_004_990 },
  { ...BASE, durationUs: 1_005_000 },
  { ...BASE, durationUs: 1_001_000 },
  { ...BASE, durationUs: 2_000_010 },
  { ...BASE, durationUs: 2_004_990 },
  { ...BASE, durationUs: 3_000_010 },
  { ...BASE, durationUs: 3_004_990 },
  { ...BASE, wordCount: 2, durationUs: 2_005_000 },
  { ...BASE, wordCount: 2, durationUs: 4_025_000 },
  { ...BASE, wordCount: 2, durationUs: 8_114_990 },
  { ...BASE, wordCount: 2, durationUs: 8_115_000 },
  { ...BASE, wordCount: 2, durationUs: 8_115_010 },
  { ...BASE, wordCount: 2, durationUs: 8_115_860 },
  { ...BASE, durationUs: 1_494_990 },
  { ...BASE, durationUs: 1_495_000 },
  { ...BASE, durationUs: 1_495_010 },
  { ...BASE, durationUs: 1_994_990 },
  { ...BASE, durationUs: 1_995_000 },
  { ...BASE, durationUs: 1_995_010 },
  { ...BASE, durationUs: 2_994_990 },
  { ...BASE, durationUs: 2_995_000 },
  { ...BASE, durationUs: 2_995_010 },
  {
    ...BASE,
    timingProfile: "bursts",
    strategies: ["corrected-substitution", "perfect"],
  },
  {
    ...BASE,
    timingProfile: "exact-second",
    strategies: ["corrected-extra", "perfect"],
    durationUs: 4_000_000,
  },
  {
    ...BASE,
    strategies: ["retained-substitution", "perfect"],
  },
  { ...BASE, strategies: ["retained-extra", "perfect"] },
  { ...BASE, strategies: ["missing-suffix", "perfect"] },
  {
    ...BASE,
    punctuation: true,
    numbers: true,
    strategies: ["corrected-substitution", "perfect"],
  },
  {
    ...BASE,
    mode: "time",
    timeSeconds: 15,
    wordCount: 4,
    finishPartial: true,
    strategies: ["perfect", "retained-substitution"],
    timingProfile: "exact-second",
  },
  {
    ...BASE,
    mode: "time",
    timeSeconds: 30,
    wordCount: 5,
    finishPartial: false,
    strategies: ["corrected-extra", "missing-suffix", "perfect"],
    timingProfile: "bursts",
  },
  {
    ...BASE,
    mode: "time",
    timeSeconds: 60,
    wordCount: 6,
    finishPartial: true,
    strategies: ["retained-extra", "perfect"],
    timingProfile: "front-loaded",
  },
];

const ROLLOVER_WINDOW_DESCRIPTORS: readonly TraceDescriptor[] = [
  1,
  2,
  3,
].flatMap((second) =>
  Array.from({ length: 501 }, (_, hundredthIndex) => ({
    ...BASE,
    durationUs:
      second * 1_000_000 - 5_000 + hundredthIndex * 10,
  })),
);

const EXACT_SECOND_DESCRIPTORS: readonly TraceDescriptor[] = Array.from(
  { length: 12 },
  (_, index) => ({
    ...BASE,
    durationUs: (index + 1) * 1_000_000,
    timingProfile: "exact-second" as const,
  }),
);

export const TARGETED_DESCRIPTORS: readonly TraceDescriptor[] = [
  ...CORE_TARGETED_DESCRIPTORS,
  ...ROLLOVER_WINDOW_DESCRIPTORS,
  ...EXACT_SECOND_DESCRIPTORS,
];

export function coverageTags(
  descriptor: TraceDescriptor,
  trace: ParityTrace,
): string[] {
  const tags = new Set<string>();
  tags.add(`mode:${descriptor.mode}`);
  tags.add(`timing:${descriptor.timingProfile}`);
  descriptor.strategies.forEach((strategy) => tags.add(`strategy:${strategy}`));
  if (descriptor.punctuation) tags.add("content:punctuation");
  if (descriptor.numbers) tags.add("content:numbers");
  if (trace.events.some((event, index) => event.atUs === trace.events[index - 1]?.atUs)) {
    tags.add("timing:duplicate");
  }
  if (trace.events.some((event) => event.atUs > 0 && event.atUs % 1_000_000 === 0)) {
    tags.add("timing:exact-second-event");
  }
  if (trace.completionAtUs < 1_000_000) tags.add("duration:subsecond");
  if (trace.completionAtUs >= 15_000_000) tags.add("duration:long");
  const endMs = trace.completionAtUs / 1_000;
  const distance = Math.round(endMs / 1_000) * 1_000 - endMs;
  if (distance > 0 && distance <= 5) tags.add("duration:rollover-window");
  if (distance < 0 && distance > -5) {
    tags.add("duration:terminal-rollover-window");
  }
  return [...tags].sort();
}
