# Code-learning corpus

Status: code-v4 content policy
Last updated: 2026-08-10

## Scope

TypeThock bundles 32 familiar algorithm concepts:

1. duplicate detection
2. palindrome checking
3. string reversal
4. array summation
5. maximum scanning
6. vowel counting
7. binary search
8. pair-sum lookup
9. bracket validation
10. sorted-array merging
11. moving zeroes
12. missing-number lookup
13. anagram checking
14. first-unique-character lookup
15. Euclid's greatest-common-divisor algorithm
16. constant-space stair-count dynamic programming
17. linear search
18. minimum scanning
19. occurrence counting
20. sorted-order checking
21. iterative factorial
22. square-root-bounded prime checking
23. prefix-sum construction
24. maximum-subarray dynamic programming
25. iterative Fibonacci calculation
26. decimal digit summation
27. set-bit counting
28. lower-bound binary search
29. second-distinct-maximum tracking
30. Boyer-Moore majority voting
31. longest contiguous increasing-run scanning
32. distinct-value counting in sorted input

Each pattern is presented through 16 mnemonic contexts, including a cinema night,
recording studio, orbital mission, road trip, community garden, repair
workshop, newsroom, cafe, and study session. Identifiers and the short learning
frame change with the setting while the algorithmic invariant stays explicit.
Across C++, Java, Python 3, C, C#, JavaScript, TypeScript, and Go this produces
4,096 contextual typing drills, but still only 32 distinct algorithm concepts.
These contexts are memory cues rather than claims that each algorithm models a
real task in the named setting. The product UI reports the 512 drills available
for the selected language alongside concept and context counts.

The eight languages are a deliberate popular subset of LeetCode's broader
runtime catalog. This is a scope decision, not a claim that these are the only
popular languages or that TypeThock is affiliated with LeetCode:

- <https://support.leetcode.com/hc/en-us/articles/360011833974-What-are-the-environments-for-the-programming-languages>

## Content and copyright boundary

Algorithms and broad solution techniques can be described independently, but a
particular problem statement, editorial explanation, example set, or code
implementation is creative expression that may be protected. Public visibility
or widespread reposting does not make content public domain.

TypeThock therefore:

- authors every bundled implementation, title, invariant note, and complexity
  label specifically for this project;
- uses only generic algorithm names and facts needed to teach the technique;
- does not copy or adapt LeetCode problem statements, examples, editorials,
  source code, user submissions, branding, or proprietary assets;
- does not scrape LeetCode or fetch third-party prompts at runtime; and
- does not describe a drill as an official answer to a numbered problem.

LeetCode's terms identify its questions, solutions, and other site content as
protected material and restrict automated extraction:

- <https://leetcode.com/terms/>

This document records the project's engineering/content policy, not legal
advice.

## Authoring rules

Every drill must:

- be deterministic and available offline;
- contain only non-empty lines with four-space indentation and no tab
  characters;
- use a recognizable, idiomatic implementation for its selected language;
- state material input assumptions in its learning note;
- state complexity for the implementation actually shown, including
  language-specific overrides;
- remain short enough to practise as one focused typing test; and
- avoid placeholder text and incomplete pseudocode.

Scenario variants intentionally retain the same algorithm while changing its
application frame, function name, and core identifiers. This is contextual
spaced repetition, not additional algorithm coverage. New concept counts may
only be increased by adding a genuinely different algorithm and its verified
implementations.

The drills are function-focused fragments, matching the concise editor format
used by interview-practice sites. C, C++, Java, C#, and Go fragments assume the
standard imports and enclosing program/class supplied by a judge or local
harness; they are not presented as standalone executables.

## Maintenance checklist

Before adding or changing a pattern:

1. Review the implementation and its input assumptions in all eight languages.
2. Check that the complexity claim matches each concrete implementation.
3. Run the corpus shape/unit tests and frontend typecheck, lint, and build.
4. Exercise language selection, line entry, completion, history, and responsive
   overflow in Playwright.
5. Compile or execute snippets with representative cases where the local/CI
   toolchain supports that language. Record languages that remain manually
   reviewed rather than claiming executable verification.
6. Re-run the backend migration/integration suite when result dimensions change.

Completed results persist the corpus/scoring identity. Historical pre-release
code results are `code-v1`; automatic structural indentation and four-space
emission are `code-v2`; the first contextual learning corpus is `code-v3`; the
32-concept expansion is `code-v4`. Personal records keep those versions separate.
