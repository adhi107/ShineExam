import React, { useEffect, useRef } from "react";
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

// Enterprise SVG icons — no emojis
const VariantIcons: Record<DialogVariant, React.ReactNode> = {
  danger: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  ),
  warning: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  success: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  info: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  ),
  unblock: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
    </svg>
  ),
};

const variantConfig = {
  danger:  { accent: "#dc2626", accentLight: "rgba(220,38,38,0.08)", iconColor: "#dc2626", badge: "Destructive Action" },
  warning: { accent: "#d97706", accentLight: "rgba(217,119,6,0.08)",  iconColor: "#d97706", badge: "Requires Attention" },
  success: { accent: "#16a34a", accentLight: "rgba(22,163,74,0.08)",  iconColor: "#16a34a", badge: "Confirmation" },
  info:    { accent: "#2563eb", accentLight: "rgba(37,99,235,0.08)",  iconColor: "#2563eb", badge: "Information" },
  unblock: { accent: "#16a34a", accentLight: "rgba(22,163,74,0.08)",  iconColor: "#16a34a", badge: "Access Management" },
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "info",
  onConfirm,
  onCancel,
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => confirmBtnRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const cfg = variantConfig[variant];

  return (
    <div className="ent-dialog-backdrop" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="ent-dialog-title">
      <div
        className={`ent-dialog-card ent-variant-${variant}`}
        onClick={(e) => e.stopPropagation()}
        style={{ "--accent": cfg.accent, "--accent-light": cfg.accentLight, "--icon-color": cfg.iconColor } as React.CSSProperties}
      >
        {/* Top accent bar */}
        <div className="ent-dialog-accent-bar" />

        {/* Header */}
        <div className="ent-dialog-header">
          <div className="ent-dialog-icon-shell">
            <div className="ent-dialog-icon-ring">
              <span className="ent-dialog-icon-svg" style={{ color: cfg.iconColor }}>
                {VariantIcons[variant]}
              </span>
            </div>
          </div>
          <div className="ent-dialog-header-text">
            <span className="ent-dialog-badge">{cfg.badge}</span>
            <h3 className="ent-dialog-title" id="ent-dialog-title">{title}</h3>
          </div>
        </div>

        {/* Divider */}
        <div className="ent-dialog-divider" />

        {/* Body */}
        <div className="ent-dialog-body">
          <div className="ent-dialog-message">{message}</div>
        </div>

        {/* Footer Actions */}
        <div className="ent-dialog-footer">
          <button
            type="button"
            className="ent-dialog-btn-cancel"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={`ent-dialog-btn-confirm ent-btn-${variant}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
