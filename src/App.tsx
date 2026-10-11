import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Check, X, HardDrive, Monitor } from "lucide-react";
import { EditorToolbar } from "./components/EditorToolbar";
import { MonitorLibrary } from "./components/MonitorLibrary";
import { layoutBox, boxWidth, boxHeight } from "./domain/geometry";
import { fmt, zoomPercent } from "./domain/types";
import { useLayout, startupWarning } from "./state/layoutStore";
import { useEditor } from "./state/editorStore";
import { writeDraft } from "./services/storage";

const EditorCanvas = lazy(() =>
  import("./components/EditorCanvas").then((module) => ({
    default: module.EditorCanvas,
  })),
);

export function App() {
  const doc = useLayout((s) => s.doc),
    scale = useEditor((s) => s.view.pixelsPerMm),
    message = useEditor((s) => s.message);
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1100),
    [storageOk, setStorageOk] = useState(!startupWarning);
  const initialDocument = useRef(doc);
  const box = layoutBox(doc);
  useEffect(() => {
    if (startupWarning) useEditor.getState().set({ message: startupWarning });
  }, []);
  useEffect(() => {
    // Debounce draft writes; dragging previews do not write hundreds of snapshots.
    if (startupWarning && doc === initialDocument.current) return;
    const persist = () => {
      try {
        writeDraft(doc);
        setStorageOk(true);
      } catch {
        setStorageOk(false);
        useEditor.getState().set({
          message: "草稿保存失败，请导出 JSON 备份（本地存储空间或权限不足）",
        });
      }
    };
    const timer = setTimeout(persist, 500);
    window.addEventListener("pagehide", persist);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", persist);
    };
  }, [doc]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(
      () => useEditor.getState().set({ message: "" }),
      5000,
    );
    return () => clearTimeout(timer);
  }, [message]);
  return (
    <div className="app-shell">
      <EditorToolbar />
      <div className="workspace">
        {!collapsed && <MonitorLibrary onCollapse={() => setCollapsed(true)} />}
        <Suspense
          fallback={<main className="canvas-loading">正在加载毫米白板…</main>}
        >
          <EditorCanvas
            collapsed={collapsed}
            onExpand={() => setCollapsed(false)}
          />
        </Suspense>
      </div>
      <footer className="status-bar">
        <div>
          <span className="status-item">
            <Monitor size={14} />
            <b data-testid="monitor-count">{doc.instances.length}</b> 台显示器
          </span>
          <i />
          <span>
            组合尺寸{" "}
            <b data-testid="layout-size">
              {fmt(box ? boxWidth(box) : 0)} × {fmt(box ? boxHeight(box) : 0)}
            </b>{" "}
            mm
          </span>
        </div>
        <div>
          <span>
            {zoomPercent(scale)}% <span className="status-muted">缩放</span>
          </span>
          <i />
          <span className="local-status">
            <HardDrive size={13} />
            {storageOk ? "本地草稿" : "存储异常"}
          </span>
          <span className="status-muted">二维外形 · 不含支架</span>
        </div>
      </footer>
      {message && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{message}</span>
          <button
            aria-label="关闭提示"
            onClick={() => useEditor.getState().set({ message: "" })}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
