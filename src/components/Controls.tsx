import { useEffect, useState, type ReactNode } from "react";
import { fmt } from "../domain/types";

export function IconButton({
  children,
  label,
  active,
  disabled,
  onClick,
  className = "",
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? "active" : ""} ${className}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
export function NumberField({
  label,
  value,
  onCommit,
  valid,
  readOnly = false,
}: {
  label: string;
  value: number;
  onCommit?: (n: number) => void;
  valid?: (n: number) => boolean;
  readOnly?: boolean;
}) {
  const [text, setText] = useState(fmt(value)),
    [error, setError] = useState(false);
  useEffect(() => {
    setText(fmt(value));
    setError(false);
  }, [value]);
  function commit() {
    const n = text.trim() ? Number(text) : NaN;
    if (!Number.isFinite(n) || (valid && !valid(n))) {
      setError(true);
      return;
    }
    setError(false);
    if (n !== Number(fmt(value))) onCommit?.(n);
  }
  return (
    <label className={`number-field ${error ? "invalid" : ""}`}>
      <span>{label}</span>
      <div>
        <input
          aria-label={label}
          aria-invalid={error}
          type="text"
          inputMode="decimal"
          value={text}
          readOnly={readOnly}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit();
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              setText(fmt(value));
              setError(false);
              e.currentTarget.blur();
            }
          }}
        />
        <span>mm</span>
      </div>
      {error && <small>请输入范围内的有限数值</small>}
    </label>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    dialog?.querySelector<HTMLElement>("input,button")?.focus();
    return () => {
      window.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const controls = Array.from(
            e.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input:not(:disabled),select,textarea,[tabindex="0"]',
            ),
          );
          const first = controls[0],
            last = controls.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="关闭"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
