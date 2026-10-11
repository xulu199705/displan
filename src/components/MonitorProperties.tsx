import {
  Copy,
  LockKeyhole,
  RotateCw,
  Trash2,
  UnlockKeyhole,
  X,
} from "lucide-react";
import { dimensions, layoutBox, boxWidth, boxHeight } from "../domain/geometry";
import { fmt, validCoordinate, validDimension } from "../domain/types";
import { useEditor } from "../state/editorStore";
import { useLayout } from "../state/layoutStore";
import { IconButton, NumberField } from "./Controls";

export function MonitorProperties() {
  const doc = useLayout((s) => s.doc),
    selected = useEditor((s) => s.selection);
  const targets = doc.instances.filter((i) => selected.includes(i.id));
  if (!targets.length) return null;
  const i = targets[0],
    spec = doc.specs.find((s) => s.id === i.specId)!;
  const box = layoutBox(doc, selected)!;
  const locked = targets.every((i) => i.locked);
  const { width, height } = dimensions(i, spec);
  return (
    <section className="floating-panel properties" aria-label="显示器属性">
      <div className="panel-heading">
        <span>
          {targets.length === 1 ? "显示器属性" : `已选择 ${targets.length} 台`}
        </span>
        <IconButton
          label="取消选择"
          onClick={() => useEditor.getState().set({ selection: [] })}
        >
          <X size={14} />
        </IconButton>
      </div>
      {targets.length === 1 ? (
        <>
          <h3>{spec.name}</h3>
          <p className="property-subtitle">
            {spec.isCustom
              ? spec.estimated
                ? "自定义 · 估算尺寸"
                : "自定义型号"
              : "预设型号 · 尺寸只读"}
          </p>
          <div className="form-grid">
            <NumberField
              label="X 坐标"
              value={i.xMm}
              valid={validCoordinate}
              readOnly={i.locked}
              onCommit={(xMm) => useLayout.getState().patch([i.id], { xMm })}
            />
            <NumberField
              label="Y 坐标"
              value={i.yMm}
              valid={validCoordinate}
              readOnly={i.locked}
              onCommit={(yMm) => useLayout.getState().patch([i.id], { yMm })}
            />
          </div>
          <div className="form-grid">
            <NumberField
              label="型号宽度"
              value={i.widthMm ?? spec.widthMm}
              valid={validDimension}
              readOnly={!spec.isCustom || i.locked}
              onCommit={(widthMm) =>
                useLayout.getState().patch([i.id], { widthMm })
              }
            />
            <NumberField
              label="型号高度"
              value={i.heightMm ?? spec.heightMm}
              valid={validDimension}
              readOnly={!spec.isCustom || i.locked}
              onCommit={(heightMm) =>
                useLayout.getState().patch([i.id], { heightMm })
              }
            />
          </div>
          <div className="property-line">
            <span>当前外形</span>
            <span>
              {fmt(width)} × {fmt(height)} mm
            </span>
          </div>
          <div className="property-line">
            <span>旋转方向</span>
            <span>{i.rotation}°</span>
          </div>
        </>
      ) : (
        <>
          <h3>所选对象联合包围盒</h3>
          <div className="selection-size">
            {fmt(boxWidth(box))} × {fmt(boxHeight(box))}
            <small>mm · 包含锁定对象</small>
          </div>
        </>
      )}
      <div className="property-actions">
        <IconButton
          label="旋转 90° (R)"
          disabled={locked}
          onClick={() => useLayout.getState().rotate(selected)}
        >
          <RotateCw size={17} />
        </IconButton>
        <IconButton
          label="复制 (Ctrl+D)"
          onClick={() =>
            useEditor
              .getState()
              .set({ selection: useLayout.getState().duplicate(selected) })
          }
        >
          <Copy size={17} />
        </IconButton>
        <IconButton
          label={locked ? "解锁" : "锁定"}
          active={locked}
          onClick={() =>
            useLayout.getState().patch(selected, { locked: !locked }, true)
          }
        >
          {locked ? <LockKeyhole size={17} /> : <UnlockKeyhole size={17} />}
        </IconButton>
        <IconButton
          label="删除 (Delete)"
          disabled={locked}
          onClick={() => useLayout.getState().remove(selected)}
        >
          <Trash2 size={17} />
        </IconButton>
      </div>
      {targets.some((i) => i.locked) && (
        <p className="hint">锁定对象不会移动、旋转或删除。</p>
      )}
    </section>
  );
}
