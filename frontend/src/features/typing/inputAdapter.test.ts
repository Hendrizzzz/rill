import { describe, expect, it } from "vitest";

import {
  normalizeGraphemeForTarget,
  segmentGraphemes,
  translateBeforeInput,
} from "./inputAdapter";

describe("typing input adapter", () => {
  it("translates physical/mobile text insertion into graphemes", () => {
    expect(translateBeforeInput("insertText", "ab", false)).toEqual({
      kind: "insert",
      graphemes: ["a", "b"],
    });
  });

  it("blocks empty and unrecognised mutation events without scoring", () => {
    expect(translateBeforeInput("insertText", null, false)).toEqual({
      kind: "block",
    });
    expect(translateBeforeInput("formatBold", null, false)).toEqual({
      kind: "block",
    });
  });

  it("keeps a joined emoji as one committed grapheme", () => {
    expect(segmentGraphemes("👩‍💻")).toEqual(["👩‍💻"]);
  });

  it("normalizes decomposed text before segmenting it", () => {
    expect(translateBeforeInput("insertText", "e\u0301", false)).toEqual({
      kind: "insert",
      graphemes: ["é"],
    });
  });

  it("falls back to Unicode code points when Segmenter is unavailable", () => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, "Segmenter");
    expect(Reflect.deleteProperty(Intl, "Segmenter")).toBe(true);
    try {
      expect(segmentGraphemes("a😀")).toEqual(["a", "😀"]);
    } finally {
      if (descriptor !== undefined) {
        Object.defineProperty(Intl, "Segmenter", descriptor);
      }
    }
  });

  it("allows intermediate composition without scoring it", () => {
    expect(translateBeforeInput("insertCompositionText", "あ", true)).toEqual({
      kind: "allow",
    });
  });

  it("safely ignores events without a DOM input type", () => {
    expect(translateBeforeInput(undefined, null, false)).toEqual({
      kind: "allow",
    });
  });

  it("translates backwards deletion", () => {
    expect(translateBeforeInput("deleteContentBackward", null, false)).toEqual({
      kind: "backspace",
    });
  });

  it("distinguishes native whole-word deletion from one-character deletion", () => {
    expect(translateBeforeInput("deleteWordBackward", null, false)).toEqual({
      kind: "deleteWordBackward",
    });
  });

  it.each([
    "\u00a0",
    "\u1680",
    "\u2002",
    "\u2003",
    "\u2004",
    "\u2007",
    "\u2008",
    "\u2009",
    "\u200a",
    "\u200b",
    "\u202f",
    "\u3000",
    "\ufeff",
  ])("normalizes typable Unicode separator %s to a regular space", (data) => {
    expect(translateBeforeInput("insertText", data, false)).toEqual({
      kind: "insert",
      graphemes: [" "],
    });
  });

  it.each([
    ["\u2019", "'"],
    ["'", "\u2018"],
    ["\u201c", '"'],
    ["\u2014", "-"],
    ["-", "\u2013"],
    ["\u201a", ","],
  ])("normalizes typographic %s to the expected %s", (input, target) => {
    expect(normalizeGraphemeForTarget(input, target)).toBe(target);
  });

  it("does not normalize typographic input when the target is unrelated", () => {
    expect(normalizeGraphemeForTarget("\u2014", "x")).toBe("\u2014");
  });

  it.each(["insertFromPaste", "insertFromDrop"])(
    "rejects %s",
    (inputType) => {
      expect(translateBeforeInput(inputType, "pasted", false)).toEqual({
        kind: "reject",
        reason: "paste",
      });
    },
  );

  it.each(["insertReplacementText", "historyUndo"])(
    "rejects %s as replacement input",
    (inputType) => {
      expect(translateBeforeInput(inputType, "replacement", false)).toEqual({
        kind: "reject",
        reason: "replacement",
      });
    },
  );
});
