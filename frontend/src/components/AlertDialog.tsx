import React, { useEffect, useRef } from "react";
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

const VariantIcons: Record<AlertVariant, React.ReactNode> = {
  danger: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  suspended: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
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

const variantConfig: Record<AlertVariant, { accent: string; accentLight: string; iconColor: string; badge: string; btnVariant: string }> = {
  danger:    { accent: "#dc2626", accentLight: "rgba(220,38,38,0.08)",  iconColor: "#dc2626", badge: "Error",           btnVariant: "danger" },
  suspended: { accent: "#dc2626", accentLight: "rgba(220,38,38,0.08)",  iconColor: "#dc2626", badge: "Account Suspended", btnVariant: "danger" },
  warning:   { accent: "#d97706", accentLight: "rgba(217,119,6,0.08)",  iconColor: "#d97706", badge: "Warning",         btnVariant: "warning" },
  success:   { accent: "#16a34a", accentLight: "rgba(22,163,74,0.08)",  iconColor: "#16a34a", badge: "Success",         btnVariant: "success" },
  info:      { accent: "#2563eb", accentLight: "rgba(37,99,235,0.08)",  iconColor: "#2563eb", badge: "Information",     btnVariant: "info" },
  unblock:   { accent: "#16a34a", accentLight: "rgba(22,163,74,0.08)",  iconColor: "#16a34a", badge: "Access Restored",  btnVariant: "success" },
};

const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  title,
  message,
  buttonText = "Got it",
  variant = "info",
  onClose,
}) => {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => closeBtnRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" || e.key === "Enter") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const cfg = variantConfig[variant];
  const cardVariant = variant === "suspended" ? "danger" : variant;

  return (
    <div className="ent-dialog-backdrop" onClick={onClose} role="alertdialog" aria-modal="true" aria-labelledby="ent-alert-title">
      <div
        className={`ent-dialog-card ent-variant-${cardVariant}`}
        onClick={(e) => e.stopPropagation()}
        style={{ "--accent": cfg.accent, "--accent-light": cfg.accentLight, "--icon-color": cfg.iconColor } as React.CSSProperties}
      >
        <div className="ent-dialog-accent-bar" />

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
            <h3 className="ent-dialog-title" id="ent-alert-title">{title}</h3>
          </div>
        </div>

        <div className="ent-dialog-divider" />

        <div className="ent-dialog-body">
          <div className="ent-dialog-message">{message}</div>
        </div>

        <div className="ent-dialog-footer ent-footer-single">
          <button
            ref={closeBtnRef}
            type="button"
            className={`ent-dialog-btn-confirm ent-btn-${cfg.btnVariant}`}
            onClick={onClose}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertDialog;
