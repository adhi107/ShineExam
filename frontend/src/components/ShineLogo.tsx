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
  const activeTitle = forceDefault ? "Shine" : (brandName || tenant?.name || storedTenant?.name || "Shine");

  return (
    <div className={`shine-logo ${compact ? "compact" : ""} ${inverse ? "inverse" : ""} ${className}`} aria-label={activeTitle}>
      {activeLogo ? (
        <img
          className="shine-logo-image tenant-custom-logo"
          src={activeLogo}
          alt={activeTitle}
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            // If direct /uploads/ fails on proxied servers, try with /api/uploads/
            if (activeLogo && !img.src.includes('/api/uploads/') && img.src.includes('/uploads/')) {
              img.src = img.src.replace('/uploads/', '/api/uploads/');
              return;
            }
            img.src = "/assets/shine-logo.png";
          }}
        />
      ) : (
        <img className="shine-logo-image" src="/assets/shine-logo.png" alt="Shine — Symbol of Success" />
      )}
    </div>
  );
};

export default ShineLogo;
