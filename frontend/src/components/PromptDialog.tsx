import React, { useState, useEffect } from "react";
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
  icon = "✏️",
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onConfirm(value.trim());
  };

  return (
    <div className="shine-dialog-backdrop" onClick={onCancel}>
      <div className="shine-dialog-card variant-info prompt-card" onClick={(e) => e.stopPropagation()}>
        <div className="shine-dialog-icon-wrap">
          <div className="shine-dialog-icon-circle">
            <span className="dialog-icon-glyph">{icon}</span>
          </div>
        </div>

        <div className="shine-dialog-content">
          <h3 className="shine-dialog-title">{title}</h3>
          {message && <div className="shine-dialog-message">{message}</div>}
        </div>

        <form onSubmit={handleSubmit} className="prompt-form">
          <div className="prompt-input-wrap">
            <input
              type="text"
              className="prompt-text-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              autoFocus
              required
            />
          </div>

          <div className="shine-dialog-actions">
            <button
              type="button"
              className="shine-dialog-btn-cancel"
              onClick={onCancel}
            >
              {cancelText}
            </button>
            <button
              type="submit"
              className="shine-dialog-btn-confirm btn-info"
              disabled={!value.trim()}
            >
              {confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PromptDialog;
