import { create } from "zustand";
import { createUuid } from "../domain/uuid";
import { blankLayout, exampleLayout } from "../data/presets";
import {
  validCoordinate,
  validDimension,
  type LayoutDocument,
  type MonitorInstance,
  type MonitorSpec,
} from "../domain/types";
import { DRAFT_KEY, parseDocument } from "../services/storage";

export let startupWarning = "";
function initial(): LayoutDocument {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return parseDocument(raw);
  } catch {
    startupWarning = "本地草稿无法读取，已打开示例；原数据未覆盖。";
  }
  return exampleLayout();
}
interface LayoutState {
  doc: LayoutDocument;
  past: LayoutDocument[];
  future: LayoutDocument[];
  dragStart: LayoutDocument | null;
  edit: (change: (draft: LayoutDocument) => void) => void;
  replace: (doc: LayoutDocument) => void;
  add: (spec: MonitorSpec, x: number, y: number) => string;
  patch: (
    ids: string[],
    patch: Partial<MonitorInstance>,
    allowLocked?: boolean,
  ) => void;
  move: (ids: string[], dx: number, dy: number) => void;
  rotate: (ids: string[]) => void;
  remove: (ids: string[]) => void;
  duplicate: (ids: string[]) => string[];
  beginDrag: () => void;
  previewMove: (positions: Map<string, { x: number; y: number }>) => void;
  endDrag: () => void;
  undo: () => void;
  redo: () => void;
}
const same = (a: LayoutDocument, b: LayoutDocument) =>
  JSON.stringify(a) === JSON.stringify(b);
export const useLayout = create<LayoutState>((set, get) => ({
  doc: initial(),
  past: [],
  future: [],
  dragStart: null,
  edit: (change) => {
    const previous = get().doc;
    const next = structuredClone(previous);
    change(next);
    if (!same(previous, next))
      set({
        doc: next,
        past: [...get().past.slice(-99), previous],
        future: [],
      });
  },
  replace: (doc) =>
    set({ doc: structuredClone(doc), past: [], future: [], dragStart: null }),
  add: (spec, x, y) => {
    const id = createUuid();
    if (!validCoordinate(x) || !validCoordinate(y)) return "";
    get().edit((d) => {
      if (!d.specs.some((s) => s.id === spec.id))
        d.specs.push(structuredClone(spec));
      d.instances.push({
        id,
        specId: spec.id,
        xMm: x,
        yMm: y,
        rotation: 0,
        locked: false,
      });
    });
    return id;
  },
  patch: (ids, patch, allowLocked = false) =>
    get().edit((d) => {
      for (const i of d.instances) {
        if (!ids.includes(i.id) || (i.locked && !allowLocked)) continue;
        if (patch.xMm !== undefined && validCoordinate(patch.xMm))
          i.xMm = patch.xMm;
        if (patch.yMm !== undefined && validCoordinate(patch.yMm))
          i.yMm = patch.yMm;
        if (patch.locked !== undefined) i.locked = patch.locked;
        if (
          patch.rotation !== undefined &&
          [0, 90, 180, 270].includes(patch.rotation)
        )
          i.rotation = patch.rotation;
        const spec = d.specs.find((s) => s.id === i.specId)!;
        if (spec.isCustom) {
          if (patch.widthMm !== undefined && validDimension(patch.widthMm))
            i.widthMm = patch.widthMm;
          if (patch.heightMm !== undefined && validDimension(patch.heightMm))
            i.heightMm = patch.heightMm;
        }
      }
    }),
  move: (ids, dx, dy) =>
    get().edit((d) => {
      const targets = d.instances.filter(
        (i) => ids.includes(i.id) && !i.locked,
      );
      if (
        !targets.every(
          (i) => validCoordinate(i.xMm + dx) && validCoordinate(i.yMm + dy),
        )
      )
        return;
      targets.forEach((i) => {
        i.xMm += dx;
        i.yMm += dy;
      });
    }),
  rotate: (ids) =>
    get().edit((d) =>
      d.instances.forEach((i) => {
        if (ids.includes(i.id) && !i.locked)
          i.rotation = ((i.rotation + 90) % 360) as MonitorInstance["rotation"];
      }),
    ),
  remove: (ids) =>
    get().edit((d) => {
      d.instances = d.instances.filter((i) => !ids.includes(i.id) || i.locked);
    }),
  duplicate: (ids) => {
    const copies = get()
      .doc.instances.filter((i) => ids.includes(i.id))
      .map((i) => ({
        ...i,
        id: createUuid(),
        locked: false,
        xMm: i.xMm + 20,
        yMm: i.yMm + 20,
      }))
      .filter((i) => validCoordinate(i.xMm) && validCoordinate(i.yMm));
    get().edit((d) => {
      d.instances.push(...copies);
    });
    return copies.map((i) => i.id);
  },
  beginDrag: () => set({ dragStart: structuredClone(get().doc) }),
  previewMove: (positions) => {
    const doc = structuredClone(get().doc);
    for (const i of doc.instances) {
      const p = positions.get(i.id);
      if (p && !i.locked && validCoordinate(p.x) && validCoordinate(p.y)) {
        i.xMm = p.x;
        i.yMm = p.y;
      }
    }
    set({ doc });
  },
  endDrag: () => {
    const { dragStart, doc, past } = get();
    if (dragStart && !same(dragStart, doc))
      set({
        past: [...past.slice(-99), dragStart],
        future: [],
        dragStart: null,
      });
    else set({ dragStart: null });
  },
  undo: () => {
    const { past, doc, future } = get();
    if (past.length)
      set({
        doc: past[past.length - 1],
        past: past.slice(0, -1),
        future: [doc, ...future],
        dragStart: null,
      });
  },
  redo: () => {
    const { past, doc, future } = get();
    if (future.length)
      set({
        doc: future[0],
        past: [...past, doc],
        future: future.slice(1),
        dragStart: null,
      });
  },
}));
export const newLayout = () => useLayout.getState().replace(blankLayout());
