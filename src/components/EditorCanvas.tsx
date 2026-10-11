import { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Group, Rect, Text, Line } from "react-konva";
import type Konva from "konva";
import {
  LocateFixed,
  Minus,
  MousePointer2,
  Plus,
  Hand,
  Ruler,
  PanelLeftOpen,
} from "lucide-react";
import {
  boxHeight,
  boxWidth,
  dimensions,
  fitViewport,
  layoutBox,
  layoutBoxes,
  screenToWorld,
  worldToScreen,
  zoomAt,
} from "../domain/geometry";
import { snapBox, type SnapCandidate } from "../domain/snapping";
import {
  fmt,
  validCoordinate,
  zoomPercent,
  type LayoutDocument,
  type Point,
  type Viewport,
} from "../domain/types";
import { validateSpec } from "../services/storage";
import { useLayout } from "../state/layoutStore";
import { useEditor } from "../state/editorStore";
import { IconButton } from "./Controls";
import {
  BoundingBoxOverlay,
  MeasurementOverlay,
  SnapGuides,
} from "./CanvasOverlays";
import { MonitorProperties } from "./MonitorProperties";
import { MeasurementPanel } from "./MeasurementPanel";

interface DragSession {
  type: "move" | "pan";
  screenStart: Point;
  view: Viewport;
  original: LayoutDocument;
  ids: string[];
  anchor?: string;
  measureClick?: boolean;
  deselectOnClick?: boolean;
  moved: boolean;
}
export function EditorCanvas({
  collapsed,
  onExpand,
}: {
  collapsed: boolean;
  onExpand: () => void;
}) {
  const wrapper = useRef<HTMLDivElement>(null),
    drag = useRef<DragSession | null>(null),
    space = useRef(false);
  const [spacePressed, setSpacePressed] = useState(false),
    [guides, setGuides] = useState<SnapCandidate[]>([]),
    [pointer, setPointer] = useState<Point | null>(null);
  const doc = useLayout((s) => s.doc);
  const { view, size, selection, tool, showBounds, measurement, fitRequest } =
    useEditor();
  const bounds = layoutBox(doc);
  const a = measurement[0] ? layoutBox(doc, measurement[0]) : null,
    b = measurement[1] ? layoutBox(doc, measurement[1]) : null;
  const fit = useCallback(() => {
    const { size } = useEditor.getState();
    useEditor.getState().set({
      view: fitViewport(
        layoutBox(useLayout.getState().doc),
        size.width,
        size.height,
      ),
    });
  }, []);
  useEffect(() => {
    const el = wrapper.current!;
    let initialized = false;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const prev = useEditor.getState();
      useEditor.getState().set({
        size: { width, height },
        view: {
          ...prev.view,
          panX: prev.view.panX + (width - prev.size.width) / 2,
          panY: prev.view.panY + (height - prev.size.height) / 2,
        },
      });
      if (!initialized) {
        fit();
        initialized = true;
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit]);
  useEffect(() => {
    fit();
  }, [fitRequest, fit]);
  useEffect(() => {
    const ids = new Set(doc.instances.map((i) => i.id)),
      ed = useEditor.getState();
    const validSelection = ed.selection.filter((id) => ids.has(id));
    const validMeasurement = ed.measurement.every((group) =>
      group.every((id) => ids.has(id)),
    )
      ? ed.measurement
      : [];
    if (
      validSelection.length !== ed.selection.length ||
      validMeasurement.length !== ed.measurement.length
    )
      ed.set({ selection: validSelection, measurement: validMeasurement });
  }, [doc]);
  useEffect(() => {
    const element = wrapper.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const ed = useEditor.getState();
      const rect = element.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey)
        ed.set({
          view: zoomAt(
            ed.view,
            { x: e.clientX - rect.left, y: e.clientY - rect.top },
            Math.exp(-e.deltaY * 0.002),
          ),
        });
      else
        ed.set({
          view: {
            ...ed.view,
            panX: ed.view.panX - e.deltaX,
            panY: ed.view.panY - e.deltaY,
          },
        });
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);
  const endDrag = useCallback(() => {
    const session = drag.current;
    if (!session) return;
    if (session.type === "move") {
      useLayout.getState().endDrag();
      if (!session.moved && session.deselectOnClick && session.anchor)
        useEditor.getState().select(session.anchor, true);
      if (
        !session.moved &&
        session.measureClick &&
        useEditor.getState().tool === "measure" &&
        session.anchor
      )
        useEditor.getState().chooseMeasure([session.anchor]);
    }
    drag.current = null;
    setGuides([]);
  }, []);
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const session = drag.current;
      if (!session) return;
      const rect = wrapper.current!.getBoundingClientRect();
      const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const sx = screen.x - session.screenStart.x,
        sy = screen.y - session.screenStart.y;
      if (Math.hypot(sx, sy) > 2) session.moved = true;
      if (session.type === "pan") {
        useEditor.getState().set({
          view: {
            ...session.view,
            panX: session.view.panX + sx,
            panY: session.view.panY + sy,
          },
        });
        return;
      }
      if (!session.moved) return;
      let dx = sx / session.view.pixelsPerMm,
        dy = sy / session.view.pixelsPerMm;
      const axis = e.shiftKey
        ? Math.abs(dx) >= Math.abs(dy)
          ? "x"
          : "y"
        : null;
      if (axis === "x") dy = 0;
      if (axis === "y") dx = 0;
      const box = layoutBox(session.original, session.ids);
      if (!box) return;
      const candidate = {
        minX: box.minX + dx,
        maxX: box.maxX + dx,
        minY: box.minY + dy,
        maxY: box.maxY + dy,
      };
      if (!e.altKey) {
        const snap = snapBox(
          candidate,
          layoutBoxes(
            session.original,
            session.original.instances
              .filter((i) => !session.ids.includes(i.id))
              .map((i) => i.id),
          ),
          session.view.pixelsPerMm,
          useEditor.getState().snaps,
          axis ? [axis] : ["x", "y"],
        );
        dx += snap.dx;
        dy += snap.dy;
        setGuides(snap.guides);
      } else setGuides([]);
      const targets = session.original.instances.filter((i) =>
        session.ids.includes(i.id),
      );
      if (
        !targets.every(
          (i) => validCoordinate(i.xMm + dx) && validCoordinate(i.yMm + dy),
        )
      )
        return;
      useLayout
        .getState()
        .previewMove(
          new Map(targets.map((i) => [i.id, { x: i.xMm + dx, y: i.yMm + dy }])),
        );
      setPointer(screenToWorld(screen, session.view));
    };
    const blur = () => {
      space.current = false;
      setSpacePressed(false);
      endDrag();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", endDrag);
      window.removeEventListener("blur", blur);
    };
  }, [endDrag]);
  function startPan(e: Konva.KonvaEventObject<MouseEvent>) {
    const ed = useEditor.getState();
    if (space.current || ed.tool === "pan" || e.evt.button === 1) {
      e.evt.preventDefault();
      const pos = e.target.getStage()?.getPointerPosition();
      if (!pos) return;
      drag.current = {
        type: "pan",
        screenStart: pos,
        view: ed.view,
        original: useLayout.getState().doc,
        ids: [],
        moved: false,
      };
    } else if (e.target === e.target.getStage()) ed.set({ selection: [] });
  }
  function startShape(id: string, e: Konva.KonvaEventObject<MouseEvent>) {
    if (
      space.current ||
      useEditor.getState().tool === "pan" ||
      e.evt.button === 1
    )
      return;
    if (e.evt.button !== 0) return;
    e.cancelBubble = true;
    const ed = useEditor.getState(),
      state = useLayout.getState();
    const deselectOnClick = e.evt.shiftKey && ed.selection.includes(id);
    // Keep selected objects available for Shift-drag axis locking. A stationary
    // Shift-click toggles selection on mouseup instead of before a possible drag.
    if (e.evt.shiftKey && !deselectOnClick) ed.select(id, true);
    else if (!ed.selection.includes(id)) ed.select(id);
    const current = useEditor.getState().selection;
    const ids = current.filter((id) =>
      state.doc.instances.some((i) => i.id === id && !i.locked),
    );
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    state.beginDrag();
    drag.current = {
      type: "move",
      screenStart: pos,
      view: ed.view,
      original: structuredClone(state.doc),
      ids,
      anchor: id,
      measureClick: !e.evt.shiftKey,
      deselectOnClick,
      moved: false,
    };
  }
  function keyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (
      e.target !== e.currentTarget ||
      (e.target as HTMLElement).closest(
        'input,textarea,select,[contenteditable="true"]',
      )
    )
      return;
    const ed = useEditor.getState(),
      state = useLayout.getState(),
      modifier = e.ctrlKey || e.metaKey;
    if (drag.current && e.key !== " " && e.key !== "Escape") return;
    if (e.code === "Space") {
      e.preventDefault();
      space.current = true;
      setSpacePressed(true);
    } else if (e.key === "Escape") {
      endDrag();
      ed.set({ selection: [], measurement: [], tool: "select" });
    } else if (modifier && e.key.toLowerCase() === "z") {
      e.preventDefault();
      e.shiftKey ? state.redo() : state.undo();
    } else if (modifier && e.key.toLowerCase() === "y") {
      e.preventDefault();
      state.redo();
    } else if (modifier && e.key.toLowerCase() === "d") {
      e.preventDefault();
      ed.set({ selection: state.duplicate(ed.selection) });
    } else if (e.key.toLowerCase() === "r" && !modifier) {
      e.preventDefault();
      state.rotate(ed.selection);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      state.remove(ed.selection);
    } else if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      state.move(
        ed.selection,
        e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0,
        e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0,
      );
    }
  }
  const s = view.pixelsPerMm;
  const visibleStart = screenToWorld({ x: 0, y: 0 }, view),
    visibleEnd = screenToWorld({ x: size.width, y: size.height }, view);
  const rawStep = 45 / s,
    power = 10 ** Math.floor(Math.log10(rawStep)),
    step = [1, 2, 5, 10].map((n) => n * power).find((n) => n >= rawStep)!;
  const gridX = [],
    gridY = [];
  for (
    let x = Math.ceil(visibleStart.x / step) * step;
    x < visibleEnd.x;
    x += step
  )
    gridX.push(x);
  for (
    let y = Math.ceil(visibleStart.y / step) * step;
    y < visibleEnd.y;
    y += step
  )
    gridY.push(y);
  const selectedBox = layoutBox(doc, selection);
  const panelPosition = (() => {
    if (!selectedBox) return { right: 16, top: 68 };
    const start = worldToScreen(
        { x: selectedBox.minX, y: selectedBox.minY },
        view,
      ),
      end = worldToScreen({ x: selectedBox.maxX, y: selectedBox.maxY }, view);
    const w = 266,
      h = 370;
    const choices = [
      { x: size.width - w - 16, y: 68 },
      { x: 16, y: 68 },
      { x: size.width - w - 16, y: size.height - h - 56 },
      { x: 16, y: size.height - h - 56 },
    ];
    const overlap = (p: Point) =>
      Math.max(0, Math.min(p.x + w, end.x) - Math.max(p.x, start.x)) *
      Math.max(0, Math.min(p.y + h, end.y) - Math.max(p.y, start.y));
    const measurementOverlap = (p: Point) =>
      tool !== "measure"
        ? 0
        : Math.max(0, Math.min(p.x + w, 300) - Math.max(p.x, 18)) *
          Math.max(0, Math.min(p.y + h, size.height - 72) - Math.max(p.y, 78));
    choices.sort(
      (a, b) =>
        overlap(a) +
        2 * measurementOverlap(a) -
        overlap(b) -
        2 * measurementOverlap(b),
    );
    return { left: Math.max(8, choices[0].x), top: Math.max(68, choices[0].y) };
  })();
  return (
    <main
      ref={wrapper}
      className={`editor-canvas ${tool === "pan" || spacePressed ? "panning" : tool === "measure" ? "measuring" : ""}`}
      tabIndex={0}
      aria-label="布局白板"
      onKeyDown={keyDown}
      onKeyUp={(e) => {
        if (e.code === "Space") {
          space.current = false;
          setSpacePressed(false);
        }
      }}
      onMouseDown={(e) => {
        if (e.target instanceof HTMLCanvasElement)
          e.currentTarget.focus({ preventScroll: true });
      }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPointer(
          screenToWorld(
            { x: e.clientX - rect.left, y: e.clientY - rect.top },
            useEditor.getState().view,
          ),
        );
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(e) => {
        e.preventDefault();
        try {
          const raw = e.dataTransfer.getData("application/displan-spec");
          if (!raw) return;
          const spec = validateSpec(JSON.parse(raw));
          const rect = e.currentTarget.getBoundingClientRect();
          const p = screenToWorld(
            { x: e.clientX - rect.left, y: e.clientY - rect.top },
            useEditor.getState().view,
          );
          const id = useLayout.getState().add(spec, p.x, p.y);
          if (id) useEditor.getState().set({ selection: [id], tool: "select" });
          e.currentTarget.focus();
        } catch (error) {
          useEditor.getState().set({
            message: error instanceof Error ? error.message : "无法添加型号",
          });
        }
      }}
    >
      <div className="canvas-top">
        <div className="canvas-tools">
          {collapsed && (
            <IconButton label="展开仓库" onClick={onExpand}>
              <PanelLeftOpen size={18} />
            </IconButton>
          )}
          <IconButton
            label="选择工具"
            active={tool === "select"}
            onClick={() => useEditor.getState().changeTool("select")}
          >
            <MousePointer2 size={18} />
          </IconButton>
          <IconButton
            label="平移工具 (Space)"
            active={tool === "pan"}
            onClick={() => useEditor.getState().changeTool("pan")}
          >
            <Hand size={18} />
          </IconButton>
          <IconButton
            label="测量工具"
            active={tool === "measure"}
            onClick={() => useEditor.getState().changeTool("measure")}
          >
            <Ruler size={18} />
          </IconButton>
        </div>
        <div className="canvas-label">
          <span className="blue-dot" />
          毫米世界坐标 <span>·</span> 外形尺寸
        </div>
      </div>
      <Stage
        width={size.width}
        height={size.height}
        onMouseDown={startPan}
        onContextMenu={(e) => e.evt.preventDefault()}
      >
        <Layer listening={false}>
          {gridX.map((x) => (
            <Line
              key={`x${x}`}
              points={[x * s + view.panX, 0, x * s + view.panX, size.height]}
              stroke={Math.abs(x) < 1e-8 ? "#cbd5e1" : "#e4e9f0"}
              strokeWidth={1}
            />
          ))}
          {gridY.map((y) => (
            <Line
              key={`y${y}`}
              points={[0, y * s + view.panY, size.width, y * s + view.panY]}
              stroke={Math.abs(y) < 1e-8 ? "#cbd5e1" : "#e4e9f0"}
              strokeWidth={1}
            />
          ))}
        </Layer>
        <Layer>
          <Group x={view.panX} y={view.panY} scaleX={s} scaleY={s}>
            {doc.instances.map((i) => {
              const spec = doc.specs.find((spec) => spec.id === i.specId)!,
                { width, height } = dimensions(i, spec),
                selected = selection.includes(i.id);
              const inset = Math.min(8, width * 0.04, height * 0.04),
                font = Math.min(24, width / 12, height / 5);
              return (
                <Group
                  key={i.id}
                  x={i.xMm}
                  y={i.yMm}
                  onMouseDown={(e) => startShape(i.id, e)}
                >
                  <Rect
                    x={-width / 2}
                    y={-height / 2}
                    width={width}
                    height={height}
                    fill="#303947"
                    cornerRadius={Math.min(8, width / 10, height / 10)}
                  />
                  <Rect
                    x={-width / 2 + inset}
                    y={-height / 2 + inset}
                    width={width - inset * 2}
                    height={height - inset * 2}
                    fill={selected ? "#d5e4f7" : "#dbe3eb"}
                    cornerRadius={inset / 2}
                    listening={false}
                  />
                  <Text
                    x={-width / 2 + 10}
                    y={-font * 0.8}
                    width={Math.max(0.01, width - 20)}
                    text={spec.name}
                    align="center"
                    fontSize={font}
                    fontStyle="bold"
                    fill="#303947"
                    listening={false}
                  />
                  <Text
                    x={-width / 2 + 5}
                    y={font * 0.65}
                    width={Math.max(0.01, width - 10)}
                    text={`${fmt(width)} × ${fmt(height)} mm`}
                    align="center"
                    fontSize={font * 0.63}
                    fill="#64748b"
                    listening={false}
                  />
                  {(i.locked || i.rotation !== 0) && (
                    <Text
                      x={-width / 2 + 14}
                      y={-height / 2 + 14}
                      text={`${i.locked ? "锁定 · " : ""}${i.rotation}°`}
                      fontSize={Math.min(13, font * 0.65)}
                      fill="#697b91"
                      listening={false}
                    />
                  )}
                  {selected && (
                    <Rect
                      x={-width / 2 - 3 / s}
                      y={-height / 2 - 3 / s}
                      width={width + 6 / s}
                      height={height + 6 / s}
                      stroke="#2563eb"
                      strokeWidth={2 / s}
                      cornerRadius={10}
                      listening={false}
                    />
                  )}
                </Group>
              );
            })}
            {showBounds && bounds && (
              <BoundingBoxOverlay box={bounds} scale={s} />
            )}
            {selection.length > 1 && selectedBox && (
              <Rect
                x={selectedBox.minX - 5 / s}
                y={selectedBox.minY - 5 / s}
                width={boxWidth(selectedBox) + 10 / s}
                height={boxHeight(selectedBox) + 10 / s}
                stroke="#2563eb"
                dash={[4 / s, 4 / s]}
                strokeWidth={1 / s}
                listening={false}
              />
            )}
            <SnapGuides guides={guides} scale={s} />
            {a && <MeasurementOverlay a={a} b={b} scale={s} />}
          </Group>
        </Layer>
      </Stage>
      {!doc.instances.length && (
        <div className="empty-canvas">
          <div className="empty-icon">
            <MousePointer2 size={28} />
          </div>
          <h2>让每一块屏幕，恰好就位。</h2>
          <p>从仓库拖入显示器，开始规划你的工作空间。</p>
          <span>真实尺寸 · 精确测量 · 本地保存</span>
        </div>
      )}
      {selection.length > 0 && (
        <div className="property-placement" style={panelPosition}>
          <MonitorProperties />
        </div>
      )}
      <MeasurementPanel />
      <div className="canvas-bottom">
        <span className="canvas-hint">
          {tool === "measure"
            ? "点击选择 A / B · 多选可作为测量组 · R 旋转 · Esc 退出"
            : "Space 拖动平移 · Ctrl 滚轮缩放 · Alt 拖动关闭吸附"}
        </span>
        <div className="zoom-controls">
          <IconButton
            label="缩小"
            onClick={() =>
              useEditor.getState().set({
                view: zoomAt(
                  view,
                  { x: size.width / 2, y: size.height / 2 },
                  1 / 1.2,
                ),
              })
            }
          >
            <Minus size={16} />
          </IconButton>
          <span>{zoomPercent(s)}%</span>
          <IconButton
            label="放大"
            onClick={() =>
              useEditor.getState().set({
                view: zoomAt(
                  view,
                  { x: size.width / 2, y: size.height / 2 },
                  1.2,
                ),
              })
            }
          >
            <Plus size={16} />
          </IconButton>
          <i />
          <IconButton label="适合内容 (Fit)" onClick={fit}>
            <LocateFixed size={18} />
          </IconButton>
        </div>
      </div>
      <div className="pointer-coordinates">
        {pointer
          ? `X ${fmt(pointer.x)} · Y ${fmt(pointer.y)} mm`
          : "1 世界单位 = 1 mm"}
      </div>
    </main>
  );
}
