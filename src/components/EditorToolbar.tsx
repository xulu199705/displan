import { useRef, useState } from "react";
import {
  Download,
  FilePlus2,
  FolderOpen,
  Redo2,
  Save,
  Undo2,
  Upload,
  Scan,
  Magnet,
  ChevronDown,
  HelpCircle,
  Monitor,
} from "lucide-react";
import { exampleLayout } from "../data/presets";
import { newLayout, useLayout } from "../state/layoutStore";
import { useEditor } from "../state/editorStore";
import {
  downloadBlob,
  exportPng,
  layoutSvg,
  safeFilename,
} from "../services/exporters";
import {
  deleteLayout,
  parseDocument,
  readLayouts,
  writeLayout,
} from "../services/storage";
import type { LayoutDocument } from "../domain/types";
import { IconButton, Modal } from "./Controls";

export function EditorToolbar() {
  const { doc, past, future } = useLayout(),
    { snaps, showBounds } = useEditor();
  const input = useRef<HTMLInputElement>(null);
  const [exportMenu, setExportMenu] = useState(false),
    [snapMenu, setSnapMenu] = useState(false),
    [help, setHelp] = useState(false),
    [layouts, setLayouts] = useState<LayoutDocument[] | null>(null);
  function report(error: unknown) {
    useEditor
      .getState()
      .set({ message: error instanceof Error ? error.message : "操作失败" });
  }
  function replace(next: LayoutDocument) {
    useLayout.getState().replace(next);
    const ed = useEditor.getState();
    ed.set({ selection: [], measurement: [], fitRequest: ed.fitRequest + 1 });
  }
  return (
    <>
      <header className="toolbar">
        <div className="brand" title="一个基于真实物理尺寸的显示器布局规划工具">
          <span className="brand-mark">
            <Monitor size={19} />
            <i />
          </span>
          <strong>DisPlan</strong>
          <span className="version">V1.0</span>
        </div>
        <div className="toolbar-divider" />
        <div className="layout-name">
          <input
            aria-label="方案名称"
            maxLength={200}
            value={doc.name}
            onChange={(e) =>
              useLayout.getState().edit((d) => {
                d.name = e.target.value;
              })
            }
            onBlur={() => {
              if (!useLayout.getState().doc.name.trim())
                useLayout.getState().edit((d) => {
                  d.name = "未命名方案";
                });
            }}
          />
          <ChevronDown size={14} />
          <button
            className="name-list-button"
            aria-label="本地方案列表"
            title="本地方案列表"
            onClick={() => {
              try {
                setLayouts(readLayouts());
              } catch (e) {
                report(e);
              }
            }}
          />
        </div>
        <div className="toolbar-actions">
          <IconButton
            label="新建方案"
            onClick={() => {
              newLayout();
              const ed = useEditor.getState();
              ed.set({
                selection: [],
                measurement: [],
                fitRequest: ed.fitRequest + 1,
              });
            }}
          >
            <FilePlus2 size={18} />
          </IconButton>
          <IconButton
            label="撤销 (Ctrl+Z)"
            disabled={!past.length}
            onClick={() => useLayout.getState().undo()}
          >
            <Undo2 size={18} />
          </IconButton>
          <IconButton
            label="重做 (Ctrl+Y)"
            disabled={!future.length}
            onClick={() => useLayout.getState().redo()}
          >
            <Redo2 size={18} />
          </IconButton>
          <div className="toolbar-divider" />
          <div className="menu-anchor">
            <IconButton
              label="吸附设置"
              active={snaps.edges || snaps.centers || snaps.gaps}
              onClick={() => setSnapMenu(!snapMenu)}
            >
              <Magnet size={18} />
            </IconButton>
            {snapMenu && (
              <>
                <div
                  className="menu-dismiss"
                  onClick={() => setSnapMenu(false)}
                />
                <div className="dropdown snap-menu">
                  <span className="dropdown-caption">吸附阈值 · 8 CSS px</span>
                  {(
                    [
                      ["edges", "边缘对齐"],
                      ["centers", "中心线对齐"],
                      ["gaps", "间距 0 / 5 / 10 / 20 mm"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={snaps[key]}
                        onChange={(e) =>
                          useEditor
                            .getState()
                            .set({
                              snaps: { ...snaps, [key]: e.target.checked },
                            })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          <IconButton
            label="组合包围盒"
            active={showBounds}
            onClick={() =>
              useEditor.getState().set({ showBounds: !showBounds })
            }
          >
            <Scan size={18} />
          </IconButton>
          <button
            className="text-button example-button"
            onClick={() => replace(exampleLayout())}
          >
            加载示例
          </button>
          <IconButton label="快捷键与说明" onClick={() => setHelp(true)}>
            <HelpCircle size={18} />
          </IconButton>
          <div className="toolbar-divider" />
          <IconButton label="导入 JSON" onClick={() => input.current?.click()}>
            <Upload size={18} />
          </IconButton>
          <div className="menu-anchor">
            <button
              className="secondary export-button"
              onClick={() => setExportMenu(!exportMenu)}
            >
              <Download size={16} />
              导出
              <ChevronDown size={13} />
            </button>
            {exportMenu && (
              <>
                <div
                  className="menu-dismiss"
                  onClick={() => setExportMenu(false)}
                />
                <div className="dropdown export-menu">
                  {(["JSON", "PNG", "SVG"] as const).map((format) => (
                    <button
                      key={format}
                      onClick={async () => {
                        setExportMenu(false);
                        try {
                          const name = safeFilename(doc.name);
                          if (format === "JSON")
                            downloadBlob(
                              new Blob([JSON.stringify(doc, null, 2)], {
                                type: "application/json",
                              }),
                              `${name}.json`,
                            );
                          else if (format === "SVG")
                            downloadBlob(
                              new Blob([layoutSvg(doc)], {
                                type: "image/svg+xml;charset=utf-8",
                              }),
                              `${name}.svg`,
                            );
                          else await exportPng(doc);
                        } catch (e) {
                          report(e);
                        }
                      }}
                    >
                      <Download size={15} />
                      <span>导出 {format}</span>
                      <small>
                        {format === "JSON" ? "可继续编辑" : "纯布局图形"}
                      </small>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            className="primary save-button"
            onClick={() => {
              try {
                writeLayout(doc);
                useEditor.getState().set({ message: "方案已保存到本地" });
              } catch (e) {
                report(e);
              }
            }}
          >
            <Save size={16} />
            保存方案
          </button>
        </div>
        <input
          ref={input}
          aria-label="导入布局文件"
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              if (file.size > 10 * 1024 * 1024)
                throw new Error("文件超过 10 MB");
              replace(parseDocument(await file.text()));
              useEditor.getState().set({ message: "方案导入成功" });
            } catch (error) {
              report(error);
            }
          }}
        />
      </header>
      {layouts !== null && (
        <Modal title="本地方案" onClose={() => setLayouts(null)}>
          <p className="hint">
            保存在当前浏览器。切换前可点击“保存方案”保留当前布局。
          </p>
          {!layouts.length && (
            <div className="no-results">还没有保存的方案</div>
          )}
          <div className="saved-layouts">
            {layouts.map((d) => (
              <div className="saved-layout" key={d.id}>
                <button
                  onClick={() => {
                    replace(d);
                    setLayouts(null);
                  }}
                >
                  <FolderOpen size={18} />
                  <div>
                    <b>{d.name}</b>
                    <span>{d.instances.length} 台显示器</span>
                  </div>
                </button>
                <button
                  className="text-button danger"
                  aria-label={`删除方案 ${d.name}`}
                  onClick={() => {
                    try {
                      deleteLayout(d.id);
                      setLayouts(readLayouts());
                    } catch (e) {
                      report(e);
                    }
                  }}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {help && (
        <Modal title="使用 DisPlan" onClose={() => setHelp(false)} wide>
          <p className="help-intro">一个基于真实物理尺寸的显示器布局规划工具</p>
          <div className="help-grid">
            {[
              ["拖入 / +", "添加显示器，型号可重复使用"],
              ["Shift + 点击", "多选；测量时可将多选设为目标组"],
              ["Shift + 拖动", "锁定水平或垂直移动"],
              ["Alt + 拖动", "临时关闭吸附"],
              ["Space + 拖动", "平移无限白板"],
              ["Ctrl + 滚轮", "以鼠标位置为中心缩放"],
              ["R", "围绕中心旋转 90°"],
              ["方向键 / Shift + 方向键", "移动 1 mm / 10 mm"],
              ["Ctrl + D", "复制所选对象"],
              ["Delete / Backspace", "删除未锁定的所选对象"],
              ["Ctrl + Z / Ctrl + Y", "撤销 / 重做"],
              ["Esc", "取消选择并退出当前工具"],
            ].map(([key, action]) => (
              <div key={key}>
                <kbd>{key}</kbd>
                <span>{action}</span>
              </div>
            ))}
          </div>
          <p className="hint">
            快捷键在白板获得焦点时生效，输入框编辑不受影响。macOS 可使用 Command
            代替 Ctrl。100% = 1 CSS px/mm，不代表屏幕上的实际尺长。
          </p>
          <p className="hint">
            示例：1233.80 × 718.30 mm；双屏与竖置屏高度差 5.10
            mm，居中后顶底边各差 2.55 mm。二维几何不保证支架能实现零间距安装。
          </p>
        </Modal>
      )}
    </>
  );
}
