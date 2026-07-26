import { describe, expect, it } from "vitest";

import { segmentGraphemes, translateBeforeInput } from "./inputAdapter";

describe("typing input adapter", () => {
  it("translates physical/mobile text insertion into graphemes", () => {
    expect(translateBeforeInput("insertText", "ab", false)).toEqual({
      kind: "insert",
      graphemes: ["a", "b"],
    });
  });

  it("allows empty and unrecognised insert events without scoring", () => {
    expect(translateBeforeInput("insertText", null, false)).toEqual({
      kind: "allow",
    });
    expect(translateBeforeInput("formatBold", null, false)).toEqual({
      kind: "allow",
    });
  });

  it("keeps a joined emoji as one committed grapheme", () => {
    expect(segmentGraphemes("👩‍💻")).toEqual(["👩‍💻"]);
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
