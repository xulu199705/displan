export type Rotation = 0 | 90 | 180 | 270;
export interface MonitorSpec {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  activeWidthMm?: number;
  activeHeightMm?: number;
  diagonalInch?: number;
  resolution?: string;
  aspectRatio?: string;
  isCustom: boolean;
  estimated?: boolean;
}
export interface MonitorInstance {
  id: string;
  specId: string;
  xMm: number;
  yMm: number;
  rotation: Rotation;
  locked: boolean;
  widthMm?: number;
  heightMm?: number;
}
export interface LayoutDocument {
  schemaVersion: 1;
  id: string;
  name: string;
  specs: MonitorSpec[];
  instances: MonitorInstance[];
}
export interface Point {
  x: number;
  y: number;
}
export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
export interface Viewport {
  pixelsPerMm: number;
  panX: number;
  panY: number;
}
export interface SnapOptions {
  edges: boolean;
  centers: boolean;
  gaps: boolean;
}
export const DIMENSION_MIN = 0.01;
export const DIMENSION_MAX = 10000;
export const COORDINATE_MAX = 10000000;
export const validDimension = (n: number) =>
  Number.isFinite(n) && n >= DIMENSION_MIN && n <= DIMENSION_MAX;
export const validCoordinate = (n: number) =>
  Number.isFinite(n) && Math.abs(n) <= COORDINATE_MAX;
export const fmt = (n: number) => (Math.abs(n) < 0.005 ? 0 : n).toFixed(2);
export const signed = (n: number) => `${n > 0.005 ? "+" : ""}${fmt(n)}`;
export const zoomPercent = (scale: number) =>
  scale * 100 < 1
    ? (scale * 100).toPrecision(2)
    : String(Math.round(scale * 100));
