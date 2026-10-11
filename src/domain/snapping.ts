import { boxCenter } from "./geometry";
import type { Box, SnapOptions } from "./types";

export interface SnapCandidate {
  axis: "x" | "y";
  delta: number;
  value: number;
  from: number;
  to: number;
  kind: "edge" | "center" | "gap";
  gap?: number;
}
export function snapCandidates(
  moving: Box,
  others: Box[],
  options: SnapOptions,
): SnapCandidate[] {
  const result: SnapCandidate[] = [];
  for (const other of others) {
    const mc = boxCenter(moving),
      oc = boxCenter(other);
    for (const axis of ["x", "y"] as const) {
      const isX = axis === "x";
      const [m0, m1, o0, o1] = isX
        ? [moving.minX, moving.maxX, other.minX, other.maxX]
        : [moving.minY, moving.maxY, other.minY, other.maxY];
      const [crossM0, crossM1, crossO0, crossO1] = isX
        ? [moving.minY, moving.maxY, other.minY, other.maxY]
        : [moving.minX, moving.maxX, other.minX, other.maxX];
      const add = (
        source: number,
        target: number,
        kind: SnapCandidate["kind"],
        gap?: number,
      ) =>
        result.push({
          axis,
          delta: target - source,
          value: target,
          from: Math.min(crossM0, crossO0),
          to: Math.max(crossM1, crossO1),
          kind,
          gap,
        });
      if (options.edges) {
        add(m0, o0, "edge");
        add(m1, o1, "edge");
        if (Math.min(crossM1, crossO1) >= Math.max(crossM0, crossO0)) {
          add(m0, o1, "edge", 0);
          add(m1, o0, "edge", 0);
        }
      }
      if (options.centers) add(isX ? mc.x : mc.y, isX ? oc.x : oc.y, "center");
      if (
        options.gaps &&
        Math.min(crossM1, crossO1) > Math.max(crossM0, crossO0)
      ) {
        for (const gap of [0, 5, 10, 20]) {
          add(m0, o1 + gap, "gap", gap);
          add(m1, o0 - gap, "gap", gap);
        }
      }
    }
  }
  return result;
}
export function snapBox(
  moving: Box,
  others: Box[],
  pixelsPerMm: number,
  options: SnapOptions,
  allowedAxes: ("x" | "y")[] = ["x", "y"],
) {
  const threshold = 8 / pixelsPerMm;
  const candidates = snapCandidates(moving, others, options);
  const guides: SnapCandidate[] = [];
  for (const axis of allowedAxes) {
    const candidate = candidates
      .filter((c) => c.axis === axis && Math.abs(c.delta) <= threshold)
      .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
    if (candidate) guides.push(candidate);
  }
  return {
    dx: guides.find((g) => g.axis === "x")?.delta ?? 0,
    dy: guides.find((g) => g.axis === "y")?.delta ?? 0,
    guides,
  };
}
