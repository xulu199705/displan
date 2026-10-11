import { describe, expect, it } from "vitest";
import { exampleLayout, presets } from "../data/presets";
import {
  boxCenter,
  boxHeight,
  boxWidth,
  diagonalDimensions,
  dimensions,
  fitViewport,
  layoutBox,
  monitorBox,
  screenToWorld,
  unionBoxes,
  worldToScreen,
  zoomAt,
} from "./geometry";
import { measureBoxes } from "./measurement";
import { snapBox, snapCandidates } from "./snapping";
import type { Box, MonitorInstance, SnapOptions } from "./types";

const instance: MonitorInstance = {
  id: "i",
  specId: presets[0].id,
  xMm: 10.25,
  yMm: -23.17,
  rotation: 0,
  locked: false,
};
const box = (x: number, y: number, w = 100, h = 50): Box => ({
  minX: x,
  maxX: x + w,
  minY: y,
  maxY: y + h,
});
const options: SnapOptions = { edges: true, centers: true, gaps: true };
describe("millimeter world geometry", () => {
  it("round trips coordinates without rounding", () => {
    const p = { x: -1234.56789, y: 4321.123456 },
      v = { pixelsPerMm: 0.237, panX: -102, panY: 304 };
    const actual = screenToWorld(worldToScreen(p, v), v);
    expect(actual.x).toBeCloseTo(p.x, 9);
    expect(actual.y).toBeCloseTo(p.y, 9);
  });
  it.each([0, 90, 180, 270] as const)(
    "rotation %s preserves the center and uses actual extents",
    (rotation) => {
      const i = { ...instance, rotation },
        d = dimensions(i, presets[0]),
        b = monitorBox(i, presets[0]);
      expect(d.width).toBeCloseTo(rotation % 180 ? 359.15 : 813.46, 8);
      expect(d.height).toBeCloseTo(rotation % 180 ? 813.46 : 359.15, 8);
      expect(boxCenter(b).x).toBeCloseTo(instance.xMm, 9);
      expect(boxCenter(b).y).toBeCloseTo(instance.yMm, 9);
    },
  );
  it("uses overrides only for custom models", () => {
    const i = { ...instance, widthMm: 42, heightMm: 17 };
    expect(dimensions(i, presets[0]).width).toBe(813.46);
    expect(dimensions(i, { ...presets[0], isCustom: true })).toEqual({
      width: 42,
      height: 17,
    });
  });
  it("unions negative coordinates and handles empty content", () => {
    expect(unionBoxes([])).toBeNull();
    expect(unionBoxes([box(-10, -20), box(200, 130)])).toEqual({
      minX: -10,
      minY: -20,
      maxX: 300,
      maxY: 180,
    });
  });
  it("zooms around a fixed pointer, with repeated cycles", () => {
    let v = { pixelsPerMm: 0.7, panX: 200, panY: -100 };
    const p = { x: 783, y: 217 },
      before = screenToWorld(p, v);
    for (let n = 0; n < 100; n++) {
      v = zoomAt(v, p, 1.1);
      v = zoomAt(v, p, 1 / 1.1);
    }
    const after = screenToWorld(p, v);
    expect(after.x).toBeCloseTo(before.x, 8);
    expect(after.y).toBeCloseTo(before.y, 8);
    expect(zoomAt(v, p, 1e6).pixelsPerMm).toBe(8);
  });
  it("fits content completely and centers it with padding", () => {
    const b = box(-200, -400, 1500, 600),
      v = fitViewport(b, 1000, 700, 80);
    const min = worldToScreen({ x: b.minX, y: b.minY }, v),
      max = worldToScreen({ x: b.maxX, y: b.maxY }, v);
    expect(min.x).toBeGreaterThanOrEqual(80 - 1e-8);
    expect(max.x).toBeLessThanOrEqual(920 + 1e-8);
    expect(min.y).toBeGreaterThanOrEqual(80);
    expect(max.y).toBeLessThanOrEqual(620);
    expect(worldToScreen(boxCenter(b), v)).toEqual({ x: 500, y: 350 });
  });
  it("fits objects far apart without being limited by manual view zoom", () => {
    const b = { minX: -10000500, minY: -200, maxX: 10000500, maxY: 200 };
    const v = fitViewport(b, 1000, 700, 80);
    const p = worldToScreen({ x: b.maxX, y: b.maxY }, v);
    expect(p.x).toBeCloseTo(920, 8);
    expect(p.y).toBeLessThan(620);
    expect(zoomAt(v, { x: 500, y: 350 }, 1.2).pixelsPerMm).toBeCloseTo(
      v.pixelsPerMm * 1.2,
      12,
    );
  });
  it("computes diagonal active area and adds symmetric bezels", () => {
    const d = diagonalDimensions(27, 16, 9, 5, 7);
    expect(Math.hypot(d.activeWidthMm, d.activeHeightMm)).toBeCloseTo(
      27 * 25.4,
      8,
    );
    expect(d.activeWidthMm / d.activeHeightMm).toBeCloseTo(16 / 9, 8);
    expect(d.widthMm - d.activeWidthMm).toBe(10);
    expect(d.heightMm - d.activeHeightMm).toBe(14);
  });
});
describe("measurement relations", () => {
  it("reports normal gap and shortest diagonal distance", () => {
    const m = measureBoxes(box(0, 0), box(103, 54));
    expect(m.x.gap).toBe(3);
    expect(m.y.gap).toBe(4);
    expect(m.shortestDistance).toBe(5);
    expect(m.relation).toBe("正常间距");
  });
  it("reports contact instead of negative spacing", () => {
    const m = measureBoxes(box(0, 0), box(100, 0));
    expect(m.x.kind).toBe("contact");
    expect(m.x.gap).toBe(0);
    expect(m.y.overlap).toBe(50);
    expect(m.shortestDistance).toBe(0);
    expect(m.relation).toBe("边缘接触");
  });
  it("reports overlapping projections separately", () => {
    const m = measureBoxes(box(0, 0), box(80, 20));
    expect(m.x.overlap).toBe(20);
    expect(m.y.overlap).toBe(30);
    expect(m.x.gap).toBe(0);
    expect(m.y.gap).toBe(0);
    expect(m.relation).toBe("部分重叠");
  });
  it("distinguishes containment and exact overlap", () => {
    expect(measureBoxes(box(0, 0), box(20, 10, 30, 20)).relation).toBe("包含");
    expect(measureBoxes(box(0, 0), box(0, 0)).relation).toBe("完全重叠");
  });
  it("keeps signed alignment deltas", () => {
    const m = measureBoxes(box(20, 50), box(10, 20));
    expect(m.dx).toBe(-10);
    expect(m.dy).toBe(-30);
    expect(m.left).toBe(-10);
    expect(m.top).toBe(-30);
    expect(m.bottom).toBe(-30);
  });
});
describe("snapping", () => {
  it("aligns edges and centers independently", () => {
    const snap = snapBox(box(2, 99), [box(0, 0)], 1, {
      edges: true,
      centers: true,
      gaps: false,
    });
    expect(snap.dx).toBe(-2);
    const center = snapBox(box(26, 99, 50), [box(0, 0)], 1, {
      edges: false,
      centers: true,
      gaps: false,
    });
    expect(center.dx).toBe(-1);
  });
  it.each([0, 5, 10, 20])("snaps adjacent gaps at %s mm", (gap) => {
    const snap = snapBox(box(100 + gap + 0.7, 0), [box(0, 0)], 1, {
      edges: false,
      centers: false,
      gaps: true,
    });
    expect(snap.dx).toBeCloseTo(-0.7, 8);
    expect(snap.guides[0].gap).toBe(gap);
  });
  it("uses an 8 CSS px threshold at every zoom", () => {
    for (const scale of [0.1, 0.5, 1, 4]) {
      const snap = snapBox(box(100 + 7 / scale, 0), [box(0, 0)], scale, {
        edges: true,
        centers: false,
        gaps: false,
      });
      expect(snap.dx).toBeCloseTo(-7 / scale, 8);
      expect(
        snapBox(box(100 + 9 / scale, 0), [box(0, 0)], scale, {
          edges: true,
          centers: false,
          gaps: false,
        }).dx,
      ).toBe(0);
    }
  });
  it("ignores irrelevant gap targets with nonoverlapping cross-axis projections", () => {
    const candidates = snapCandidates(box(110, 1000), [box(0, 0)], {
      edges: false,
      centers: false,
      gaps: true,
    });
    expect(candidates).toEqual([]);
  });
  it("can disable all snapping or restrict to one axis", () => {
    expect(
      snapBox(box(2, 2), [box(0, 0)], 1, {
        edges: false,
        centers: false,
        gaps: false,
      }).guides,
    ).toEqual([]);
    const s = snapBox(box(2, 2), [box(0, 0)], 1, options, ["x"]);
    expect(s.dy).toBe(0);
    expect(s.dx).toBe(-2);
  });
});
describe("specified Dell regression fixture", () => {
  it("matches the 1233.80 × 718.30 mm bounds including locked objects", () => {
    const doc = exampleLayout();
    doc.instances[2].locked = true;
    const b = layoutBox(doc)!;
    expect(boxWidth(b)).toBeCloseTo(1233.8, 8);
    expect(boxHeight(b)).toBeCloseTo(718.3, 8);
    const stack = layoutBox(
        doc,
        doc.instances.slice(0, 2).map((i) => i.id),
      )!,
      portrait = layoutBox(doc, [doc.instances[2].id])!;
    const m = measureBoxes(stack, portrait);
    expect(boxHeight(stack) - boxHeight(portrait)).toBeCloseTo(5.1, 8);
    expect(m.top).toBeCloseTo(2.55, 8);
    expect(m.bottom).toBeCloseTo(-2.55, 8);
    expect(m.dy).toBeCloseTo(0, 8);
    expect(m.x.gap).toBeCloseTo(10, 8);
    expect(m.y.gap).toBe(0);
  });
  it("has exactly zero stacking gap and horizontal centering", () => {
    const doc = exampleLayout(),
      m = measureBoxes(
        layoutBox(doc, [doc.instances[0].id])!,
        layoutBox(doc, [doc.instances[1].id])!,
      );
    expect(m.y.kind).toBe("contact");
    expect(m.y.gap).toBe(0);
    expect(m.dx).toBeCloseTo(0, 8);
  });
});
