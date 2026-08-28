import React from "react";
import "./ConfirmDialog.css";

export type AlertVariant = "danger" | "warning" | "success" | "info" | "suspended" | "unblock";

export interface AlertDialogProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  buttonText?: string;
  variant?: AlertVariant;
  icon?: string;
  onClose: () => void;
}

const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  title,
  message,
  buttonText = "Got it",
  variant = "info",
  icon,
  onClose,
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    if (icon) return icon;
    switch (variant) {
      case "danger":
      case "suspended":
        return "🚫";
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

  const isSuspended = variant === "suspended" || variant === "danger";

  return (
    <div className="shine-dialog-backdrop" onClick={onClose}>
      <div className={`shine-dialog-card variant-${isSuspended ? "danger" : variant}`} onClick={(e) => e.stopPropagation()}>
        <div className="shine-dialog-icon-wrap">
          <div className="shine-dialog-icon-circle">
            <span className="dialog-icon-glyph">{getIcon()}</span>
          </div>
        </div>

        <div className="shine-dialog-content">
          <h3 className="shine-dialog-title" style={isSuspended ? { color: "#dc2626" } : undefined}>{title}</h3>
          <div className="shine-dialog-message">{message}</div>
        </div>

        <div className="shine-dialog-actions" style={{ justifyContent: "center" }}>
          <button
            type="button"
            className={`shine-dialog-btn-confirm btn-${isSuspended ? "danger" : variant}`}
            style={{ width: "100%", maxWidth: "200px" }}
            onClick={onClose}
            autoFocus
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertDialog;
