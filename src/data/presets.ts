import type { LayoutDocument, MonitorSpec } from "../domain/types";

export const presets: MonitorSpec[] = [
  {
    id: "dell-u3425we",
    name: "Dell U3425WE",
    widthMm: 813.46,
    heightMm: 359.15,
    diagonalInch: 34,
    aspectRatio: "21:9",
    resolution: "3440 × 1440",
    isCustom: false,
  },
  {
    id: "dell-u3225qe",
    name: "Dell U3225QE",
    widthMm: 713.2,
    heightMm: 410.34,
    diagonalInch: 31.5,
    aspectRatio: "16:9",
    resolution: "3840 × 2160",
    isCustom: false,
  },
  {
    id: "dell-u4025qw",
    name: "Dell U4025QW",
    widthMm: 946.62,
    heightMm: 419.14,
    diagonalInch: 39.7,
    aspectRatio: "21:9",
    resolution: "5120 × 2160",
    isCustom: false,
  },
];
export function blankLayout(): LayoutDocument {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: "未命名方案",
    specs: structuredClone(presets),
    instances: [],
  };
}
export function exampleLayout(): LayoutDocument {
  return {
    ...blankLayout(),
    name: "Dell Dual U3425WE + Portrait U3225QE",
    instances: [
      {
        id: crypto.randomUUID(),
        specId: presets[0].id,
        xMm: 420.34 + 813.46 / 2,
        yMm: 359.15 / 2,
        rotation: 0,
        locked: false,
      },
      {
        id: crypto.randomUUID(),
        specId: presets[0].id,
        xMm: 420.34 + 813.46 / 2,
        yMm: 359.15 * 1.5,
        rotation: 0,
        locked: false,
      },
      {
        id: crypto.randomUUID(),
        specId: presets[1].id,
        xMm: 410.34 / 2,
        yMm: 718.3 / 2,
        rotation: 90,
        locked: false,
      },
    ],
  };
}
