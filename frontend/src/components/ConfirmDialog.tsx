import React from "react";
import "./ConfirmDialog.css";

export type DialogVariant = "danger" | "warning" | "success" | "info" | "unblock";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  icon?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "info",
  icon,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    if (icon) return icon;
    switch (variant) {
      case "danger":
        return "🗑️";
      case "warning":
        return "⚠️";
      case "unblock":
        return "🔓";
      case "success":
        return "✅";
      case "info":
      default:
        return "🛡️";
    }
  };

  return (
    <div className="shine-dialog-backdrop" onClick={onCancel}>
      <div className={`shine-dialog-card variant-${variant}`} onClick={(e) => e.stopPropagation()}>
        <div className="shine-dialog-icon-wrap">
          <div className="shine-dialog-icon-circle">
            <span className="dialog-icon-glyph">{getIcon()}</span>
          </div>
        </div>

        <div className="shine-dialog-content">
          <h3 className="shine-dialog-title">{title}</h3>
          <div className="shine-dialog-message">{message}</div>
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
            type="button"
            className={`shine-dialog-btn-confirm btn-${variant}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
