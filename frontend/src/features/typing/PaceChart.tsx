import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";

import { buildMonotonePath } from "./monotonePath";
import type { PaceBucket } from "./types";

interface PaceChartProps {
  buckets: readonly PaceBucket[];
}

interface PlotPoint {
  index: number;
  startMs: number;
  endMs: number;
  durationMs: number;
  typedCharacters: number;
  rawWpm: number;
  x: number;
  y: number;
}

interface AxisTick {
  label: string;
  position: number;
}

interface WpmScale {
  interval: number;
  maximum: number;
}

interface TooltipPosition {
  left: number;
  top: number;
}

const CHART_WIDTH = 600;
const CHART_HEIGHT = 128;
const PLOT_TOP = 8;
const PLOT_BOTTOM = 118;
const TOOLTIP_GAP = 12;
const TOOLTIP_VIEWPORT_MARGIN = 10;

function formatSeconds(milliseconds: number): string {
  const seconds = milliseconds / 1_000;
  return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1);
}

function visualInterval(point: PlotPoint): string {
  return `${formatSeconds(point.startMs)}–${formatSeconds(point.endMs)}s`;
}

function accessibleValue(point: PlotPoint): string {
  return [
    `${formatSeconds(point.startMs)} to ${formatSeconds(point.endMs)} seconds`,
    `${String(Math.round(point.rawWpm))} raw words per minute`,
    `${String(point.typedCharacters)} typed ${
      point.typedCharacters === 1 ? "character" : "characters"
    }`,
  ].join(", ");
}

function buildWpmScale(peak: number): WpmScale {
  const targetMaximum = Math.max(80, peak);
  const roughInterval = targetMaximum / 5;
  const magnitude = 10 ** Math.floor(Math.log10(roughInterval));
  const normalized = roughInterval / magnitude;
  const multiplier =
    [1, 2, 4, 5, 10].find(
      (candidate) => candidate >= normalized,
    ) ?? 10;
  const interval = multiplier * magnitude;
  return {
    interval,
    maximum: Math.ceil(targetMaximum / interval) * interval,
  };
}

function timeTickInterval(totalSeconds: number): number {
  if (totalSeconds <= 0) {
    return 1;
  }
  const roughInterval = totalSeconds / 6;
  const magnitude = 10 ** Math.floor(Math.log10(roughInterval));
  const normalized = roughInterval / magnitude;
  const multiplier =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return multiplier * magnitude;
}

function buildTimeTicks(totalDuration: number): AxisTick[] {
  const totalSeconds = totalDuration / 1_000;
  if (totalSeconds <= 0) {
    return [];
  }
  if (totalSeconds < 1) {
    return [
      {
        label: `${totalSeconds.toFixed(1)}s`,
        position: 100,
      },
    ];
  }

  const interval = Math.max(1, timeTickInterval(totalSeconds));
  const ticks: AxisTick[] = [];
  for (
    let seconds = interval;
    seconds <= Math.floor(totalSeconds);
    seconds += interval
  ) {
    ticks.push({
      label: `${String(seconds)}s`,
      position: (seconds / totalSeconds) * 100,
    });
  }
  return ticks;
}

function buildPlotPoints(
  buckets: readonly PaceBucket[],
  rates: readonly number[],
  totalDuration: number,
  maximum: number,
): PlotPoint[] {
  const points: PlotPoint[] = [];
  let elapsedMs = 0;

  buckets.forEach((bucket, index) => {
    const startMs = elapsedMs;
    const endMs = startMs + bucket.durationMs;
    elapsedMs = endMs;
    const rawWpm = rates[index] ?? 0;
    const x =
      buckets.length === 1 || totalDuration <= 0
        ? CHART_WIDTH / 2
        : (((startMs + endMs) / 2) / totalDuration) * CHART_WIDTH;
    const y =
      PLOT_BOTTOM - (rawWpm / maximum) * (PLOT_BOTTOM - PLOT_TOP);
    points.push({
      index,
      startMs,
      endMs,
      durationMs: bucket.durationMs,
      typedCharacters: bucket.typedCharacters,
      rawWpm,
      x,
      y,
    });
  });

  return points;
}

export function PaceChart({ buckets }: PaceChartProps) {
  const instructionId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [committedIndex, setCommittedIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const [tooltipPosition, setTooltipPosition] =
    useState<TooltipPosition | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const scrubberRef = useRef<HTMLInputElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (committedIndex === null) {
      return undefined;
    }
    const dismissCommittedPoint = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        plotRef.current !== null &&
        !plotRef.current.contains(target)
      ) {
        setCommittedIndex(null);
      }
    };
    document.addEventListener("pointerdown", dismissCommittedPoint);
    return () => {
      document.removeEventListener("pointerdown", dismissCommittedPoint);
    };
  }, [committedIndex]);

  const { points, average, peak, xTicks, yTicks } = useMemo(() => {
    const totalDuration = buckets.reduce(
      (sum, bucket) => sum + bucket.durationMs,
      0,
    );
    const totalCharacters = buckets.reduce(
      (sum, bucket) => sum + bucket.typedCharacters,
      0,
    );
    const rates = buckets.map((bucket) =>
      bucket.durationMs > 0
        ? (bucket.typedCharacters * 12_000) / bucket.durationMs
        : 0,
    );
    const scale = buildWpmScale(
      rates.length > 0 ? Math.max(...rates) : 0,
    );
    const nextPoints = buildPlotPoints(
      buckets,
      rates,
      totalDuration,
      scale.maximum,
    );
    const intervalCount = Math.round(scale.maximum / scale.interval);

    return {
      points: nextPoints,
      average:
        totalDuration > 0
          ? (totalCharacters * 12_000) / totalDuration
          : 0,
      peak: rates.length > 0 ? Math.max(...rates) : 0,
      xTicks: buildTimeTicks(totalDuration),
      yTicks: Array.from({ length: intervalCount + 1 }, (_, index) => {
        const value = scale.interval * index;
        const y =
          PLOT_BOTTOM -
          (value / scale.maximum) * (PLOT_BOTTOM - PLOT_TOP);
        return {
          label: String(Math.round(value)),
          position: (y / CHART_HEIGHT) * 100,
        };
      }),
    };
  }, [buckets]);

  const safeSelectedIndex = Math.min(
    selectedIndex,
    Math.max(0, points.length - 1),
  );
  const activeIndex =
    hoverIndex ??
    (focused && points.length > 0 ? safeSelectedIndex : committedIndex);
  const activePoint =
    activeIndex === null ? undefined : points[activeIndex];
  const selectedPoint = points[safeSelectedIndex];
  const pathData = buildMonotonePath(points);

  const nearestPointForClientX = (
    clientX: number,
    currentTarget: HTMLDivElement,
  ): PlotPoint | undefined => {
    if (points.length === 0) {
      return undefined;
    }
    const bounds = currentTarget.getBoundingClientRect();
    const chartX =
      bounds.width <= 0
        ? 0
        : ((clientX - bounds.left) / bounds.width) * CHART_WIDTH;
    return points.reduce((best, point) =>
      Math.abs(point.x - chartX) < Math.abs(best.x - chartX) ? point : best,
    );
  };

  const selectNearestPoint = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const nearest = nearestPointForClientX(
      event.clientX,
      event.currentTarget,
    );
    if (nearest === undefined) {
      return;
    }
    setHoverIndex(nearest.index);
  };

  const commitPointAt = (
    clientX: number,
    currentTarget: HTMLDivElement,
  ) => {
    const nearest = nearestPointForClientX(
      clientX,
      currentTarget,
    );
    if (nearest === undefined) {
      return;
    }
    setHoverIndex(null);
    setSelectedIndex(nearest.index);
    setCommittedIndex(nearest.index);
    scrubberRef.current?.focus({ preventScroll: true });
  };

  const commitNearestPoint = (event: ReactMouseEvent<HTMLDivElement>) => {
    commitPointAt(event.clientX, event.currentTarget);
  };

  const commitNearestTouchPoint = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.pointerType !== "mouse") {
      commitPointAt(event.clientX, event.currentTarget);
    }
  };

  const activeLeft =
    activePoint === undefined ? 0 : (activePoint.x / CHART_WIDTH) * 100;
  const activeTop =
    activePoint === undefined ? 0 : (activePoint.y / CHART_HEIGHT) * 100;

  useLayoutEffect(() => {
    if (activePoint === undefined) {
      return undefined;
    }

    const updateTooltipPosition = () => {
      const plot = plotRef.current;
      const tooltip = tooltipRef.current;
      if (plot === null || tooltip === null) {
        return;
      }

      const plotBounds = plot.getBoundingClientRect();
      const tooltipBounds = tooltip.getBoundingClientRect();
      const anchorX = plotBounds.left + (activeLeft / 100) * plotBounds.width;
      const anchorY = plotBounds.top + (activeTop / 100) * plotBounds.height;
      const maximumLeft = Math.max(
        TOOLTIP_VIEWPORT_MARGIN,
        window.innerWidth -
          tooltipBounds.width -
          TOOLTIP_VIEWPORT_MARGIN,
      );
      const maximumTop = Math.max(
        TOOLTIP_VIEWPORT_MARGIN,
        window.innerHeight -
          tooltipBounds.height -
          TOOLTIP_VIEWPORT_MARGIN,
      );
      const left = Math.min(
        maximumLeft,
        Math.max(
          TOOLTIP_VIEWPORT_MARGIN,
          anchorX - tooltipBounds.width / 2,
        ),
      );
      const preferredAbove =
        anchorY - tooltipBounds.height - TOOLTIP_GAP;
      const preferredBelow = anchorY + TOOLTIP_GAP;
      const unclampedTop =
        preferredAbove >= TOOLTIP_VIEWPORT_MARGIN
          ? preferredAbove
          : preferredBelow + tooltipBounds.height <=
              window.innerHeight - TOOLTIP_VIEWPORT_MARGIN
            ? preferredBelow
            : anchorY - tooltipBounds.height / 2;
      const top = Math.min(
        maximumTop,
        Math.max(TOOLTIP_VIEWPORT_MARGIN, unclampedTop),
      );

      setTooltipPosition({ left, top });
    };

    updateTooltipPosition();
    window.addEventListener("resize", updateTooltipPosition);
    window.addEventListener("scroll", updateTooltipPosition, true);
    return () => {
      window.removeEventListener("resize", updateTooltipPosition);
      window.removeEventListener("scroll", updateTooltipPosition, true);
    };
  }, [activeLeft, activePoint, activeTop]);

  return (
    <>
      <figure className="pace-figure">
      <div className={`pace-chart-shell${focused ? " is-focused" : ""}`}>
        <div className="pace-y-axis" aria-hidden="true">
          <span className="pace-y-title">raw wpm</span>
          {yTicks.map((tick) => (
            <span
              className="pace-y-tick"
              key={tick.label}
              style={{ top: `${String(tick.position)}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>

        <div
          ref={plotRef}
          className="pace-plot"
          onPointerDown={selectNearestPoint}
          onPointerMove={selectNearestPoint}
          onPointerUp={commitNearestTouchPoint}
          onClick={commitNearestPoint}
          onPointerLeave={() => {
            setHoverIndex(null);
          }}
          onPointerCancel={() => {
            setHoverIndex(null);
          }}
        >
          <svg
            className="pace-chart"
            viewBox={[
              "0",
              "0",
              String(CHART_WIDTH),
              String(CHART_HEIGHT),
            ].join(" ")}
            aria-hidden="true"
            focusable="false"
            preserveAspectRatio="none"
          >
            {yTicks.map((tick) => {
              const y = (tick.position / 100) * CHART_HEIGHT;
              return (
                <line
                  className="pace-grid-line"
                  key={tick.label}
                  x1="0"
                  y1={y}
                  x2={CHART_WIDTH}
                  y2={y}
                />
              );
            })}
            <line
              className="pace-axis-line"
              x1="0"
              y1={PLOT_TOP}
              x2="0"
              y2={PLOT_BOTTOM}
            />
            {activePoint === undefined ? null : (
              <line
                className="pace-active-line"
                x1={activePoint.x}
                y1={PLOT_TOP}
                x2={activePoint.x}
                y2={PLOT_BOTTOM}
              />
            )}
            {points.length > 1 ? (
              <path className="pace-line" d={pathData} />
            ) : null}
          </svg>

          <div className="pace-points" aria-hidden="true">
            {points.map((point) => (
              <span
                className="pace-point"
                key={String(point.index)}
                style={{
                  left: `${String((point.x / CHART_WIDTH) * 100)}%`,
                  top: `${String((point.y / CHART_HEIGHT) * 100)}%`,
                }}
              />
            ))}
          </div>

          {activePoint === undefined ? null : (
            <span
              className="pace-active-point"
              aria-hidden="true"
              style={{
                left: `${String(activeLeft)}%`,
                top: `${String(activeTop)}%`,
              }}
            />
          )}

          {points.length > 0 ? (
            <input
              ref={scrubberRef}
              className="pace-scrubber"
              type="range"
              min="0"
              max={String(Math.max(0, points.length - 1))}
              step="1"
              value={safeSelectedIndex}
              aria-label="Inspect raw typing pace"
              aria-describedby={instructionId}
              aria-valuetext={
                selectedPoint === undefined
                  ? "No pace sample"
                  : accessibleValue(selectedPoint)
              }
              onChange={(event) => {
                setHoverIndex(null);
                setSelectedIndex(Number(event.currentTarget.value));
              }}
              onKeyDown={() => {
                setHoverIndex(null);
              }}
              onFocus={() => {
                setFocused(true);
              }}
              onBlur={() => {
                setFocused(false);
                setHoverIndex(null);
              }}
            />
          ) : (
            <p className="pace-empty">No pace samples</p>
          )}
        </div>

        <div className="pace-x-axis" aria-hidden="true">
          {xTicks.map((tick) => (
            <span
              className="pace-x-tick"
              key={tick.label}
              style={{
                left: `clamp(0.75rem, ${String(tick.position)}%, calc(100% - 0.75rem))`,
              }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>
      <figcaption>
        <span>
          avg {Math.round(average)} · peak {Math.round(peak)}
        </span>
        <span id={instructionId} className="sr-only">
          {points.length > 1
            ? "Focus the chart and use arrow keys, Home, or End to inspect samples."
            : points.length === 1
              ? "One pace sample."
              : "No pace samples."}
        </span>
      </figcaption>
      </figure>
      {activePoint === undefined
        ? null
        : createPortal(
            <div
              ref={tooltipRef}
              className="pace-tooltip"
              data-testid="pace-tooltip"
              aria-hidden="true"
              style={{
                left: tooltipPosition?.left ?? 0,
                top: tooltipPosition?.top ?? 0,
                visibility:
                  tooltipPosition === null ? "hidden" : "visible",
              }}
            >
              <p>{visualInterval(activePoint)}</p>
              <dl>
                <div>
                  <dt>raw pace</dt>
                  <dd>{Math.round(activePoint.rawWpm)} wpm</dd>
                </div>
                <div>
                  <dt>typed</dt>
                  <dd>
                    {activePoint.typedCharacters}{" "}
                    {activePoint.typedCharacters === 1 ? "char" : "chars"}
                  </dd>
                </div>
                <div>
                  <dt>window</dt>
                  <dd>{formatSeconds(activePoint.durationMs)}s</dd>
                </div>
              </dl>
            </div>,
            document.body,
          )}
    </>
  );
}
