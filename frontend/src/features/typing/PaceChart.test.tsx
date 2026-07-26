import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { buildMonotonePath } from "./monotonePath";
import { PaceChart } from "./PaceChart";

afterEach(cleanup);

describe("PaceChart", () => {
  it("draws a smooth shape-preserving path through every sample", () => {
    const points = [
      { x: 0, y: 80 },
      { x: 40, y: 20 },
      { x: 160, y: 90 },
      { x: 300, y: 40 },
    ];
    const path = buildMonotonePath(points);
    const commands = path.split(" C ").slice(1);

    expect(path).toMatch(/^M /);
    expect(commands).toHaveLength(points.length - 1);
    expect(path).not.toMatch(/NaN|Infinity/);
    commands.forEach((command, index) => {
      const values = command.split(" ").map(Number);
      const startY = points[index]?.y ?? 0;
      const endY = points[index + 1]?.y ?? 0;
      const minimum = Math.min(startY, endY);
      const maximum = Math.max(startY, endY);
      expect(values[1]).toBeGreaterThanOrEqual(minimum);
      expect(values[1]).toBeLessThanOrEqual(maximum);
      expect(values[3]).toBeGreaterThanOrEqual(minimum);
      expect(values[3]).toBeLessThanOrEqual(maximum);
      expect(values[5]).toBe(endY);
    });
  });

  it("renders the pace line as cubic segments instead of a polyline", () => {
    const { container } = render(
      <PaceChart
        buckets={[
          { durationMs: 1_000, typedCharacters: 2 },
          { durationMs: 1_000, typedCharacters: 8 },
          { durationMs: 1_000, typedCharacters: 1 },
          { durationMs: 1_000, typedCharacters: 7 },
        ]}
      />,
    );
    const path = container.querySelector("path.pace-line");

    expect(path).toBeInTheDocument();
    expect(path?.getAttribute("d")?.match(/\bC\b/g)).toHaveLength(3);
    expect(container.querySelector("polyline.pace-line")).not.toBeInTheDocument();
  });

  it("uses familiar twenty-WPM axis steps for an ordinary pace", () => {
    const { container } = render(
      <PaceChart
        buckets={[{ durationMs: 1_000, typedCharacters: 6 }]}
      />,
    );

    expect(
      Array.from(container.querySelectorAll(".pace-y-tick")).map(
        (tick) => tick.textContent,
      ),
    ).toEqual(["0", "20", "40", "60", "80"]);
  });

  it("uses elapsed time for samples and a duration-weighted average", () => {
    const { container } = render(
      <PaceChart
        buckets={[
          { durationMs: 1_000, typedCharacters: 5 },
          { durationMs: 500, typedCharacters: 5 },
        ]}
      />,
    );

    expect(screen.getByText(/avg 80 · peak 120/)).toBeVisible();
    expect(
      screen.getByText("120", { selector: ".pace-y-tick" }),
    ).toBeVisible();
    expect(screen.getByText("1s", { selector: ".pace-x-tick" })).toBeVisible();
    expect(container.querySelector(".pace-average-line")).not.toBeInTheDocument();
    expect(screen.getByText(/Focus the chart/)).toHaveClass("sr-only");
    const scrubber = screen.getByRole("slider", {
      name: "Inspect raw typing pace",
    });
    expect(scrubber).toHaveAttribute(
      "aria-valuetext",
      "0 to 1 seconds, 60 raw words per minute, 5 typed characters",
    );

    fireEvent.focus(scrubber);
    expect(screen.getByTestId("pace-tooltip")).toHaveTextContent("0–1s");
    fireEvent.change(scrubber, { target: { value: "1" } });
    expect(scrubber).toHaveAttribute(
      "aria-valuetext",
      "1 to 1.5 seconds, 120 raw words per minute, 5 typed characters",
    );
    expect(screen.getByTestId("pace-tooltip")).toHaveTextContent("1–1.5s");
    expect(screen.getByTestId("pace-tooltip")).toHaveTextContent("120 wpm");
  });

  it("keeps a single sample inspectable", () => {
    render(
      <PaceChart
        buckets={[{ durationMs: 750, typedCharacters: 1 }]}
      />,
    );

    const scrubber = screen.getByRole("slider", {
      name: "Inspect raw typing pace",
    });
    expect(scrubber).toHaveAttribute("min", "0");
    expect(scrubber).toHaveAttribute("max", "0");
    expect(scrubber).toHaveAttribute(
      "aria-valuetext",
      "0 to 0.8 seconds, 16 raw words per minute, 1 typed character",
    );
    expect(screen.getByText("One pace sample.")).toHaveClass("sr-only");
  });

  it("renders an honest empty state without an inert scrubber", () => {
    render(<PaceChart buckets={[]} />);

    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.getByText("No pace samples")).toBeVisible();
    expect(screen.getByText("No pace samples.")).toHaveClass("sr-only");
  });
});
