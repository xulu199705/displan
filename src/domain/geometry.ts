import type {
  Box,
  LayoutDocument,
  MonitorInstance,
  MonitorSpec,
  Point,
  Viewport,
} from "./types";

export function worldToScreen(p: Point, view: Viewport): Point {
  return {
    x: p.x * view.pixelsPerMm + view.panX,
    y: p.y * view.pixelsPerMm + view.panY,
  };
}
export function screenToWorld(p: Point, view: Viewport): Point {
  return {
    x: (p.x - view.panX) / view.pixelsPerMm,
    y: (p.y - view.panY) / view.pixelsPerMm,
  };
}
export function dimensions(instance: MonitorInstance, spec: MonitorSpec) {
  const width = spec.isCustom
    ? (instance.widthMm ?? spec.widthMm)
    : spec.widthMm;
  const height = spec.isCustom
    ? (instance.heightMm ?? spec.heightMm)
    : spec.heightMm;
  return instance.rotation % 180 === 0
    ? { width, height }
    : { width: height, height: width };
}
export function monitorBox(instance: MonitorInstance, spec: MonitorSpec): Box {
  const { width, height } = dimensions(instance, spec);
  return {
    minX: instance.xMm - width / 2,
    maxX: instance.xMm + width / 2,
    minY: instance.yMm - height / 2,
    maxY: instance.yMm + height / 2,
  };
}
export function unionBoxes(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  return boxes.reduce((a, b) => ({
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }));
}
export const boxWidth = (b: Box) => b.maxX - b.minX;
export const boxHeight = (b: Box) => b.maxY - b.minY;
export const boxCenter = (b: Box): Point => ({
  x: (b.minX + b.maxX) / 2,
  y: (b.minY + b.maxY) / 2,
});
export function layoutBoxes(doc: LayoutDocument, ids?: string[]): Box[] {
  const specs = new Map(doc.specs.map((s) => [s.id, s]));
  return doc.instances
    .filter((i) => !ids || ids.includes(i.id))
    .map((i) => monitorBox(i, specs.get(i.specId)!));
}
export function layoutBox(doc: LayoutDocument, ids?: string[]): Box | null {
  return unionBoxes(layoutBoxes(doc, ids));
}
export function zoomAt(
  view: Viewport,
  pointer: Point,
  factor: number,
): Viewport {
  const world = screenToWorld(pointer, view);
  const pixelsPerMm = Math.min(8, Math.max(1e-8, view.pixelsPerMm * factor));
  return {
    pixelsPerMm,
    panX: pointer.x - world.x * pixelsPerMm,
    panY: pointer.y - world.y * pixelsPerMm,
  };
}
export function fitViewport(
  box: Box | null,
  width: number,
  height: number,
  padding = 90,
): Viewport {
  if (!box) return { pixelsPerMm: 0.5, panX: width / 2, panY: height / 2 };
  const pixelsPerMm = Math.min(
    8,
    Math.max(
      1e-8,
      Math.min(
        Math.max(1, width - 2 * padding) / boxWidth(box),
        Math.max(1, height - 2 * padding) / boxHeight(box),
      ),
    ),
  );
  const center = boxCenter(box);
  return {
    pixelsPerMm,
    panX: width / 2 - center.x * pixelsPerMm,
    panY: height / 2 - center.y * pixelsPerMm,
  };
}
export function diagonalDimensions(
  diagonalInch: number,
  ratioX: number,
  ratioY: number,
  bezelX = 0,
  bezelY = 0,
) {
  const diagonalMm = diagonalInch * 25.4;
  const norm = Math.hypot(ratioX, ratioY);
  const activeWidthMm = (diagonalMm * ratioX) / norm;
  const activeHeightMm = (diagonalMm * ratioY) / norm;
  return {
    activeWidthMm,
    activeHeightMm,
    widthMm: activeWidthMm + 2 * bezelX,
    heightMm: activeHeightMm + 2 * bezelY,
  };
}
