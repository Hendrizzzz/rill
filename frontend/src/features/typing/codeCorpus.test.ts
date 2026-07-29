import { describe, expect, it } from "vitest";

import {
  CODE_EXERCISE_COUNT,
  CODE_LANGUAGES,
  CODE_PATTERN_COUNT,
  exercisesForLanguage,
  selectCodeExercise,
} from "./codeCorpus";
import { CODE_INDENT_WIDTH } from "./targetText";

describe("code corpus", () => {
  it("contains 512 deterministic, attributed drills across eight languages", () => {
    expect(CODE_LANGUAGES).toHaveLength(8);
    expect(CODE_PATTERN_COUNT).toBe(16);
    expect(CODE_EXERCISE_COUNT).toBe(512);

    const allExercises = CODE_LANGUAGES.flatMap((language) =>
      exercisesForLanguage(language.id),
    );
    expect(new Set(allExercises.map((exercise) => exercise.id)).size).toBe(512);
    const canonicalTitles = exercisesForLanguage("cpp")
      .filter((exercise) => exercise.variation === 1)
      .map((exercise) => exercise.title)
      .sort();

    for (const language of CODE_LANGUAGES) {
      const exercises = exercisesForLanguage(language.id);
      expect(exercises).toHaveLength(64);
      expect(new Set(exercises.map((exercise) => exercise.title)).size).toBe(16);
      expect(
        exercises
          .filter((exercise) => exercise.variation === 1)
          .map((exercise) => exercise.title)
          .sort(),
      ).toEqual(canonicalTitles);
      for (const title of canonicalTitles) {
        expect(
          exercises.filter((exercise) => exercise.title === title),
        ).toHaveLength(4);
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

    expect(
      cExercises.find((exercise) =>
        exercise.id.includes("contains-duplicate-1"),
      ),
    ).toMatchObject({
      topic: "array scan",
      complexity: "O(n²) time · O(1) space",
    });
    expect(
      cExercises.find((exercise) => exercise.id.includes("two-sum-1")),
    ).toMatchObject({
      topic: "nested scan",
      complexity: "O(n²) time · O(1) space",
    });
    expect(
      cExercises.find((exercise) => exercise.id.includes("reverse-string-1")),
    ).toMatchObject({
      complexity: "O(n) time · O(1) space",
    });
    expect(
      cExercises.find((exercise) => exercise.id.includes("valid-brackets-1"))
        ?.code,
    ).toContain("else return false;");
    expect(
      cExercises.find((exercise) => exercise.id.includes("maximum-1"))
        ?.assumptions,
    ).toContain("non-empty");
  });

  it("selects the same exercise for the same language and seed", () => {
    const first = selectCodeExercise("python3", 1_234_567);
    const second = selectCodeExercise("python3", 1_234_567);
    const otherLanguage = selectCodeExercise("go", 1_234_567);

    expect(second).toEqual(first);
    expect(otherLanguage.id).not.toBe(first.id);
  });
});
