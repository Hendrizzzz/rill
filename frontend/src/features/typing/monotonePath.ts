interface ChartCoordinate {
  x: number;
  y: number;
}

function endpointTangent(
  firstInterval: number,
  secondInterval: number,
  firstSlope: number,
  secondSlope: number,
): number {
  const tangent =
    ((2 * firstInterval + secondInterval) * firstSlope -
      firstInterval * secondSlope) /
    (firstInterval + secondInterval);
  if (Math.sign(tangent) !== Math.sign(firstSlope)) {
    return 0;
  }
  if (
    Math.sign(firstSlope) !== Math.sign(secondSlope) &&
    Math.abs(tangent) > Math.abs(3 * firstSlope)
  ) {
    return 3 * firstSlope;
  }
  return tangent;
}

function pathNumber(value: number): string {
  return value.toFixed(2);
}

export function buildMonotonePath(
  points: readonly ChartCoordinate[],
): string {
  if (
    points.length === 0 ||
    points.some(
      (point) => !Number.isFinite(point.x) || !Number.isFinite(point.y),
    )
  ) {
    return "";
  }

  const move = `M ${pathNumber(points[0]?.x ?? 0)} ${pathNumber(points[0]?.y ?? 0)}`;
  if (points.length === 1) {
    return move;
  }

  const intervals = points.slice(0, -1).map((point, index) => {
    const next = points[index + 1];
    return (next?.x ?? point.x) - point.x;
  });
  if (intervals.some((interval) => interval <= 0)) {
    return [
      move,
      ...points.slice(1).map(
        (point) => `L ${pathNumber(point.x)} ${pathNumber(point.y)}`,
      ),
    ].join(" ");
  }

  const slopes = intervals.map((interval, index) => {
    const point = points[index];
    const next = points[index + 1];
    return ((next?.y ?? 0) - (point?.y ?? 0)) / interval;
  });
  const tangents = Array.from({ length: points.length }, () => 0);

  if (points.length === 2) {
    tangents[0] = slopes[0] ?? 0;
    tangents[1] = slopes[0] ?? 0;
  } else {
    tangents[0] = endpointTangent(
      intervals[0] ?? 1,
      intervals[1] ?? 1,
      slopes[0] ?? 0,
      slopes[1] ?? 0,
    );
    const lastPointIndex = points.length - 1;
    tangents[lastPointIndex] = endpointTangent(
      intervals[lastPointIndex - 1] ?? 1,
      intervals[lastPointIndex - 2] ?? 1,
      slopes[lastPointIndex - 1] ?? 0,
      slopes[lastPointIndex - 2] ?? 0,
    );

    for (let index = 1; index < lastPointIndex; index += 1) {
      const previousSlope = slopes[index - 1] ?? 0;
      const nextSlope = slopes[index] ?? 0;
      if (
        previousSlope === 0 ||
        nextSlope === 0 ||
        Math.sign(previousSlope) !== Math.sign(nextSlope)
      ) {
        tangents[index] = 0;
        continue;
      }
      const previousInterval = intervals[index - 1] ?? 1;
      const nextInterval = intervals[index] ?? 1;
      const firstWeight = 2 * nextInterval + previousInterval;
      const secondWeight = nextInterval + 2 * previousInterval;
      tangents[index] =
        (firstWeight + secondWeight) /
        (firstWeight / previousSlope + secondWeight / nextSlope);
    }
  }

  const commands = intervals.map((interval, index) => {
    const point = points[index] ?? { x: 0, y: 0 };
    const next = points[index + 1] ?? point;
    const firstControl = {
      x: point.x + interval / 3,
      y: point.y + ((tangents[index] ?? 0) * interval) / 3,
    };
    const secondControl = {
      x: next.x - interval / 3,
      y:
        next.y -
        ((tangents[index + 1] ?? 0) * interval) / 3,
    };
    return [
      "C",
      pathNumber(firstControl.x),
      pathNumber(firstControl.y),
      pathNumber(secondControl.x),
      pathNumber(secondControl.y),
      pathNumber(next.x),
      pathNumber(next.y),
    ].join(" ");
  });

  return [move, ...commands].join(" ");
}
