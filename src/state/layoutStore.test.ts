import { beforeEach, describe, expect, it } from "vitest";
import { blankLayout, presets } from "../data/presets";
import { useLayout } from "./layoutStore";

beforeEach(() => useLayout.getState().replace(blankLayout()));
describe("layout transactions and history", () => {
  it("adds repeatable instances without changing the prototype", () => {
    const s = useLayout.getState();
    const a = s.add(presets[0], 0, 0),
      b = s.add(presets[0], 0, 0);
    expect(a).not.toBe(b);
    expect(useLayout.getState().doc.instances).toHaveLength(2);
    expect(useLayout.getState().doc.specs).toHaveLength(3);
    expect(presets[0].widthMm).toBe(813.46);
  });
  it("stores an entire drag as exactly one undo step", () => {
    const s = useLayout.getState(),
      id = s.add(presets[0], 1.23, 4.56);
    s.beginDrag();
    for (let n = 0; n < 100; n++)
      s.previewMove(new Map([[id, { x: n / 3, y: n / 7 }]]));
    expect(useLayout.getState().past).toHaveLength(1);
    s.endDrag();
    expect(useLayout.getState().past).toHaveLength(2);
    s.undo();
    expect(useLayout.getState().doc.instances[0].xMm).toBe(1.23);
    expect(useLayout.getState().doc.instances[0].yMm).toBe(4.56);
    s.redo();
    expect(useLayout.getState().doc.instances[0].xMm).toBe(33);
  });
  it("does not record a click without a move", () => {
    const s = useLayout.getState();
    s.add(presets[0], 0, 0);
    s.beginDrag();
    s.endDrag();
    expect(useLayout.getState().past).toHaveLength(1);
  });
  it("covers coordinate edits, rotations, duplicates and deletes", () => {
    const s = useLayout.getState(),
      id = s.add(presets[0], 0, 0);
    s.patch([id], { xMm: 123.456789 });
    s.rotate([id]);
    const ids = s.duplicate([id]);
    expect(useLayout.getState().doc.instances[1].rotation).toBe(90);
    s.remove(ids);
    expect(useLayout.getState().doc.instances).toHaveLength(1);
    s.undo();
    expect(useLayout.getState().doc.instances).toHaveLength(2);
    s.undo();
    s.undo();
    expect(useLayout.getState().doc.instances[0].rotation).toBe(0);
    s.undo();
    expect(useLayout.getState().doc.instances[0].xMm).toBe(0);
    s.redo();
    expect(useLayout.getState().doc.instances[0].xMm).toBe(123.456789);
  });
  it("protects locked objects and preset sizes", () => {
    const s = useLayout.getState(),
      id = s.add(presets[0], 0, 0);
    s.patch([id], { widthMm: 2, heightMm: 3 });
    expect(useLayout.getState().doc.instances[0].widthMm).toBeUndefined();
    s.patch([id], { locked: true }, true);
    s.move([id], 10, 20);
    s.rotate([id]);
    s.remove([id]);
    expect(useLayout.getState().doc.instances[0]).toMatchObject({
      xMm: 0,
      yMm: 0,
      rotation: 0,
      locked: true,
    });
    s.patch([id], { locked: false }, true);
    s.move([id], 1, 2);
    expect(useLayout.getState().doc.instances[0].xMm).toBe(1);
  });
  it("allows custom instance overrides with undo", () => {
    const s = useLayout.getState(),
      spec = { ...presets[0], id: "custom", isCustom: true },
      id = s.add(spec, 0, 0);
    s.patch([id], { widthMm: 500.1234, heightMm: 200.9876 });
    expect(useLayout.getState().doc.instances[0].widthMm).toBe(500.1234);
    expect(useLayout.getState().doc.specs.at(-1)?.widthMm).toBe(813.46);
    s.undo();
    expect(useLayout.getState().doc.instances[0].widthMm).toBeUndefined();
  });
  it("clears redo on a divergent edit and limits history", () => {
    const s = useLayout.getState(),
      id = s.add(presets[0], 0, 0);
    s.move([id], 1, 0);
    s.undo();
    s.rotate([id]);
    expect(useLayout.getState().future).toHaveLength(0);
    for (let n = 0; n < 120; n++) s.move([id], 1, 0);
    expect(useLayout.getState().past).toHaveLength(100);
  });
  it("rejects invalid numerical edits atomically for group movement", () => {
    const s = useLayout.getState(),
      a = s.add(presets[0], 1e7, 0),
      b = s.add(presets[1], 0, 0);
    s.move([a, b], 1, 0);
    expect(useLayout.getState().doc.instances[1].xMm).toBe(0);
    s.patch([a], { xMm: Infinity, yMm: NaN });
    expect(useLayout.getState().doc.instances[0].xMm).toBe(1e7);
  });
});
