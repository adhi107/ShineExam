import React, { useState, useEffect, useRef } from "react";
import "./ConfirmDialog.css";
import "./PromptDialog.css";

export interface PromptDialogProps {
  isOpen: boolean;
  title: string;
  message?: string | React.ReactNode;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

const PromptDialog: React.FC<PromptDialogProps> = ({
  isOpen,
  title,
  message,
  defaultValue = "",
  placeholder = "Enter value...",
  confirmText = "Save Changes",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue, isOpen]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onConfirm(value.trim());
  };

  return (
    <div className="ent-dialog-backdrop" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="ent-prompt-title">
      <div
        className="ent-dialog-card ent-variant-info prompt-card"
        onClick={(e) => e.stopPropagation()}
        style={{ "--accent": "#2563eb", "--accent-light": "rgba(37,99,235,0.08)", "--icon-color": "#2563eb" } as React.CSSProperties}
      >
        <div className="ent-dialog-accent-bar" />

        <div className="ent-dialog-header">
          <div className="ent-dialog-icon-shell">
            <div className="ent-dialog-icon-ring">
              <span className="ent-dialog-icon-svg" style={{ color: "#2563eb" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </span>
            </div>
          </div>
          <div className="ent-dialog-header-text">
            <span className="ent-dialog-badge">Input Required</span>
            <h3 className="ent-dialog-title" id="ent-prompt-title">{title}</h3>
          </div>
        </div>

        <div className="ent-dialog-divider" />

        <div className="ent-dialog-body">
          {message && <div className="ent-dialog-message" style={{ marginBottom: "16px" }}>{message}</div>}

          <form onSubmit={handleSubmit} className="prompt-form">
            <div className="prompt-input-wrap">
              <input
                ref={inputRef}
                type="text"
                className="prompt-text-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                required
              />
            </div>
          </form>
        </div>

        <div className="ent-dialog-footer">
          <button
            type="button"
            className="ent-dialog-btn-cancel"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="ent-dialog-btn-confirm ent-btn-info"
            disabled={!value.trim()}
            onClick={handleSubmit as any}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptDialog;
