import { RotateCcw, ScanLine } from "lucide-react";
import { boxHeight, boxWidth, layoutBox } from "../domain/geometry";
import { measureBoxes } from "../domain/measurement";
import { fmt, signed } from "../domain/types";
import { useEditor } from "../state/editorStore";
import { useLayout } from "../state/layoutStore";
import { IconButton } from "./Controls";

export function MeasurementPanel() {
  const { tool, measurement, selection, chooseMeasure } = useEditor();
  const doc = useLayout((s) => s.doc);
  if (tool !== "measure") return null;
  const a = measurement[0] ? layoutBox(doc, measurement[0]) : null,
    b = measurement[1] ? layoutBox(doc, measurement[1]) : null;
  const m = a && b ? measureBoxes(a, b) : null;
  const targetName = (ids: string[]) =>
    ids.length > 1
      ? `${ids.length} 台显示器组合`
      : (doc.specs.find(
          (s) => s.id === doc.instances.find((i) => i.id === ids[0])?.specId,
        )?.name ?? "目标");
  return (
    <section className="floating-panel measurement-panel" aria-label="测量结果">
      <div className="panel-heading">
        <span>
          <ScanLine size={15} /> 尺寸测量
        </span>
        <IconButton
          label="重新测量"
          onClick={() => useEditor.getState().set({ measurement: [] })}
        >
          <RotateCcw size={15} />
        </IconButton>
      </div>
      <p className="hint">
        {!a
          ? "点击目标 A，或将当前选择设为测量组。"
          : !b
            ? "点击另一个目标 B。拖动不会改变测量目标。"
            : "偏差方向为 B − A，X 向右，Y 向下。"}
      </p>
      {selection.length > 0 && (
        <button
          className="secondary full small"
          onClick={() => chooseMeasure(selection)}
        >
          将所选 {selection.length} 台设为目标{" "}
          {measurement.length === 1 ? "B" : "A"}
        </button>
      )}
      {a && (
        <div className="target-summary">
          <b>A</b>
          <div>
            {targetName(measurement[0])}
            <small>
              {fmt(boxWidth(a))} × {fmt(boxHeight(a))} mm
            </small>
          </div>
        </div>
      )}
      {b && (
        <div className="target-summary">
          <b>B</b>
          <div>
            {targetName(measurement[1])}
            <small>
              {fmt(boxWidth(b))} × {fmt(boxHeight(b))} mm
            </small>
          </div>
        </div>
      )}
      {m && (
        <>
          <span className="relation-badge">{m.relation}</span>
          <dl className="measure-values">
            <div>
              <dt>X 边缘间距</dt>
              <dd>{fmt(m.x.gap)} mm</dd>
            </div>
            <div>
              <dt>Y 边缘间距</dt>
              <dd>{fmt(m.y.gap)} mm</dd>
            </div>
            {m.x.overlap > 0 && (
              <div>
                <dt>X 投影重叠</dt>
                <dd>{fmt(m.x.overlap)} mm</dd>
              </div>
            )}
            {m.y.overlap > 0 && (
              <div>
                <dt>Y 投影重叠</dt>
                <dd>{fmt(m.y.overlap)} mm</dd>
              </div>
            )}
            <div>
              <dt>中心 X 偏差</dt>
              <dd>{signed(m.dx)} mm</dd>
            </div>
            <div>
              <dt>中心 Y 偏差</dt>
              <dd>{signed(m.dy)} mm</dd>
            </div>
            <div>
              <dt>中心直线距离</dt>
              <dd>{fmt(m.centerDistance)} mm</dd>
            </div>
            <div>
              <dt>最短距离</dt>
              <dd>{fmt(m.shortestDistance)} mm</dd>
            </div>
            <div>
              <dt>顶边偏差</dt>
              <dd>{signed(m.top)} mm</dd>
            </div>
            <div>
              <dt>底边偏差</dt>
              <dd>{signed(m.bottom)} mm</dd>
            </div>
            <div>
              <dt>左边偏差</dt>
              <dd>{signed(m.left)} mm</dd>
            </div>
            <div>
              <dt>右边偏差</dt>
              <dd>{signed(m.right)} mm</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}
