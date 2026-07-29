export type InputDecision =
  | { kind: "insert"; graphemes: readonly string[] }
  | { kind: "backspace" }
  | { kind: "deleteWordBackward" }
  | { kind: "block" }
  | { kind: "reject"; reason: "paste" | "replacement" }
  | { kind: "allow" };

const TYPABLE_SPACE_CODE_POINTS = new Set([
  0x0020,
  0x00a0,
  0x1680,
  0x2002,
  0x2003,
  0x2004,
  0x2007,
  0x2008,
  0x2009,
  0x200a,
  0x200b,
  0x202f,
  0x3000,
  0xfeff,
]);

const TYPOGRAPHIC_EQUIVALENCE_GROUPS: readonly ReadonlySet<string>[] = [
  new Set(["'", "\u2018", "\u2019", "\u02bb", "\u02bc", "\u05f3", "\u1fbd"]),
  new Set(['"', "\u201c", "\u201d", "\u201e"]),
  new Set(["-", "\u2010", "\u2011", "\u2013", "\u2014"]),
  new Set([",", "\u201a"]),
];

export function normalizeInputGrapheme(grapheme: string): string {
  const codePoint = grapheme.codePointAt(0);
  return codePoint !== undefined &&
    Array.from(grapheme).length === 1 &&
    TYPABLE_SPACE_CODE_POINTS.has(codePoint)
    ? " "
    : grapheme;
}

export function normalizeGraphemeForTarget(
  grapheme: string,
  target: string | undefined,
): string {
  if (target === undefined || grapheme === target) {
    return grapheme;
  }
  return TYPOGRAPHIC_EQUIVALENCE_GROUPS.some(
    (group) => group.has(grapheme) && group.has(target),
  )
    ? target
    : grapheme;
}

export function segmentGraphemes(
  value: string,
  locale = "en",
): string[] {
  const normalized = value.normalize("NFC");
  if ("Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(locale, {
      granularity: "grapheme",
    });
    return Array.from(segmenter.segment(normalized), ({ segment }) => segment);
  }
  return Array.from(normalized);
}

export function translateBeforeInput(
  inputType: string | undefined,
  data: string | null,
  isComposing: boolean,
  allowLineBreak = false,
): InputDecision {
  if (
    inputType === undefined ||
    isComposing ||
    inputType === "insertCompositionText"
  ) {
    return { kind: "allow" };
  }

  if (inputType === "insertText") {
    const graphemes = segmentGraphemes(data ?? "").map(
      normalizeInputGrapheme,
    );
    return graphemes.length > 0
      ? { kind: "insert", graphemes }
      : { kind: "block" };
  }

  if (inputType === "insertLineBreak" || inputType === "insertParagraph") {
    return allowLineBreak
      ? { kind: "insert", graphemes: ["\n"] }
      : { kind: "block" };
  }

  if (inputType === "deleteContentBackward") {
    return { kind: "backspace" };
  }

  if (inputType === "deleteWordBackward") {
    return { kind: "deleteWordBackward" };
  }

  if (inputType === "insertFromPaste" || inputType === "insertFromDrop") {
    return { kind: "reject", reason: "paste" };
  }

  if (
    inputType.startsWith("insertReplacement") ||
    inputType.startsWith("history")
  ) {
    return { kind: "reject", reason: "replacement" };
  }

  return { kind: "block" };
}
