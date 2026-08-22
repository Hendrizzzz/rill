import { describe, expect, it } from "vitest";

import {
  PRACTICE_QUOTE_COUNT,
  PRACTICE_QUOTES_V1,
  PRACTICE_QUOTES_V2,
  PRACTICE_QUOTES_V3,
} from "./quotes";

function corpusFingerprint(): string {
  let hash = 0x811c9dc5;
  for (const quote of PRACTICE_QUOTES_V3) {
    const canonical = [
      quote.id,
      quote.text,
      quote.attribution,
      quote.sourceUrl,
      quote.theme,
      quote.rights,
    ].join("\u0000");
    for (const character of canonical) {
      hash ^= character.codePointAt(0) ?? 0;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, "0");
}

describe("quote corpus", () => {

  it("preserves verified classics and adds a substantial original collection", () => {
    expect(PRACTICE_QUOTES_V1).toHaveLength(6);
    expect(PRACTICE_QUOTES_V2).toHaveLength(130);
    expect(PRACTICE_QUOTE_COUNT).toBe(1_030);
    expect(PRACTICE_QUOTES_V3).toHaveLength(PRACTICE_QUOTE_COUNT);
    expect(
      PRACTICE_QUOTES_V3.filter((quote) => quote.rights === "typethock-original"),
    ).toHaveLength(124);
    expect(
      PRACTICE_QUOTES_V3.filter((quote) =>
        quote.id.startsWith("literary-"),
      ),
    ).toHaveLength(900);
  });

  it("uses unique stable ids and complete provenance metadata", () => {
    expect(
      new Set(PRACTICE_QUOTES_V3.map((quote) => quote.id)).size,
    ).toBe(PRACTICE_QUOTE_COUNT);

    for (const quote of PRACTICE_QUOTES_V3) {
      expect(quote.text.trim()).toBe(quote.text);
      expect(quote.text.split(/\s+/u).length).toBeGreaterThanOrEqual(5);
      expect(quote.text.length).toBeLessThanOrEqual(180);
      expect(quote.attribution.length).toBeGreaterThan(5);
      expect(quote.theme.length).toBeGreaterThan(2);
      const sourceUrl = new URL(quote.sourceUrl);
      expect(sourceUrl.protocol).toBe("https:");
    }
  });

  it("does not contain duplicate or near-empty normalized text", () => {
    const normalized = PRACTICE_QUOTES_V3.map((quote) =>
      quote.text.toLocaleLowerCase("en").replace(/[^a-z0-9]+/gu, "").trim(),
    );
    expect(new Set(normalized).size).toBe(PRACTICE_QUOTE_COUNT);
    expect(normalized.every((text) => text.length >= 24)).toBe(true);
  });

  it("keeps meaningful structural variety in the original collection", () => {
    const originals = PRACTICE_QUOTES_V3.filter(
      (quote) => quote.rights === "typethock-original",
    );
    const longerPassages = originals.filter(
      (quote) => quote.text.split(/\s+/u).length >= 15,
    );
    const genericOpenings = originals.filter((quote) =>
      /^(?:a|the)\s/iu.test(quote.text),
    );

    expect(longerPassages.length).toBeGreaterThanOrEqual(20);
    expect(genericOpenings.length / originals.length).toBeLessThan(0.4);
    expect(new Set(originals.map((quote) => quote.theme)).size).toBeGreaterThanOrEqual(
      13,
    );
  });

  it("balances the literary collection across independently linked editions", () => {
    const literary = PRACTICE_QUOTES_V3.filter((quote) =>
      quote.id.startsWith("literary-"),
    );
    const bySource = new Map<string, typeof literary>();
    for (const quote of literary) {
      bySource.set(quote.sourceUrl, [
        ...(bySource.get(quote.sourceUrl) ?? []),
        quote,
      ]);
    }

    expect(bySource.size).toBe(25);
    expect([...bySource.values()].every((quotes) => quotes.length === 36)).toBe(
      true,
    );
    expect(new Set(literary.map((quote) => quote.theme)).size).toBeGreaterThanOrEqual(
      20,
    );
    for (const quote of literary) {
      let dialogueDepth = 0;
      for (const character of quote.text) {
        if (character === "“") dialogueDepth++;
        if (character === "”") {
          expect(dialogueDepth).toBeGreaterThan(0);
          dialogueDepth--;
        }
      }
      expect(dialogueDepth).toBe(0);
      expect((quote.text.match(/"/gu)?.length ?? 0) % 2).toBe(0);
      expect(quote.text).not.toMatch(/�|\b(?:nigger|chink|whore)\b/iu);
      expect(quote.text).not.toMatch(
        /(?:\b(?:Mr|Mrs|Ms|Dr|Prof|Rev|Capt|Col|Gen|Lt|Sgt|St|Jr|Sr|Esq)\.|[:;–—-]|--)$/u,
      );
      expect(quote.text).not.toMatch(
        /^(?:[“"])?(?:and|because|besides|but|however|nor|or|nevertheless|so|then|therefore|yet|he|she|they|it|this|that|these|those|his|her|their|i|we|you)\b/iu,
      );
      expect(quote.text).not.toMatch(/\bp\s+enny/iu);
      expect(quote.text).not.toMatch(
        /[^\x20-\x7E\u2013\u2014\u2018\u2019\u201C\u201D\u2026]/u,
      );
    }
    for (const brokenOpening of [
      /^Laurence, whose kind old heart/iu,
      /^Craven looked at each other/iu,
      /^Andrew’s, and along the banks/iu,
      /^Darling left the house/iu,
      /^Goddard will want/iu,
    ]) {
      expect(literary.some((quote) => brokenOpening.test(quote.text))).toBe(
        false,
      );
    }
  });

  it("pins the complete quote-v3 semantic corpus", () => {
    expect(corpusFingerprint()).toBe("72e006b0");
  });
});
