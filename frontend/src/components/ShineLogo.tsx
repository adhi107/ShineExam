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
  const activeLogo = forceDefault ? null : (customLogoUrl || (tenant && tenant.logoUrl ? getMediaUrl(tenant.logoUrl) : null));
  const activeTitle = forceDefault ? "Shine" : (brandName || (tenant && tenant.name ? tenant.name : "Shine"));

  return (
    <div className={`shine-logo ${compact ? "compact" : ""} ${inverse ? "inverse" : ""} ${className}`} aria-label={activeTitle}>
      {activeLogo ? (
        <img
          className="shine-logo-image tenant-custom-logo"
          src={activeLogo}
          alt={activeTitle}
          onError={(e) => {
            // Fallback to default if custom image fails to load
            (e.target as HTMLImageElement).src = "/assets/shine-logo.png";
          }}
        />
      ) : (
        <img className="shine-logo-image" src="/assets/shine-logo.png" alt="Shine — Symbol of Success" />
      )}
    </div>
  );
};

export default ShineLogo;
