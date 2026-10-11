import { Arrow, Group, Line, Rect, Text } from "react-konva";
import { boxCenter, boxHeight, boxWidth } from "../domain/geometry";
import { measureBoxes } from "../domain/measurement";
import { fmt, type Box } from "../domain/types";
import type { SnapCandidate } from "../domain/snapping";

export function BoundingBoxOverlay({
  box,
  scale,
}: {
  box: Box;
  scale: number;
}) {
  const s = 1 / scale;
  return (
    <Group listening={false}>
      <Rect
        x={box.minX}
        y={box.minY}
        width={boxWidth(box)}
        height={boxHeight(box)}
        stroke="#7c91a9"
        strokeWidth={s}
        dash={[6 * s, 5 * s]}
      />
      <Text
        x={box.minX}
        y={box.minY - 28 * s}
        width={boxWidth(box)}
        text={`${fmt(boxWidth(box))} × ${fmt(boxHeight(box))} mm`}
        align="center"
        fontSize={12 * s}
        fill="#5e718a"
      />
      <Text
        x={box.maxX + 12 * s}
        y={(box.minY + box.maxY) / 2}
        text={`${fmt(boxHeight(box))} mm`}
        rotation={90}
        offsetX={40 * s}
        fontSize={11 * s}
        fill="#5e718a"
      />
    </Group>
  );
}
export function SnapGuides({
  guides,
  scale,
}: {
  guides: SnapCandidate[];
  scale: number;
}) {
  const s = 1 / scale;
  return (
    <Group listening={false}>
      {guides.map((g, idx) => (
        <Group key={idx}>
          <Line
            points={
              g.axis === "x"
                ? [g.value, g.from - 25 * s, g.value, g.to + 25 * s]
                : [g.from - 25 * s, g.value, g.to + 25 * s, g.value]
            }
            stroke="#3b82f6"
            strokeWidth={s}
            dash={[4 * s, 3 * s]}
          />
          <Text
            x={g.axis === "x" ? g.value + 6 * s : g.to + 10 * s}
            y={g.axis === "x" ? g.from - 22 * s : g.value + 6 * s}
            fontSize={11 * s}
            text={
              g.kind === "gap"
                ? `${g.gap} mm`
                : g.kind === "center"
                  ? "中心"
                  : "边缘"
            }
            fill="#2563eb"
          />
        </Group>
      ))}
    </Group>
  );
}
export function MeasurementOverlay({
  a,
  b,
  scale,
}: {
  a: Box;
  b?: Box | null;
  scale: number;
}) {
  const s = 1 / scale,
    ac = boxCenter(a),
    bc = b ? boxCenter(b) : null;
  const m = b ? measureBoxes(a, b) : null;
  const rect = (box: Box, label: string, color: string) => (
    <Group key={label}>
      <Rect
        x={box.minX}
        y={box.minY}
        width={boxWidth(box)}
        height={boxHeight(box)}
        stroke={color}
        strokeWidth={2 * s}
        dash={[6 * s, 4 * s]}
      />
      <Text
        x={box.minX}
        y={box.minY - 18 * s}
        text={label}
        fontSize={12 * s}
        fontStyle="bold"
        fill={color}
      />
    </Group>
  );
  let x0 = 0,
    x1 = 0,
    y0 = 0,
    y1 = 0,
    lineY = 0,
    lineX = 0;
  if (b && m) {
    [x0, x1] =
      m.x.kind === "gap"
        ? a.maxX < b.minX
          ? [a.maxX, b.minX]
          : [b.maxX, a.minX]
        : [Math.max(a.minX, b.minX), Math.min(a.maxX, b.maxX)];
    [y0, y1] =
      m.y.kind === "gap"
        ? a.maxY < b.minY
          ? [a.maxY, b.minY]
          : [b.maxY, a.minY]
        : [Math.max(a.minY, b.minY), Math.min(a.maxY, b.maxY)];
    lineY = Math.min(a.minY, b.minY) - 52 * s;
    lineX = Math.max(a.maxX, b.maxX) + 52 * s;
  }
  return (
    <Group listening={false}>
      {rect(a, "A", "#2563eb")}
      {b && rect(b, "B", "#0d9488")}
      {b && bc && m && (
        <>
          <Line
            points={[ac.x, ac.y, bc.x, bc.y]}
            stroke="#2563eb"
            opacity={0.6}
            dash={[5 * s, 5 * s]}
            strokeWidth={s}
          />
          <Line
            points={[x0, lineY + 8 * s, x0, Math.min(a.minY, b.minY) - 6 * s]}
            stroke="#93b4ed"
            strokeWidth={s}
          />
          <Line
            points={[x1, lineY + 8 * s, x1, Math.min(a.minY, b.minY) - 6 * s]}
            stroke="#93b4ed"
            strokeWidth={s}
          />
          <Arrow
            points={[x0, lineY, x1, lineY]}
            pointerAtBeginning
            pointerLength={5 * s}
            pointerWidth={5 * s}
            stroke="#2563eb"
            fill="#2563eb"
            strokeWidth={s}
          />
          <Text
            x={(x0 + x1) / 2 - 100 * s}
            y={lineY - 20 * s}
            width={200 * s}
            align="center"
            text={`X ${m.x.kind === "overlap" ? "重叠" : m.x.kind === "contact" ? "接触" : "间距"} ${fmt(m.x.kind === "overlap" ? m.x.overlap : m.x.gap)} mm`}
            fontSize={12 * s}
            fill="#2563eb"
          />
          <Line
            points={[Math.max(a.maxX, b.maxX) + 6 * s, y0, lineX - 8 * s, y0]}
            stroke="#93b4ed"
            strokeWidth={s}
          />
          <Line
            points={[Math.max(a.maxX, b.maxX) + 6 * s, y1, lineX - 8 * s, y1]}
            stroke="#93b4ed"
            strokeWidth={s}
          />
          <Arrow
            points={[lineX, y0, lineX, y1]}
            pointerAtBeginning
            pointerLength={5 * s}
            pointerWidth={5 * s}
            stroke="#2563eb"
            fill="#2563eb"
            strokeWidth={s}
          />
          <Text
            x={lineX + 12 * s}
            y={(y0 + y1) / 2 - 90 * s}
            width={180 * s}
            rotation={90}
            text={`Y ${m.y.kind === "overlap" ? "重叠" : m.y.kind === "contact" ? "接触" : "间距"} ${fmt(m.y.kind === "overlap" ? m.y.overlap : m.y.gap)} mm`}
            fontSize={12 * s}
            fill="#2563eb"
          />
        </>
      )}
    </Group>
  );
}
