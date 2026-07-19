import React from "react";

interface ShineLogoProps {
  compact?: boolean;
  inverse?: boolean;
  className?: string;
}

const ShineLogo: React.FC<ShineLogoProps> = ({ compact = false, inverse = false, className = "" }) => (
  <div className={`shine-logo ${compact ? "compact" : ""} ${inverse ? "inverse" : ""} ${className}`} aria-label="Shine">
    <img className="shine-logo-image" src="/assets/shine-logo.png" alt="Shine — Symbol of Success" />
  </div>
);

export default ShineLogo;
