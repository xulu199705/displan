import { useState } from "react";
import { createUuid } from "../domain/uuid";
import { diagonalDimensions } from "../domain/geometry";
import { validDimension, type MonitorSpec } from "../domain/types";
import { Modal } from "./Controls";

export function CustomMonitorEditor({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (spec: MonitorSpec) => void;
}) {
  const [mode, setMode] = useState<"physical" | "diagonal">("physical");
  const [name, setName] = useState("自定义显示器"),
    [width, setWidth] = useState("600"),
    [height, setHeight] = useState("340");
  const [diagonal, setDiagonal] = useState("27"),
    [ratio, setRatio] = useState("16:9"),
    [rx, setRx] = useState("16"),
    [ry, setRy] = useState("9");
  const [bezelX, setBezelX] = useState("5"),
    [bezelY, setBezelY] = useState("5"),
    [error, setError] = useState("");
  const [active, setActive] = useState<
    { activeWidthMm: number; activeHeightMm: number } | undefined
  >();
  function calculate() {
    const d = Number(diagonal),
      x = Number(rx),
      y = Number(ry),
      bx = Number(bezelX),
      by = Number(bezelY);
    if (
      !diagonal.trim() ||
      !(d > 0 && d <= 500) ||
      !Number.isFinite(d) ||
      !validDimension(x) ||
      !validDimension(y) ||
      !bezelX.trim() ||
      !bezelY.trim() ||
      !Number.isFinite(bx) ||
      !Number.isFinite(by) ||
      bx < 0 ||
      by < 0 ||
      bx > 1000 ||
      by > 1000
    ) {
      setError("请检查对角线、比例和边框（边框 0–1000 mm）");
      return;
    }
    const result = diagonalDimensions(d, x, y, bx, by);
    if (!validDimension(result.widthMm) || !validDimension(result.heightMm)) {
      setError("估算结果超出尺寸范围");
      return;
    }
    setActive(result);
    setWidth(result.widthMm.toFixed(4));
    setHeight(result.heightMm.toFixed(4));
    setError("");
  }
  return (
    <Modal title="创建自定义显示器" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const w = Number(width),
            h = Number(height),
            d = Number(diagonal);
          if (
            !name.trim() ||
            name.length > 200 ||
            !validDimension(w) ||
            !validDimension(h)
          ) {
            setError("名称必填，宽高须为 0.01–10000 mm");
            return;
          }
          if (diagonal.trim() && (!Number.isFinite(d) || d <= 0 || d > 500)) {
            setError("对角线须为 0–500 英寸之间的正数，或留空");
            return;
          }
          if (mode === "diagonal" && !active) {
            setError("请先计算估算尺寸，再按需修正");
            return;
          }
          onSave({
            id: createUuid(),
            name: name.trim(),
            widthMm: w,
            heightMm: h,
            isCustom: true,
            diagonalInch: diagonal.trim() ? d : undefined,
            estimated: mode === "diagonal",
            ...(mode === "diagonal" ? active : {}),
          });
        }}
      >
        <div className="segmented">
          <button
            type="button"
            className={mode === "physical" ? "active" : ""}
            onClick={() => {
              setMode("physical");
              setError("");
            }}
          >
            物理尺寸
          </button>
          <button
            type="button"
            className={mode === "diagonal" ? "active" : ""}
            onClick={() => {
              setMode("diagonal");
              setError("");
            }}
          >
            对角线与比例
          </button>
        </div>
        <label className="form-field">
          型号名称
          <input
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {mode === "diagonal" && (
          <>
            <div className="form-grid">
              <label className="form-field">
                对角线 (inch)
                <input
                  type="number"
                  min="0.01"
                  max="500"
                  step="any"
                  value={diagonal}
                  onChange={(e) => {
                    setDiagonal(e.target.value);
                    setActive(undefined);
                  }}
                />
              </label>
              <label className="form-field">
                宽高比
                <select
                  value={ratio}
                  onChange={(e) => {
                    const next = e.target.value;
                    setRatio(next);
                    if (next !== "custom") {
                      const [x, y] = next.split(":");
                      setRx(x);
                      setRy(y);
                    }
                    setActive(undefined);
                  }}
                >
                  <option>16:9</option>
                  <option>16:10</option>
                  <option>21:9</option>
                  <option>32:9</option>
                  <option value="custom">自定义</option>
                </select>
              </label>
            </div>
            {ratio === "custom" && (
              <div className="form-grid">
                <label className="form-field">
                  比例宽
                  <input
                    type="number"
                    step="any"
                    value={rx}
                    onChange={(e) => {
                      setRx(e.target.value);
                      setActive(undefined);
                    }}
                  />
                </label>
                <label className="form-field">
                  比例高
                  <input
                    type="number"
                    step="any"
                    value={ry}
                    onChange={(e) => {
                      setRy(e.target.value);
                      setActive(undefined);
                    }}
                  />
                </label>
              </div>
            )}
            <div className="form-grid">
              <label className="form-field">
                左右各边框 (mm)
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={bezelX}
                  onChange={(e) => {
                    setBezelX(e.target.value);
                    setActive(undefined);
                  }}
                />
              </label>
              <label className="form-field">
                上下各边框 (mm)
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={bezelY}
                  onChange={(e) => {
                    setBezelY(e.target.value);
                    setActive(undefined);
                  }}
                />
              </label>
            </div>
            <button
              type="button"
              className="secondary full"
              onClick={calculate}
            >
              计算估算尺寸
            </button>
            <p className="hint">
              估算尺寸：先计算有效显示区域，再加上边框。下方外形尺寸可手动修正。
            </p>
          </>
        )}
        <div className="form-grid">
          <label className="form-field">
            外形宽度 (mm)
            <input
              aria-label="自定义宽度"
              required
              type="number"
              min="0.01"
              max="10000"
              step="any"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
            />
          </label>
          <label className="form-field">
            外形高度 (mm)
            <input
              aria-label="自定义高度"
              required
              type="number"
              min="0.01"
              max="10000"
              step="any"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </label>
        </div>
        {mode === "physical" && (
          <label className="form-field">
            标称对角线 (inch，可选)
            <input
              type="number"
              min="0.01"
              max="500"
              step="any"
              value={diagonal}
              onChange={(e) => setDiagonal(e.target.value)}
            />
          </label>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            取消
          </button>
          <button className="primary" type="submit">
            创建型号
          </button>
        </div>
      </form>
    </Modal>
  );
}
