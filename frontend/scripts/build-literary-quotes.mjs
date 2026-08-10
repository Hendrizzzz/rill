import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sources = [
  ["alice", 11, "Lewis Carroll", "Alice's Adventures in Wonderland", "wonder"],
  ["pride-prejudice", 1342, "Jane Austen", "Pride and Prejudice", "perspective"],
  ["frankenstein", 84, "Mary Shelley", "Frankenstein", "responsibility"],
  ["sherlock", 1661, "Arthur Conan Doyle", "The Adventures of Sherlock Holmes", "observation"],
  ["great-expectations", 1400, "Charles Dickens", "Great Expectations", "growth"],
  ["jane-eyre", 1260, "Charlotte Brontë", "Jane Eyre", "independence"],
  ["little-women", 514, "Louisa May Alcott", "Little Women", "family"],
  ["moby-dick", 2701, "Herman Melville", "Moby-Dick", "adventure"],
  ["emma", 158, "Jane Austen", "Emma", "kindness"],
  ["walden", 205, "Henry David Thoreau", "Walden", "attention"],
  ["dorian-gray", 174, "Oscar Wilde", "The Picture of Dorian Gray", "wit"],
  ["anne-green-gables", 45, "L. M. Montgomery", "Anne of Green Gables", "imagination"],
  ["treasure-island", 120, "Robert Louis Stevenson", "Treasure Island", "adventure"],
  ["time-machine", 35, "H. G. Wells", "The Time Machine", "curiosity"],
  ["dracula", 345, "Bram Stoker", "Dracula", "courage"],
  ["secret-garden", 17396, "Frances Hodgson Burnett", "The Secret Garden", "renewal"],
  ["wind-willows", 289, "Kenneth Grahame", "The Wind in the Willows", "friendship"],
  ["wizard-oz", 55, "L. Frank Baum", "The Wonderful Wizard of Oz", "home"],
  ["peter-pan", 16, "J. M. Barrie", "Peter Pan", "imagination"],
  ["room-view", 2641, "E. M. Forster", "A Room with a View", "perspective"],
  ["earnest", 844, "Oscar Wilde", "The Importance of Being Earnest", "wit"],
  ["wuthering-heights", 768, "Emily Brontë", "Wuthering Heights", "resilience"],
  ["sense-sensibility", 161, "Jane Austen", "Sense and Sensibility", "character"],
  ["tom-sawyer", 74, "Mark Twain", "The Adventures of Tom Sawyer", "mischief"],
  ["call-wild", 215, "Jack London", "The Call of the Wild", "nature"],
];

// Pin the downloaded editions so quote-v3 IDs can never silently change text.
// Update these hashes only as part of an explicit corpus-version migration.
const SOURCE_SHA256 = {
  alice: "01b38ea4c710a84bc18d0bd41271a5a1a92b94e97b2812f4dece97d4a694725e",
  "pride-prejudice": "74f2665d6e6925fc2c17dec644bec9e87df478a0f1836822125e8acbb3777806",
  frankenstein: "7810cd483cffcf2cc8a1d8f0d5807931e69d4f48cd14149b8c76f88af82fead3",
  sherlock: "922e2a12ccb43a4c9544c260b2166c6ad2097aeb5957faeee113f173bb857cd0",
  "great-expectations": "9a637118af8e953e9764ec603d9b0a032883384d465acac2e27966a80cf1c6f8",
  "jane-eyre": "13414dee2951c3ee731d76d2ffd822016b2479c892162760c5d0eb2aa5fa7631",
  "little-women": "677d034b4a3d1cea92d075939878f852a7a3ec757dc9ed05ef0c40cab5c1e6de",
  "moby-dick": "9a6844ac0703853720010787c7b6c70b0020f1ab1862dcd74452fa46474d1215",
  emma: "532b122b4e6a76cc556d6fdcd729b5892f5c4ce4a1b7060b9f832adfad8680dc",
  walden: "2d9a76a2e3e8195c69430516ebd33c4d0757a53ad432ff6186b7b794e6fe99f9",
  "dorian-gray": "38f36b510417177aa87a6a24c968e3ec63a447b7df36a9c1a7c5a3f2d9e51547",
  "anne-green-gables": "89a5e9fb2e0bb44562a969785385366f94e1da736aebee7d9cdf459eb0b5f9f6",
  "treasure-island": "20cfdba153743bca26a15028ebb470121cbb7173ddafd435de5c19a79e4bbf30",
  "time-machine": "2892e919000e17c83e1dac51b30f4675db50536b644d7579fe8a89bb399a9bdc",
  dracula: "96cd16eacdbfebae8fdda5591f66e0cc8ee76be18e0cd1aca02bc00615782d28",
  "secret-garden":
    "438e61f5639bbe77d8730516944a312f4" +
    "bb0704d59a36b6b8d57a7b66457bcae",
  "wind-willows": "98f6b6cda20087857cefe9121b71d6166c1b92423bb7645fdba3c45ff0c141e8",
  "wizard-oz": "969bffab7740d4d8a0bac332d78bd0152ad4a40a2efc52f06c74a9bb6120be75",
  "peter-pan": "6b08714281fe38266a756741e4c62915cda7536c2f78cca501f7fd53f3f445ae",
  "room-view": "3dce58eb1786b10b79f8688968d293a1990dfed4a1f83a5c04a6a2a10381db36",
  earnest: "1b8a58099bb1cdef6a845277a4bacf2f4a268702c165bde30124d4b5105d1851",
  "wuthering-heights": "e533fe750589f0421d5d744576315f5c2b9b0d69e981179ea0551bbf134c5e02",
  "sense-sensibility": "22272ec4d4da2f50cda51edf34ab8486b325c4a99580120db565fb8917228a22",
  "tom-sawyer": "74d77384b123a6360db9ab58463cff8b38df8525fbdc6000c81ee388e1f3cf10",
  "call-wild": "30f569c5671bba7bbc4a92ab6d8ee01a0d3be00f994819c77da62c28041eb8a2",
};

const blocked = new RegExp(
  [
    "\\bnigg(?:er|ers|a|as)\\b",
    "\\bnegro(?:es)?\\b",
    "\\bchink(?:s)?\\b",
    "\\bgyps(?:y|ies)\\b",
    "\\bwhore(?:s)?\\b",
    "\\bbastard(?:s)?\\b",
    "\\bdamn(?:ed|ing)?\\b",
    "\\bhell\\b",
    "\\b(?:beat|blood|murder(?:ed|er)?|kill(?:ed|ing)?|corpse|suicide|torture|wound(?:ed|s)?)\\b",
  ].join("|"),
  "iu",
);

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function bodyOf(raw) {
  const start = raw.search(/\*\*\* START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/iu);
  const end = raw.search(/\*\*\* END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/iu);
  return raw.slice(start >= 0 ? start : 0, end > start ? end : undefined);
}

function normalizeSentence(value) {
  return value
    .replace(/\r/gu, "")
    .replace(/[_*]/gu, "")
    .replace(/\s+/gu, " ")
    .replace(/\s+([,.;:!?])/gu, "$1")
    .trim();
}

function splitSentences(paragraph) {
  const protectedPeriod = "\uE000";
  const protectedParagraph = paragraph
    .replace(
      /\b(Mr|Mrs|Ms|Dr|Prof|Rev|Capt|Col|Gen|Lt|Sgt|St|Jr|Sr|Esq)\./gu,
      `$1${protectedPeriod}`,
    )
    .replace(/\b([A-Z])\./gu, `$1${protectedPeriod}`);

  return protectedParagraph
    .split(/(?<=[.!?])\s+(?=[“‘"'A-Z])/gu)
    .map((sentence) => sentence.replaceAll(protectedPeriod, "."));
}

function balancedPair(value, opening, closing) {
  let depth = 0;
  for (const character of value) {
    if (character === opening) depth++;
    if (character === closing) {
      if (depth === 0) return false;
      depth--;
    }
  }
  return depth === 0;
}

function editorialScore(sentence) {
  const words = sentence.match(/[A-Za-z'-]+/gu) ?? [];
  const memorable = sentence.match(
    /\b(?:attention|beauty|believe|change|choice|courage|curious|dream|friend|friendship|heart|home|hope|imagination|kind|learn|life|love|mind|nature|quiet|remember|truth|wonder|world)\b/giu,
  )?.length ?? 0;
  const referential = sentence.match(
    /\b(?:he|her|hers|him|his|it|its|she|their|them|they|this|those)\b/giu,
  )?.length ?? 0;
  const dialogueBonus = sentence.startsWith("“") && sentence.endsWith("”") ? 8 : 0;
  return 200 - Math.abs(words.length - 17) * 3 + memorable * 7 - referential * 3 + dialogueBonus;
}

function candidatesFrom(raw) {
  const paragraphs = bodyOf(raw).split(/\n\s*\n/gu);
  const candidates = [];
  for (const paragraph of paragraphs) {
    const compact = normalizeSentence(paragraph);
    if (
      compact.length === 0 ||
      /^(?:chapter|book|contents|illustration|project gutenberg|transcriber)/iu.test(compact) ||
      /www\.|https?:|@|\[|\]|<|>|={2,}/iu.test(compact)
    ) {
      continue;
    }
    for (const fragment of splitSentences(compact)) {
      const sentence = normalizeSentence(fragment);
      const words = sentence.match(/[\p{L}\p{N}’'-]+/gu) ?? [];
      const letters = sentence.match(/\p{L}/gu) ?? [];
      if (
        words.length < 9 ||
        words.length > 30 ||
        sentence.length < 55 ||
        sentence.length > 180 ||
        letters.length < 40 ||
        blocked.test(sentence) ||
        /\b(?:said|asked|replied|answered|exclaimed|whispered|shouted)\b/iu.test(
          sentence,
        ) ||
        !balancedPair(sentence, "“", "”") ||
        sentence.includes("‘") ||
        (sentence.match(/"/gu)?.length ?? 0) % 2 !== 0 ||
        !balancedPair(sentence, "(", ")") ||
        sentence.includes("�") ||
        /[^\x20-\x7E\u2013\u2014\u2018\u2019\u201C\u201D\u2026]/u.test(sentence) ||
        /(?:\b(?:Mr|Mrs|Ms|Dr|Prof|Rev|Capt|Col|Gen|Lt|Sgt|St|Jr|Sr|Esq)\.|[:;–—-]|--)$/u.test(sentence) ||
        /^(?:[“"])?(?:and|because|besides|but|however|nor|or|nevertheless|so|then|therefore|yet|he|she|they|it|this|that|these|those|his|her|their|i|we|you)\b/iu.test(sentence) ||
        /^(?:enter|exit|exeunt)\b/iu.test(sentence) ||
        /\bp\s+enny/iu.test(sentence) ||
        /(?:^|\s)(?:CHAPTER|BOOK|VOL\.|MR\.|MRS\.)\s*$/u.test(sentence) ||
        /\b(?:illustration|frontispiece|copyright|ebook)\b/iu.test(sentence) ||
        /\d{3,}/u.test(sentence) ||
        /[A-Z]{5,}/u.test(sentence)
      ) {
        continue;
      }
      candidates.push(sentence);
    }
  }
  return [...new Set(candidates)];
}

const quotes = [];
for (const [slug, ebook, author, work, theme] of sources) {
  const sourceUrl = `https://www.gutenberg.org/ebooks/${ebook}`;
  const textUrl = `https://www.gutenberg.org/cache/epub/${ebook}/pg${ebook}.txt`;
  const response = await fetch(textUrl);
  if (!response.ok) {
    throw new Error(`${work} download failed with HTTP ${response.status}.`);
  }
  const raw = await response.text();
  const actualHash = createHash("sha256").update(raw).digest("hex");
  if (process.argv.includes("--print-source-hashes")) {
    console.log(`${slug}=${actualHash}`);
  } else {
    const expectedHash = SOURCE_SHA256[slug];
    if (expectedHash !== actualHash) {
      throw new Error(
        `${work} source changed: expected ${expectedHash ?? "a pinned hash"}, received ${actualHash}.`,
      );
    }
  }
  const candidates = candidatesFrom(raw).sort((left, right) => {
    const scoreDifference = editorialScore(right) - editorialScore(left);
    return scoreDifference === 0
      ? fnv1a(`${slug}:${left}`) - fnv1a(`${slug}:${right}`)
      : scoreDifference;
  });
  if (candidates.length < 36) {
    throw new Error(`${work} yielded only ${candidates.length} usable excerpts.`);
  }
  candidates.slice(0, 36).forEach((text, index) => {
    quotes.push({
      id: `literary-${slug}-${String(index + 1).padStart(2, "0")}`,
      text,
      attribution: `${author} · ${work}`,
      sourceUrl,
      theme,
      rights: "public-domain",
    });
  });
}

if (quotes.length !== 900) {
  throw new Error(`Expected 900 excerpts, received ${quotes.length}.`);
}

const output = [
  "// Generated by scripts/build-literary-quotes.mjs from the listed Project Gutenberg editions.",
  "// Do not edit individual entries by hand; update the source manifest or filters and regenerate.",
  "import type { PracticeQuote } from \"./quotes\";",
  "",
  `const SOURCES = ${JSON.stringify(
    sources.map(([slug, ebook, author, work, theme]) => ({
      slug,
      attribution: `${author} · ${work}`,
      sourceUrl: `https://www.gutenberg.org/ebooks/${ebook}`,
      theme,
    })),
    null,
    2,
  )} as const;`,
  "",
  `const EXCERPTS = ${JSON.stringify(quotes.map((quote) => quote.text), null, 2)} as const;`,
  "",
  "export const LITERARY_QUOTES_V3: readonly PracticeQuote[] = EXCERPTS.map((text, index) => {",
  "  const source = SOURCES[Math.floor(index / 36)];",
  "  if (source === undefined) throw new Error(\"Literary quote source is missing.\");",
  "  return {",
  "    id: \"literary-\" + source.slug + \"-\" + String((index % 36) + 1).padStart(2, \"0\"),",
  "    text,",
  "    attribution: source.attribution,",
  "    sourceUrl: source.sourceUrl,",
  "    theme: source.theme,",
  "    rights: \"public-domain\",",
  "  };",
  "});",
  "",
].join("\n");

const outputPath = resolve("src/features/typing/literaryQuotes.ts");
writeFileSync(outputPath, output, "utf8");
console.log(`Wrote ${quotes.length} public-domain excerpts to ${outputPath}.`);
