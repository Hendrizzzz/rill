export type InputDecision =
  | { kind: "insert"; graphemes: readonly string[] }
  | { kind: "backspace" }
  | { kind: "reject"; reason: "paste" | "replacement" }
  | { kind: "allow" };

export function segmentGraphemes(value: string): string[] {
  if ("Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    return Array.from(segmenter.segment(value), ({ segment }) => segment);
  }
  return Array.from(value);
}

export function translateBeforeInput(
  inputType: string | undefined,
  data: string | null,
  isComposing: boolean,
): InputDecision {
  if (
    inputType === undefined ||
    isComposing ||
    inputType === "insertCompositionText"
  ) {
    return { kind: "allow" };
  }

  if (inputType === "insertText") {
    const graphemes = segmentGraphemes(data ?? "");
    return graphemes.length > 0
      ? { kind: "insert", graphemes }
      : { kind: "allow" };
  }

  if (inputType === "deleteContentBackward") {
    return { kind: "backspace" };
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

  return { kind: "allow" };
}
