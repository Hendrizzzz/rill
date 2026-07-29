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
import { bucketEndTimesMs, calculateWpm } from "./scoring";
import type { PaceBucket } from "./types";

interface PaceChartProps {
  buckets: readonly PaceBucket[];
}

interface PlotPoint {
  index: number;
  endMs: number;
  durationMs: number;
  typedCharacters: number;
  wpm: number;
  rawWpm: number;
  burst: number;
  errors: number;
  x: number;
  y: number;
  rawY: number;
  burstY: number;
  errorY: number;
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
const PLOT_LEFT = 2;
const PLOT_RIGHT = CHART_WIDTH - 2;
const PLOT_TOP = 8;
const PLOT_BOTTOM = 118;
const TOOLTIP_GAP = 12;
const TOOLTIP_VIEWPORT_MARGIN = 10;

function formatSeconds(milliseconds: number): string {
  return (milliseconds / 1_000)
    .toFixed(3)
    .replace(/\.?0+$/, "");
}

function accessibleValue(point: PlotPoint): string {
  const seconds = formatSeconds(point.endMs);
  return [
    `${seconds} ${seconds === "1" ? "second" : "seconds"}`,
    `${String(Math.round(point.wpm))} words per minute`,
    `${String(Math.round(point.rawWpm))} raw words per minute`,
    `${String(Math.round(point.burst))} burst words per minute`,
    `${String(point.errors)} ${point.errors === 1 ? "error" : "errors"}`,
  ].join(", ");
}

function buildWpmScale(peak: number): WpmScale {
  const targetMaximum = Math.max(80, peak);
  const roughInterval = targetMaximum / 5;
  const magnitude = 10 ** Math.floor(Math.log10(roughInterval));
  const normalized = roughInterval / magnitude;
  const multiplier =
    [1, 2, 4, 5, 10].find((candidate) => candidate >= normalized) ?? 10;
  const interval = multiplier * magnitude;
  return {
    interval,
    maximum: Math.ceil(targetMaximum / interval) * interval,
  };
}

function timeTickInterval(totalSeconds: number): number {
  const roughInterval = totalSeconds / 6;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, roughInterval)));
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
    return [{ label: `${formatSeconds(totalDuration)}s`, position: 100 }];
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

function linePoints(
  points: readonly PlotPoint[],
  field: "y" | "rawY" | "burstY",
): { x: number; y: number }[] {
  return points.map((point) => ({ x: point.x, y: point[field] }));
}

function buildPlotPoints(
  buckets: readonly PaceBucket[],
  maximum: number,
  maximumErrors: number,
): PlotPoint[] {
  const endTimes = bucketEndTimesMs(buckets);
  const totalDuration = endTimes.at(-1) ?? 0;
  return buckets.map((bucket, index) => {
    const elapsedMs = endTimes[index] ?? 0;
    const wpm = calculateWpm(bucket.correctCharacters, elapsedMs);
    const rawWpm = calculateWpm(bucket.rawCharacters, elapsedMs);
    const burst = calculateWpm(
      bucket.typedCharacters,
      bucket.durationMs,
    );
    const x =
      totalDuration <= 0
        ? CHART_WIDTH / 2
        : PLOT_LEFT +
          (elapsedMs / totalDuration) * (PLOT_RIGHT - PLOT_LEFT);
    const yFor = (value: number) =>
      PLOT_BOTTOM - (value / maximum) * (PLOT_BOTTOM - PLOT_TOP);
    const errorY =
      PLOT_BOTTOM -
      (bucket.errors / Math.max(1, maximumErrors)) *
        (PLOT_BOTTOM - PLOT_TOP);
    return {
      index,
      endMs: elapsedMs,
      durationMs: bucket.durationMs,
      typedCharacters: bucket.typedCharacters,
      wpm,
      rawWpm,
      burst,
      errors: bucket.errors,
      x,
      y: yFor(wpm),
      rawY: yFor(rawWpm),
      burstY: yFor(burst),
      errorY,
    };
  });
}

export function PaceChart({ buckets }: PaceChartProps) {
  const descriptionId = useId();
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
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        plotRef.current !== null &&
        !plotRef.current.contains(event.target)
      ) {
        setCommittedIndex(null);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
    };
  }, [committedIndex]);

  const { points, xTicks, yTicks, maximumErrors, averageRaw, peakBurst } =
    useMemo(() => {
    const totalDuration = bucketEndTimesMs(buckets).at(-1) ?? 0;
    const preliminary = buildPlotPoints(buckets, 1, 1);
    const peak = preliminary.reduce(
      (maximum, point) =>
        Math.max(maximum, point.wpm, point.rawWpm, point.burst),
      0,
    );
    const errorPeak = buckets.reduce(
      (maximum, bucket) => Math.max(maximum, bucket.errors),
      0,
    );
    const scale = buildWpmScale(peak);
    const nextPoints = buildPlotPoints(
      buckets,
      scale.maximum,
      errorPeak,
    );
    const intervalCount = Math.round(scale.maximum / scale.interval);
    return {
      points: nextPoints,
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
      maximumErrors: errorPeak,
      averageRaw:
        totalDuration <= 0
          ? 0
          : Math.round(
              calculateWpm(
                buckets.reduce(
                  (total, bucket) => total + bucket.typedCharacters,
                  0,
                ),
                totalDuration,
              ),
            ),
      peakBurst: Math.round(
        nextPoints.reduce(
          (maximum, point) => Math.max(maximum, point.burst),
          0,
        ),
      ),
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
  const wpmPath = buildMonotonePath(linePoints(points, "y"));
  const rawPath = buildMonotonePath(linePoints(points, "rawY"));
  const burstPath = buildMonotonePath(linePoints(points, "burstY"));

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
    setHoverIndex(
      nearestPointForClientX(event.clientX, event.currentTarget)?.index ?? null,
    );
  };

  const commitPointAt = (
    clientX: number,
    currentTarget: HTMLDivElement,
  ) => {
    const nearest = nearestPointForClientX(clientX, currentTarget);
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
    const plot = plotRef.current;
    const tooltip = tooltipRef.current;
    if (plot === null || tooltip === null) {
      return undefined;
    }
    const updatePosition = () => {
      const plotBounds = plot.getBoundingClientRect();
      const tooltipBounds = tooltip.getBoundingClientRect();
      const anchorX = plotBounds.left + (activeLeft / 100) * plotBounds.width;
      const anchorY = plotBounds.top + (activeTop / 100) * plotBounds.height;
      const maximumLeft = Math.max(
        TOOLTIP_VIEWPORT_MARGIN,
        window.innerWidth - tooltipBounds.width - TOOLTIP_VIEWPORT_MARGIN,
      );
      const maximumTop = Math.max(
        TOOLTIP_VIEWPORT_MARGIN,
        window.innerHeight - tooltipBounds.height - TOOLTIP_VIEWPORT_MARGIN,
      );
      const left = Math.min(
        maximumLeft,
        Math.max(
          TOOLTIP_VIEWPORT_MARGIN,
          anchorX - tooltipBounds.width / 2,
        ),
      );
      const above = anchorY - tooltipBounds.height - TOOLTIP_GAP;
      const below = anchorY + TOOLTIP_GAP;
      const preferredTop =
        above >= TOOLTIP_VIEWPORT_MARGIN
          ? above
          : below + tooltipBounds.height <=
              window.innerHeight - TOOLTIP_VIEWPORT_MARGIN
            ? below
            : anchorY - tooltipBounds.height / 2;
      setTooltipPosition({
        left,
        top: Math.min(
          maximumTop,
          Math.max(TOOLTIP_VIEWPORT_MARGIN, preferredTop),
        ),
      });
    };
    updatePosition();
    let animationFrame = 0;
    const updateAfterLayout = () => {
      updatePosition();
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updatePosition);
    };
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateAfterLayout);
    resizeObserver?.observe(plot);
    resizeObserver?.observe(tooltip);
    window.addEventListener("resize", updateAfterLayout);
    window.visualViewport?.addEventListener("resize", updateAfterLayout);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateAfterLayout);
      window.visualViewport?.removeEventListener("resize", updateAfterLayout);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [activeLeft, activePoint, activeTop]);

  return (
    <>
      <figure className="pace-figure" aria-describedby={descriptionId}>
        <div className={`pace-chart-shell${focused ? " is-focused" : ""}`}>
          <div className="pace-y-axis" aria-hidden="true">
            <span className="pace-y-title">words per minute</span>
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
              viewBox={`0 0 ${String(CHART_WIDTH)} ${String(CHART_HEIGHT)}`}
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
                <>
                  <path className="pace-line pace-line--burst" d={burstPath} />
                  <path className="pace-line pace-line--raw" d={rawPath} />
                  <path className="pace-line pace-line--wpm" d={wpmPath} />
                </>
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
              {points
                .filter((point) => point.errors > 0)
                .map((point) => (
                  <span
                    className="pace-error-mark"
                    key={`error-${String(point.index)}`}
                    style={{
                      left: `${String((point.x / CHART_WIDTH) * 100)}%`,
                      top: `${String((point.errorY / CHART_HEIGHT) * 100)}%`,
                    }}
                  >
                    ×
                  </span>
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
                max={String(points.length - 1)}
                step="1"
                value={safeSelectedIndex}
                aria-label="Inspect typing pace"
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

          {maximumErrors > 0 ? (
            <div className="pace-error-axis" aria-hidden="true">
              <span
                className="pace-error-tick"
                style={{ top: `${String((PLOT_TOP / CHART_HEIGHT) * 100)}%` }}
              >
                {String(maximumErrors)}
              </span>
              <span
                className="pace-error-tick"
                style={{ top: `${String((PLOT_BOTTOM / CHART_HEIGHT) * 100)}%` }}
              >
                0
              </span>
              <span className="pace-error-title">errors</span>
            </div>
          ) : null}

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
        <figcaption id={descriptionId} className="pace-legend">
          <span
            className="pace-summary"
            aria-label={`average raw pace ${String(averageRaw)} words per minute; peak burst ${String(peakBurst)} words per minute`}
          >
            avg {String(averageRaw)} · peak {String(peakBurst)}
          </span>
          <span className="pace-legend__wpm">wpm</span>
          <span className="pace-legend__raw">raw</span>
          <span className="pace-legend__burst">burst</span>
          <span className="pace-legend__errors">× errors</span>
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
              <p>{formatSeconds(activePoint.endMs)}s</p>
              <dl>
                <div>
                  <dt>wpm</dt>
                  <dd>{Math.round(activePoint.wpm)}</dd>
                </div>
                <div>
                  <dt>raw</dt>
                  <dd>{Math.round(activePoint.rawWpm)}</dd>
                </div>
                <div>
                  <dt>burst</dt>
                  <dd>{Math.round(activePoint.burst)}</dd>
                </div>
                <div>
                  <dt>errors</dt>
                  <dd>{activePoint.errors}</dd>
                </div>
              </dl>
            </div>,
            document.body,
          )}
    </>
  );
}
