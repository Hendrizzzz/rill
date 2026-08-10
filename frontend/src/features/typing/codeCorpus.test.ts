import { describe, expect, it } from "vitest";

import {
  CODE_EXERCISE_COUNT,
  CODE_LANGUAGES,
  CODE_PATTERN_COUNT,
  CODE_SCENARIO_COUNT,
  exercisesForLanguage,
  selectCodeExercise,
} from "./codeCorpus";
import { CODE_INDENT_WIDTH } from "./targetText";

describe("code corpus", () => {
  it("contains 4,096 contextual drills across eight languages", () => {
    expect(CODE_LANGUAGES).toHaveLength(8);
    expect(CODE_PATTERN_COUNT).toBe(32);
    expect(CODE_SCENARIO_COUNT).toBe(16);
    expect(CODE_EXERCISE_COUNT).toBe(4_096);

    const allExercises = CODE_LANGUAGES.flatMap((language) =>
      exercisesForLanguage(language.id),
    );
    expect(new Set(allExercises.map((exercise) => exercise.id)).size).toBe(
      4_096,
    );
    const canonicalPatterns = exercisesForLanguage("cpp")
      .filter((exercise) => exercise.variation === 1)
      .map((exercise) => exercise.pattern)
      .sort();

    for (const language of CODE_LANGUAGES) {
      const exercises = exercisesForLanguage(language.id);
      expect(exercises).toHaveLength(512);
      expect(new Set(exercises.map((exercise) => exercise.pattern)).size).toBe(
        32,
      );
      expect(new Set(exercises.map((exercise) => exercise.scenario)).size).toBe(
        16,
      );
      expect(new Set(exercises.map((exercise) => exercise.title)).size).toBe(
        512,
      );
      expect(
        exercises
          .filter((exercise) => exercise.variation === 1)
          .map((exercise) => exercise.pattern)
          .sort(),
      ).toEqual(canonicalPatterns);
      for (const pattern of canonicalPatterns) {
        expect(
          exercises.filter((exercise) => exercise.pattern === pattern),
        ).toHaveLength(16);
      }
      for (const exercise of exercises) {
        expect(exercise.code).not.toContain("__FN__");
        expect(exercise.code).not.toContain("\t");
        expect(exercise.code.split("\n").every((line) => line.length > 0)).toBe(
          true,
        );
        const indentations = exercise.code
          .split("\n")
          .map((line) => line.match(/^ +/u)?.[0].length ?? 0);
        expect(
          indentations.every(
            (indentation) =>
              indentation === 0 || indentation % CODE_INDENT_WIDTH === 0,
          ),
        ).toBe(true);
        expect(exercise.lesson.length).toBeGreaterThan(20);
        expect(exercise.assumptions.length).toBeGreaterThan(10);
        expect(exercise.complexity).toMatch(/^O\(/u);
      }
    }

    expect(
      allExercises.some((exercise) =>
        exercise.code
          .split("\n")
          .some((line) =>
            line.startsWith(" ".repeat(CODE_INDENT_WIDTH * 2)),
          ),
      ),
    ).toBe(true);

    const positiveIndentations = allExercises
      .flatMap((exercise) => exercise.code.split("\n"))
      .map((line) => line.match(/^ +/u)?.[0].length ?? 0)
      .filter((indentation) => indentation > 0);
    expect(Math.min(...positiveIndentations)).toBe(CODE_INDENT_WIDTH);
  });

  it("keeps language-specific teaching claims aligned with the implementation", () => {
    const cExercises = exercisesForLanguage("c");
    const core = (pattern: string) =>
      cExercises.find(
        (exercise) => exercise.pattern === pattern && exercise.variation === 1,
      );

    expect(core("contains-duplicate")).toMatchObject({
      topic: "array scan",
      complexity: "O(n²) time · O(1) space",
    });
    expect(core("two-sum")).toMatchObject({
      topic: "nested scan",
      complexity: "O(n²) time · O(1) space",
    });
    expect(core("reverse-string")).toMatchObject({
      complexity: "O(n) time · O(1) space",
    });
    expect(core("valid-brackets")?.code).toContain("else return false;");
    expect(core("maximum")?.assumptions).toContain("non-empty");
  });

  it("selects the same exercise for the same language and seed", () => {
    const first = selectCodeExercise("python3", 1_234_567);
    const second = selectCodeExercise("python3", 1_234_567);
    const otherLanguage = selectCodeExercise("go", 1_234_567);

    expect(second).toEqual(first);
    expect(otherLanguage.id).not.toBe(first.id);
  });

  it("pins representative seed mappings for the immutable code-v4 corpus", () => {
    expect(
      [0, 15, 16, 255, 256, 383, 384, 511, 512].map(
        (seed) => selectCodeExercise("python3", seed).id,
      ),
    ).toEqual([
      "code-v4-python3-contains-duplicate-core",
      "code-v4-python3-contains-duplicate-time-capsule",
      "code-v4-python3-palindrome-core",
      "code-v4-python3-climb-stairs-time-capsule",
      "code-v4-python3-linear-search-core",
      "code-v4-python3-maximum-subarray-time-capsule",
      "code-v4-python3-fibonacci-core",
      "code-v4-python3-unique-count-sorted-time-capsule",
      "code-v4-python3-contains-duplicate-core",
    ]);
  });

  it("pins concept boundaries across every immutable language ordering", () => {
    for (const language of CODE_LANGUAGES) {
      expect(selectCodeExercise(language.id, 0).id).toBe(
        `code-v4-${language.id}-contains-duplicate-core`,
      );
      expect(selectCodeExercise(language.id, 384).id).toBe(
        `code-v4-${language.id}-fibonacci-core`,
      );
      expect(selectCodeExercise(language.id, 511).id).toBe(
        `code-v4-${language.id}-unique-count-sorted-time-capsule`,
      );
    }
  });

  it("keeps constant-space drills free of copying slices", () => {
    for (const language of ["python3", "javascript", "typescript"] as const) {
      for (const pattern of ["maximum-subarray", "second-largest"] as const) {
        const exercise = exercisesForLanguage(language).find(
          (candidate) =>
            candidate.pattern === pattern && candidate.variation === 1,
        );
        expect(exercise?.complexity).toContain("O(1) space");
        expect(exercise?.code).not.toMatch(/values\[1:\]|values\.slice\(1\)/u);
      }
    }
  });

  it("changes context, identifiers, and teaching copy across scenarios", () => {
    const core = selectCodeExercise("python3", 0);
    const cinema = selectCodeExercise("python3", 1);

    expect(core.pattern).toBe(cinema.pattern);
    expect(core.scenario).toBe("core");
    expect(cinema.scenario).toBe("cinema");
    expect(cinema.title).toContain("Cinema night");
    expect(cinema.code).not.toBe(core.code);
    expect(cinema.lesson).not.toBe(core.lesson);
    expect(cinema.lesson).toContain(cinema.topic);
    expect(cinema.lesson).not.toContain("{topic}");
  });

  it("does not rewrite standard-library member names as scenario vocabulary", () => {
    const cinemaAnagram = exercisesForLanguage("typescript").find(
      (exercise) =>
        exercise.pattern === "anagram" && exercise.scenario === "cinema",
    );

    expect(cinemaAnagram?.code).toContain("counts.values()");
    expect(cinemaAnagram?.code).not.toContain("counts.ratings()");
    expect(
      exercisesForLanguage("typescript").find(
        (exercise) =>
          exercise.pattern === "reverse-string" &&
          exercise.scenario === "cinema",
      )?.code,
    ).toContain("[...subtitle]");
  });
});
