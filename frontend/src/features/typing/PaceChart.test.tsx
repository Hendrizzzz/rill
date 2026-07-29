import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { buildMonotonePath } from "./monotonePath";
import { PaceChart } from "./PaceChart";
import type { PaceBucket } from "./types";

afterEach(cleanup);

function sample(overrides: Partial<PaceBucket> = {}): PaceBucket {
  return {
    durationMs: 1_000,
    typedCharacters: 5,
    correctCharacters: 5,
    rawCharacters: 5,
    errors: 0,
    ...overrides,
  };
}

describe("PaceChart", () => {
  it("draws shape-preserving cubic paths", () => {
    const points = [
      { x: 0, y: 80 },
      { x: 40, y: 20 },
      { x: 160, y: 90 },
      { x: 300, y: 40 },
    ];
    const path = buildMonotonePath(points);

    expect(path).toMatch(/^M /);
    expect(path.match(/\bC\b/g)).toHaveLength(3);
    expect(path).not.toMatch(/NaN|Infinity/);

    let startY = points[0]?.y ?? 0;
    const curves = [
      ...path.matchAll(
        /C (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g,
      ),
    ];
    expect(curves).toHaveLength(points.length - 1);
    curves.forEach((curve) => {
      const firstControlY = Number(curve[2]);
      const secondControlY = Number(curve[4]);
      const endY = Number(curve[6]);
      const lower = Math.min(startY, endY);
      const upper = Math.max(startY, endY);
      expect(firstControlY).toBeGreaterThanOrEqual(lower);
      expect(firstControlY).toBeLessThanOrEqual(upper);
      expect(secondControlY).toBeGreaterThanOrEqual(lower);
      expect(secondControlY).toBeLessThanOrEqual(upper);
      startY = endY;
    });
  });

  it("renders distinct WPM, raw, and burst histories with familiar axes", () => {
    const { container } = render(
      <PaceChart
        buckets={[
          sample(),
          sample({
            typedCharacters: 6,
            correctCharacters: 9,
            rawCharacters: 10,
            errors: 1,
          }),
          sample({
            typedCharacters: 4,
            correctCharacters: 14,
            rawCharacters: 15,
          }),
        ]}
      />,
    );

    expect(container.querySelector("path.pace-line--wpm")).toBeInTheDocument();
    expect(container.querySelector("path.pace-line--raw")).toBeInTheDocument();
    expect(container.querySelector("path.pace-line--burst")).toBeInTheDocument();
    expect(screen.getByText("words per minute")).toBeVisible();
    expect(screen.getByText("× errors")).toBeVisible();
    expect(
      screen.getByLabelText(
        "average raw pace 60 words per minute; peak burst 72 words per minute",
      ),
    ).toHaveTextContent("avg 60 · peak 72");
    expect(container.querySelector(".pace-error-mark")).toHaveTextContent("×");
  });

  it("exposes all four graph values from keyboard focus", () => {
    render(
      <PaceChart
        buckets={[
          sample({
            typedCharacters: 6,
            correctCharacters: 5,
            rawCharacters: 6,
            errors: 1,
          }),
        ]}
      />,
    );

    const scrubber = screen.getByRole("slider", {
      name: "Inspect typing pace",
    });
    expect(scrubber).toHaveAttribute(
      "aria-valuetext",
      "1 second, 60 words per minute, 72 raw words per minute, 72 burst words per minute, 1 error",
    );
    fireEvent.focus(scrubber);
    expect(screen.getByTestId("pace-tooltip")).toHaveTextContent("wpm60");
    expect(screen.getByTestId("pace-tooltip")).toHaveTextContent("raw72");
    expect(screen.getByTestId("pace-tooltip")).toHaveTextContent("burst72");
    expect(screen.getByTestId("pace-tooltip")).toHaveTextContent("errors1");
  });

  it("renders an honest empty state", () => {
    render(<PaceChart buckets={[]} />);

    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.getByText("No pace samples")).toBeVisible();
  });

  it("labels a single subsecond sample with its duration", () => {
    render(<PaceChart buckets={[sample({ durationMs: 750 })]} />);

    expect(screen.getByText("0.75s")).toBeVisible();
    expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toEqual(
      expect.stringContaining("0.75 seconds"),
    );
  });

  it("uses canonical cumulative time at a floating half-WPM boundary", () => {
    render(
      <PaceChart
        buckets={[
          sample({
            correctCharacters: 100,
            rawCharacters: 100,
          }),
          sample({
            durationMs: 528.32,
            correctCharacters: 199,
            rawCharacters: 199,
          }),
        ]}
      />,
    );

    const scrubber = screen.getByRole("slider", {
      name: "Inspect typing pace",
    });
    fireEvent.change(scrubber, { target: { value: "1" } });
    expect(scrubber).toHaveAttribute(
      "aria-valuetext",
      expect.stringContaining("1563 words per minute"),
    );
    expect(scrubber).toHaveAttribute(
      "aria-valuetext",
      expect.stringContaining("1563 raw words per minute"),
    );
  });
});
