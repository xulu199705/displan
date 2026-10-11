import {
  COORDINATE_MAX,
  validCoordinate,
  validDimension,
  type LayoutDocument,
  type MonitorSpec,
} from "../domain/types";

export const STORAGE_KEY = "displan.layouts.v1";
export const DRAFT_KEY = "displan.draft.v1";
export const CUSTOM_KEY = "displan.custom.v1";
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("需要有效的 JSON 对象");
  return value as Record<string, unknown>;
}
function string(value: unknown, label: string, max = 200): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error(`${label}必须为 1–${max} 个字符`);
  return value;
}
function number(
  value: unknown,
  label: string,
  validator: (n: number) => boolean,
): number {
  if (typeof value !== "number" || !validator(value))
    throw new Error(`${label}无效或超出允许范围`);
  return value;
}
function optionalNumber(
  o: Record<string, unknown>,
  key: string,
  validator = validDimension,
): number | undefined {
  return o[key] === undefined ? undefined : number(o[key], key, validator);
}
function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label}必须是布尔值`);
  return value;
}
export function validateSpec(value: unknown): MonitorSpec {
  const s = object(value);
  return {
    id: string(s.id, "型号 ID"),
    name: string(s.name, "型号名称"),
    widthMm: number(s.widthMm, "宽度 (0.01–10000 mm)", validDimension),
    heightMm: number(s.heightMm, "高度 (0.01–10000 mm)", validDimension),
    isCustom: boolean(s.isCustom, "isCustom"),
    activeWidthMm: optionalNumber(s, "activeWidthMm"),
    activeHeightMm: optionalNumber(s, "activeHeightMm"),
    diagonalInch: optionalNumber(
      s,
      "diagonalInch",
      (n) => Number.isFinite(n) && n > 0 && n <= 500,
    ),
    estimated:
      s.estimated === undefined ? undefined : boolean(s.estimated, "estimated"),
    resolution:
      s.resolution === undefined ? undefined : string(s.resolution, "分辨率"),
    aspectRatio:
      s.aspectRatio === undefined ? undefined : string(s.aspectRatio, "宽高比"),
  };
}
export function validateDocument(value: unknown): LayoutDocument {
  const d = object(value);
  if (d.schemaVersion !== 1)
    throw new Error("不支持此 schemaVersion，仅支持版本 1");
  if (
    !Array.isArray(d.specs) ||
    !Array.isArray(d.instances) ||
    d.specs.length > 10000 ||
    d.instances.length > 10000
  )
    throw new Error("型号或实例列表无效（最多 10000 项）");
  const specs = d.specs.map(validateSpec);
  const specMap = new Map(specs.map((s) => [s.id, s]));
  if (specMap.size !== specs.length) throw new Error("型号 ID 重复");
  const instances = d.instances.map((value) => {
    const i = object(value);
    const specId = string(i.specId, "关联型号 ID");
    const spec = specMap.get(specId);
    if (!spec) throw new Error("实例引用了缺失的型号");
    if (![0, 90, 180, 270].includes(i.rotation as number))
      throw new Error("旋转角度必须是 0 / 90 / 180 / 270");
    if (!spec.isCustom && (i.widthMm !== undefined || i.heightMm !== undefined))
      throw new Error("预设型号不允许尺寸覆盖");
    return {
      id: string(i.id, "实例 ID"),
      specId,
      xMm: number(i.xMm, `X 坐标 (±${COORDINATE_MAX} mm)`, validCoordinate),
      yMm: number(i.yMm, "Y 坐标", validCoordinate),
      rotation: i.rotation as 0 | 90 | 180 | 270,
      locked: boolean(i.locked, "locked"),
      widthMm: optionalNumber(i, "widthMm"),
      heightMm: optionalNumber(i, "heightMm"),
    };
  });
  if (new Set(instances.map((i) => i.id)).size !== instances.length)
    throw new Error("实例 ID 重复");
  return {
    schemaVersion: 1,
    id: string(d.id, "方案 ID"),
    name: string(d.name, "方案名称"),
    specs,
    instances,
  };
}
export function parseDocument(text: string): LayoutDocument {
  if (text.length > 10 * 1024 * 1024) throw new Error("文件超过 10 MB");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("文件不是合法的 JSON");
  }
  return validateDocument(parsed);
}
export function readLayouts(): LayoutDocument[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("本地方案列表损坏");
  return parsed.map(validateDocument);
}
export function writeLayout(doc: LayoutDocument) {
  const layouts = readLayouts();
  const index = layouts.findIndex((d) => d.id === doc.id);
  if (index >= 0) layouts[index] = doc;
  else layouts.unshift(doc);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
  writeDraft(doc);
}
export function writeDraft(doc: LayoutDocument) {
  localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({ ...doc, name: doc.name.trim() ? doc.name : "未命名方案" }),
  );
}
export function deleteLayout(id: string) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(readLayouts().filter((d) => d.id !== id)),
  );
}
