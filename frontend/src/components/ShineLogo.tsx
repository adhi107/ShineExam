import React from "react";
import { useTenant } from "../context/TenantContext";
import { getMediaUrl } from "../services/api";

interface ShineLogoProps {
  compact?: boolean;
  inverse?: boolean;
  className?: string;
  customLogoUrl?: string;
  brandName?: string;
  forceDefault?: boolean;
}

const ShineLogo: React.FC<ShineLogoProps> = ({ compact = false, inverse = false, className = "", customLogoUrl, brandName, forceDefault = false }) => {
  const { tenant } = useTenant();

  // Flexible resolution of logo from props, context, or session storage
  const storedTenant = typeof sessionStorage !== "undefined" ? (() => {
    try {
      const str = sessionStorage.getItem("tenant_info");
      return str ? JSON.parse(str) : null;
    } catch {
      return null;
    }
  })() : null;

  const rawLogo = forceDefault ? null : (customLogoUrl || tenant?.logoUrl || storedTenant?.logoUrl || null);
  const activeLogo = rawLogo ? getMediaUrl(rawLogo) : null;
  const activeTitle = forceDefault ? "Portal" : (brandName || tenant?.brandTitle || tenant?.name || storedTenant?.name || "Portal");
  const isCustomTenant = !forceDefault && (
    (tenant?.name && !tenant.name.toLowerCase().includes("shine") && tenant.name !== "Examination Portal") ||
    Boolean(activeLogo)
  );

  return (
    <div className={`shine-logo ${compact ? "compact" : ""} ${inverse ? "inverse" : ""} ${className}`} aria-label={activeTitle}>
      {activeLogo ? (
        <img
          className="shine-logo-image tenant-custom-logo"
          src={activeLogo}
          alt={activeTitle}
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            if (activeLogo && !img.src.includes('/api/uploads/') && img.src.includes('/uploads/')) {
              img.src = img.src.replace('/uploads/', '/api/uploads/');
              return;
            }
          }}
        />
      ) : isCustomTenant ? (
        <div className="tenant-emblem-badge" style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "10px",
          fontWeight: 800,
          color: inverse ? "#ffffff" : (tenant?.primaryColor || "#0b2f6b"),
          letterSpacing: "-0.02em",
          fontSize: compact ? "16px" : "20px"
        }}>
          <div style={{
            width: compact ? "32px" : "40px",
            height: compact ? "32px" : "40px",
            borderRadius: "10px",
            background: tenant?.primaryColor || "linear-gradient(135deg, #2563eb, #38bdf8)",
            color: "#ffffff",
            display: "grid",
            placeItems: "center",
            fontSize: compact ? "16px" : "20px",
            fontWeight: 900,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            flexShrink: 0
          }}>
            {(activeTitle || "E").trim().charAt(0).toUpperCase()}
          </div>
          {!compact && (
            <span style={{ maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {activeTitle}
            </span>
          )}
        </div>
      ) : (
        <div className="tenant-emblem-badge" style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "10px",
          fontWeight: 800,
          color: inverse ? "#ffffff" : "#0b2f6b",
          letterSpacing: "-0.02em",
          fontSize: compact ? "16px" : "20px"
        }}>
          <div style={{
            width: compact ? "32px" : "40px",
            height: compact ? "32px" : "40px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #2563eb, #38bdf8)",
            color: "#ffffff",
            display: "grid",
            placeItems: "center",
            fontSize: compact ? "16px" : "20px",
            fontWeight: 900,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            flexShrink: 0
          }}>
            🎓
          </div>
          {!compact && (
            <span style={{ fontWeight: 800 }}>
              EXAM PORTAL
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default ShineLogo;

