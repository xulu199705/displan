import { useState } from "react";
import { Monitor, Plus, Search, PanelLeftClose } from "lucide-react";
import { presets } from "../data/presets";
import { screenToWorld } from "../domain/geometry";
import { fmt, type MonitorSpec } from "../domain/types";
import { useEditor } from "../state/editorStore";
import { useLayout } from "../state/layoutStore";
import { CUSTOM_KEY, validateSpec } from "../services/storage";
import { CustomMonitorEditor } from "./CustomMonitorEditor";
import { IconButton } from "./Controls";

function readCustom(): MonitorSpec[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) throw new Error();
    return parsed.map(validateSpec).filter((s) => s.isCustom);
  } catch {
    useEditor
      .getState()
      .set({ message: "自定义型号仓库无法读取，请检查本地存储。" });
    return [];
  }
}
export function MonitorLibrary({ onCollapse }: { onCollapse: () => void }) {
  const [query, setQuery] = useState(""),
    [custom, setCustom] = useState(readCustom),
    [editing, setEditing] = useState(false);
  const doc = useLayout((s) => s.doc);
  const specs = [
    ...presets,
    ...custom,
    ...doc.specs.filter(
      (s) => s.isCustom && !custom.some((c) => c.id === s.id),
    ),
  ];
  function add(spec: MonitorSpec) {
    const { view, size } = useEditor.getState();
    const p = screenToWorld({ x: size.width / 2, y: size.height / 2 }, view);
    const id = useLayout.getState().add(spec, p.x, p.y);
    if (id) useEditor.getState().set({ selection: [id], tool: "select" });
  }
  return (
    <aside className="library" aria-label="显示器仓库">
      <div className="library-heading">
        <div>
          <h2>显示器仓库</h2>
          <p>按真实尺寸，规划每一块屏幕</p>
        </div>
        <IconButton label="折叠仓库" onClick={onCollapse}>
          <PanelLeftClose size={18} />
        </IconButton>
      </div>
      <label className="search">
        <Search size={16} />
        <input
          aria-label="搜索型号"
          placeholder="搜索显示器型号…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <kbd>/</kbd>
      </label>
      <div className="library-scroll">
        <div className="section-label">
          预设与自定义<span>{specs.length} 个型号</span>
        </div>
        {specs
          .filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
          .map((spec) => (
            <article
              key={spec.id}
              className="monitor-card"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/displan-spec",
                  JSON.stringify(spec),
                );
                e.dataTransfer.effectAllowed = "copy";
              }}
            >
              <div className="card-preview">
                <div
                  className="mini-monitor"
                  style={{
                    width: `${Math.min(150, (64 * spec.widthMm) / spec.heightMm)}px`,
                    height: "64px",
                  }}
                >
                  <span />
                  <i />
                </div>
                <span className="preview-tag">
                  {spec.isCustom ? "CUSTOM" : "DELL"}
                </span>
              </div>
              <div className="card-info">
                <div>
                  <h3>{spec.name}</h3>
                  <p>
                    {fmt(spec.widthMm)} × {fmt(spec.heightMm)} <span>mm</span>
                  </p>
                </div>
                <IconButton
                  label={`添加 ${spec.name}`}
                  onClick={() => add(spec)}
                >
                  <Plus size={18} />
                </IconButton>
              </div>
              <div className="card-meta">
                <span>
                  {spec.diagonalInch ? `${spec.diagonalInch}″` : "物理尺寸"}
                  {spec.aspectRatio ? ` · ${spec.aspectRatio}` : ""}
                </span>
                <span>{spec.estimated ? "估算尺寸" : "不含支架"}</span>
              </div>
            </article>
          ))}
        {!specs.some((s) =>
          s.name.toLowerCase().includes(query.toLowerCase()),
        ) && <div className="no-results">没有匹配的型号</div>}
        <button className="custom-button" onClick={() => setEditing(true)}>
          <Plus size={18} />
          <div>
            创建自定义显示器<span>输入外形尺寸或对角线与比例</span>
          </div>
        </button>
        <div className="library-note">
          <Monitor size={17} />
          <p>
            拖入白板，或点击 + 添加。
            <br />
            型号可重复使用，尺寸以 mm 为准。
          </p>
        </div>
        <div className="geometry-note">
          <span className="tiny-label">真实几何 · 自由组合</span>
          <p>
            屏幕只以二维外形矩形表示。
            <br />
            边框为示意，曲面与支架不建模。
          </p>
        </div>
      </div>
      {editing && (
        <CustomMonitorEditor
          onClose={() => setEditing(false)}
          onSave={(spec) => {
            const next = [...custom, spec];
            setCustom(next);
            try {
              localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
            } catch {
              useEditor
                .getState()
                .set({
                  message: "型号已创建，但本地保存失败（存储空间或权限）",
                });
            }
            setEditing(false);
            add(spec);
          }}
        />
      )}
    </aside>
  );
}
