# Content corpus and provenance

Status: active
Last reviewed: 2026-08-10

Rill's content should be worth practising and safe to publish. It does not copy
modern movie or television dialogue, song lyrics, commercial quote databases,
LeetCode problem statements, editorials, solutions, or user submissions.

## Quote v3

`quote-v3` contains 1,030 entries:

- 906 excerpts from public-domain books, each linked to its Project Gutenberg
  edition. Nine hundred are deterministically selected from 25 classic works;
  six previously curated excerpts are retained; and
- 124 project-original entries across craft, learning, courage, friendship,
  focus, rest, change, wonder, home, resilience, humor, perspective, and
  beginnings. This includes 104 concise observations and 20 longer micro-scenes
  with dialogue, technical moments, and everyday narrative.

Every entry has a stable ID, theme, attribution, source URL, and rights basis.
The `Rill original` attribution means the line was created for this repository,
not collected from a quotation site or attributed to a public figure.

The generated literary file can be reproduced with
`npm run corpus:quotes:build`. Selection filters reject broken punctuation,
ebook scaffolding, dialogue fragments, dangling honorifics, context-dependent
openings, common OCR artifacts, and a small list of unsuitable language. Every
downloaded edition is protected by a pinned SHA-256 digest, while corpus tests
enforce counts, uniqueness, ordered quotation marks, HTTPS provenance, source
distribution, and a fingerprint of all persisted quote fields.

The 900 generated items are filtered and ranked literary excerpts, not a
human-curated claim about the "greatest quotes of all time." Modern movie and
television dialogue is deliberately excluded unless a maintainer can document
permission or public-domain status.

Public-domain status varies by territory. The bundled literary excerpts come
from works published long enough ago to be public domain in the United States;
the source link remains attached so maintainers can review the exact edition.

## Code v4

`code-v4` contains 32 algorithm concepts, 16 mnemonic contexts, and eight
language implementations, producing 4,096 deterministic typing drills (512 per
selected language). The
count is intentionally described as contextual drills, not distinct algorithms.
Contexts are memory cues and spaced-repetition variants; they are not claims
that every algorithm is a real-world model of the named setting.
The source stays compact: one selected drill is constructed from an authored
language template and scenario vocabulary at prompt creation time. No database
or per-keystroke network request is involved.

When the corpus grows to hundreds of genuinely different concepts, move the
immutable version into content-hashed static shards by language and topic.
Serve those through the CDN, preload before typing begins, cache for the
session, and preserve older corpus versions for result identity.

## Review rules

Before release:

1. Check quote IDs, normalized text uniqueness, length, attribution, rights,
   theme, and source URL.
2. Check code IDs, indentation, metadata, concept/scenario distribution, and
   deterministic seed selection.
3. Compile every generated implementation and execute the shared
   JavaScript/TypeScript behavior fixtures. CI treats a missing language
   toolchain as a failure; local runs must report any unavailable toolchains.
4. Record the exact verified counts and any unavailable toolchains without
   converting assumptions into test claims.
