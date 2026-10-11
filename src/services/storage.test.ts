import { beforeEach, describe, expect, it, vi } from "vitest";
import { exampleLayout } from "../data/presets";
import {
  DRAFT_KEY,
  deleteLayout,
  parseDocument,
  readLayouts,
  validateDocument,
  writeDraft,
  writeLayout,
} from "./storage";
import { layoutSvg } from "./exporters";

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  });
});
describe("versioned documents", () => {
  it("round trips exact physical coordinates and model definitions", () => {
    const doc = exampleLayout();
    doc.instances[0].xMm = 123.123456789;
    const actual = parseDocument(JSON.stringify(doc));
    expect(actual).toEqual(doc);
  });
  it("saves, switches, updates and deletes local layouts", () => {
    const a = exampleLayout(),
      b = exampleLayout();
    writeLayout(a);
    writeLayout(b);
    expect(readLayouts()).toHaveLength(2);
    a.name = "updated";
    writeLayout(a);
    expect(readLayouts()).toHaveLength(2);
    expect(readLayouts().find((d) => d.id === a.id)?.name).toBe("updated");
    deleteLayout(a.id);
    expect(readLayouts().map((d) => d.id)).toEqual([b.id]);
  });
  it("flushes the draft immediately on explicit save and normalizes a transient empty name", () => {
    const doc = exampleLayout();
    writeLayout(doc);
    expect(parseDocument(localStorage.getItem(DRAFT_KEY)!).id).toBe(doc.id);
    doc.name = "";
    writeDraft(doc);
    expect(parseDocument(localStorage.getItem(DRAFT_KEY)!).name).toBe(
      "未命名方案",
    );
  });
  it.each([0, 2, "1", null])("rejects unknown schema version %s", (version) => {
    expect(() =>
      validateDocument({ ...exampleLayout(), schemaVersion: version }),
    ).toThrow("schemaVersion");
  });
  it.each([0, -1, NaN, Infinity, 10001, "500"])(
    "rejects invalid dimension %s",
    (widthMm) => {
      const doc = exampleLayout();
      (doc.specs[0] as unknown as { widthMm: unknown }).widthMm = widthMm;
      expect(() => validateDocument(doc)).toThrow("宽度");
    },
  );
  it("rejects missing references, duplicate IDs and invalid rotations", () => {
    const d = exampleLayout();
    d.instances[0].specId = "missing";
    expect(() => validateDocument(d)).toThrow("缺失");
    const d2 = exampleLayout();
    d2.instances[1].id = d2.instances[0].id;
    expect(() => validateDocument(d2)).toThrow("重复");
    const d3 = exampleLayout();
    d3.instances[0].rotation = 45 as 0;
    expect(() => validateDocument(d3)).toThrow("旋转");
    const d4 = exampleLayout();
    d4.specs.push(d4.specs[0]);
    expect(() => validateDocument(d4)).toThrow("重复");
  });
  it("rejects overrides on presets, nonfinite coordinates and invalid flags", () => {
    const d = exampleLayout();
    d.instances[0].widthMm = 500;
    expect(() => validateDocument(d)).toThrow("预设");
    delete d.instances[0].widthMm;
    d.instances[0].xMm = Infinity;
    expect(() => validateDocument(d)).toThrow("坐标");
    d.instances[0].xMm = 0;
    d.instances[0].locked = "false" as unknown as boolean;
    expect(() => validateDocument(d)).toThrow("布尔");
  });
  it("rejects malformed JSON and empty names", () => {
    expect(() => parseDocument("{")).toThrow("JSON");
    expect(() => validateDocument({ ...exampleLayout(), name: " " })).toThrow(
      "方案名称",
    );
  });
});
describe("SVG physical export", () => {
  it("uses physical viewBox and omits editor decorations", () => {
    const svg = layoutSvg(exampleLayout());
    expect(svg).toContain('width="1293.8mm"');
    expect(svg).toContain('height="778.3mm"');
    expect(svg).toContain('width="410.34" height="713.2"');
    expect(svg).not.toContain("dash");
    expect(svg).not.toContain("grid");
  });
  it("escapes imported text to prevent XML injection", () => {
    const d = exampleLayout();
    d.name = "<script>bad</script>";
    d.specs[0].name = 'A & "B"';
    const svg = layoutSvg(d);
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain("A &amp; &quot;B&quot;");
    expect(svg).not.toContain("<script>");
  });
});
