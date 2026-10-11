import { create } from "zustand";
import type { SnapOptions, Viewport } from "../domain/types";

interface EditorState {
  selection: string[];
  tool: "select" | "measure" | "pan";
  measurement: string[][];
  view: Viewport;
  size: { width: number; height: number };
  snaps: SnapOptions;
  showBounds: boolean;
  fitRequest: number;
  message: string;
  set: (patch: Partial<Omit<EditorState, "set">>) => void;
  select: (id: string, multi?: boolean) => void;
  chooseMeasure: (ids: string[]) => void;
  changeTool: (tool: EditorState["tool"]) => void;
}
export const useEditor = create<EditorState>((set, get) => ({
  selection: [],
  tool: "select",
  measurement: [],
  view: { pixelsPerMm: 0.5, panX: 0, panY: 0 },
  size: { width: 1000, height: 700 },
  snaps: { edges: true, centers: true, gaps: true },
  showBounds: true,
  fitRequest: 0,
  message: "",
  set: (patch) => set(patch),
  select: (id, multi = false) =>
    set({
      selection: multi
        ? get().selection.includes(id)
          ? get().selection.filter((x) => x !== id)
          : [...get().selection, id]
        : [id],
    }),
  chooseMeasure: (ids) => {
    if (!ids.length) return;
    const measurement = get().measurement;
    if (
      measurement.length === 1 &&
      measurement[0].some((id) => ids.includes(id))
    ) {
      set({ message: "目标 B 不能与目标 A 包含相同实例" });
      return;
    }
    set({
      measurement:
        measurement.length === 1 ? [...measurement, [...ids]] : [[...ids]],
    });
  },
  changeTool: (tool) => set({ tool, measurement: [] }),
}));
