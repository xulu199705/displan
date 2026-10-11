import { boxCenter } from "./geometry";
import type { Box } from "./types";

const EPS = 1e-8;
export function axisRelation(
  aMin: number,
  aMax: number,
  bMin: number,
  bMax: number,
) {
  const overlap = Math.min(aMax, bMax) - Math.max(aMin, bMin);
  return {
    gap: Math.max(0, -overlap),
    overlap: Math.max(0, overlap),
    kind:
      overlap > EPS
        ? ("overlap" as const)
        : overlap < -EPS
          ? ("gap" as const)
          : ("contact" as const),
  };
}
export function measureBoxes(a: Box, b: Box) {
  const x = axisRelation(a.minX, a.maxX, b.minX, b.maxX);
  const y = axisRelation(a.minY, a.maxY, b.minY, b.maxY);
  const ac = boxCenter(a),
    bc = boxCenter(b);
  const contains = (outer: Box, inner: Box) =>
    outer.minX <= inner.minX + EPS &&
    outer.maxX >= inner.maxX - EPS &&
    outer.minY <= inner.minY + EPS &&
    outer.maxY >= inner.maxY - EPS;
  const equal = contains(a, b) && contains(b, a);
  const relation = equal
    ? "完全重叠"
    : contains(a, b) || contains(b, a)
      ? "包含"
      : x.kind === "overlap" && y.kind === "overlap"
        ? "部分重叠"
        : x.gap < EPS && y.gap < EPS
          ? "边缘接触"
          : "正常间距";
  return {
    x,
    y,
    relation,
    dx: bc.x - ac.x,
    dy: bc.y - ac.y,
    centerDistance: Math.hypot(bc.x - ac.x, bc.y - ac.y),
    shortestDistance: Math.hypot(x.gap, y.gap),
    top: b.minY - a.minY,
    bottom: b.maxY - a.maxY,
    left: b.minX - a.minX,
    right: b.maxX - a.maxX,
  };
}
