/**
 * DynamicWatermark
 * ────────────────
 * Renders a continuously updating, semi-transparent canvas watermark over
 * sensitive content. Contains the logged-in user ID, session ID (truncated),
 * current timestamp, and the TENANT'S OWN organisation name (never a hardcoded brand).
 *
 * Design principles:
 *  - Canvas-based: cannot be hidden by toggling a single DOM element's visibility
 *  - Redraws every 8-15 seconds with a new timestamp and random position offset
 *  - pointer-events: none so it doesn't interfere with candidate interaction
 *  - Supports customizable bold colors, opacity, and custom text stamps
 *  - Multi-tenant: listens to sessionStorage 'storage' events for live tenant changes
 *  - Mobile-optimized: smaller tile width (240px) on narrow viewports
 *  - Admin-controlled: fetches /public/security/config every 30s to respect
 *    the admin's watermarkEnabled and watermarkModules settings in real-time
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useSecurityContext } from './SecurityContext';
import { buildUrl } from '../services/api';
import './security.css';

export type WatermarkModuleType = 'exam' | 'results' | 'documents' | 'classes' | 'dashboard' | 'general';

export interface DynamicWatermarkProps {
  /** Which module this watermark is in — used to check admin module-wise controls */
  module?: WatermarkModuleType;
  /** Override userId from context if needed */
  userId?: string;
  /** Override orgName from context if needed */
  orgName?: string;
  /** Custom headline or watermark text (e.g. "CONFIDENTIAL SOLUTION REPORT") */
  customText?: string;
  /** Bold color string (e.g. "#dc2626", "#2563eb", "#7c3aed", etc.); default "#1a1a2e" */
  color?: string;
  /** Font weight bolding (true = 800/900 ultra bold, false = 600 bold) */
  isBold?: boolean;
  /** Opacity 0–1; default 0.18 */
  opacity?: number;
  /** Include candidate name/userId */
  includeCandidate?: boolean;
  /** Include live date and timestamp */
  includeTimestamp?: boolean;
  /** Include session code */
  includeSession?: boolean;
  /** Redraw interval in milliseconds; default 8000 (8s) */
  intervalMs?: number;
}

interface PublicSecurityConfig {
  watermarkEnabled: boolean;
  watermarkModules: string[];
  watermarkIntervalSec: number;
}

/** Resolve tenant org name from all available sources */
function resolveTenantOrgName(ctxOrgName?: string): { orgName: string; color: string } {
  let orgName = '';
  let color = '';

  if (typeof sessionStorage !== 'undefined') {
    try {
      const storedTenant = sessionStorage.getItem('tenant_info');
      if (storedTenant) {
        const parsed = JSON.parse(storedTenant);
        if (parsed.brandTitle || parsed.name) {
          orgName = parsed.brandTitle || parsed.name;
        }
        if (parsed.watermarkColor) {
          color = parsed.watermarkColor;
        }
        if (parsed.primaryColor && !color) {
          color = parsed.primaryColor;
        }
      }
      if (!orgName) {
        orgName =
          sessionStorage.getItem('tenantBrandTitle') ||
          sessionStorage.getItem('tenantName') ||
          sessionStorage.getItem('orgName') ||
          '';
      }
      if (!color) {
        color = sessionStorage.getItem('tenantWatermarkColor') || '';
      }
    } catch {
      // sessionStorage may be unavailable in some contexts
    }
  }

  // Priority: sessionStorage > context; never fall back to "Shine Exam" branding
  if (!orgName) {
    orgName = ctxOrgName || '';
  }

  return { orgName, color };
}

function drawWatermark(
  canvas: HTMLCanvasElement,
  userId: string,
  sessionId: string,
  orgName: string,
  customText: string,
  color: string,
  opacity: number,
  isBold: boolean,
  includeCandidate: boolean,
  includeTimestamp: boolean,
  includeSession: boolean
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Match canvas dimensions to its rendered size
  canvas.width = canvas.offsetWidth || window.innerWidth;
  canvas.height = canvas.offsetHeight || window.innerHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const lines: string[] = [];
  if (customText) {
    lines.push(customText.toUpperCase());
  } else if (orgName) {
    lines.push(orgName.toUpperCase());
  } else {
    // Last resort: use a generic confidential label — no branding
    lines.push('CONFIDENTIAL');
  }

  if (includeCandidate && userId) {
    lines.push(`CANDIDATE: ${userId}`);
  }

  if (includeTimestamp) {
    lines.push(`${dateStr} • ${timeStr}`);
  }

  if (includeSession && sessionId) {
    const shortSession = sessionId.slice(0, 8).toUpperCase();
    lines.push(`SEC-ID: ${shortSession}`);
  }

  ctx.globalAlpha = Math.max(0.04, Math.min(0.95, opacity));
  ctx.fillStyle = color || '#1a1a2e';
  const weight = isBold ? '900' : '700';

  // Scale font for short org names so they look prominent, smaller for long names
  const baseFontSize = orgName.length > 20 ? 12 : orgName.length > 12 ? 13 : 14.5;
  ctx.font = `${weight} ${baseFontSize}px "Inter", "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';

  // Tile width: narrower on mobile viewports for proper tiling
  const isMobile = canvas.width < 600;
  const tileW = isMobile ? 220 : 340;
  const tileH = Math.max(120, lines.length * 26 + 36);
  const angleRad = -Math.PI / 6; // -30 degrees

  // Random positional jitter (re-applied on each draw cycle)
  const jitterX = Math.floor(Math.random() * 28) - 14;
  const jitterY = Math.floor(Math.random() * 28) - 14;

  for (let y = -tileH; y < canvas.height + tileH * 2; y += tileH) {
    for (let x = -tileW; x < canvas.width + tileW * 2; x += tileW) {
      ctx.save();
      ctx.translate(x + jitterX, y + jitterY);
      ctx.rotate(angleRad);

      lines.forEach((line, idx) => {
        ctx.fillText(line, 0, idx * 18 - ((lines.length - 1) * 18) / 2);
      });

      ctx.restore();
    }
  }
}

// Module-level cache of the public security config (refreshed every 5s)
let _cachedConfig: PublicSecurityConfig | null = null;
let _lastConfigFetch = 0;
const CONFIG_CACHE_TTL_MS = 5_000; // 5 seconds — fast response to admin toggle

async function fetchSecurityConfig(): Promise<PublicSecurityConfig> {
  const now = Date.now();
  if (_cachedConfig && now - _lastConfigFetch < CONFIG_CACHE_TTL_MS) {
    return _cachedConfig;
  }
  try {
    const res = await fetch(buildUrl('/public/security/config'), { credentials: 'omit' });
    if (res.ok) {
      const data = await res.json();
      _cachedConfig = {
        watermarkEnabled: data.watermarkEnabled !== false,
        watermarkModules: Array.isArray(data.watermarkModules) ? data.watermarkModules : ['exam', 'results', 'documents', 'classes', 'dashboard'],
        watermarkIntervalSec: typeof data.watermarkIntervalSec === 'number' ? data.watermarkIntervalSec : 8,
      };
      _lastConfigFetch = now;
      return _cachedConfig;
    }
  } catch {
    // Backend offline — use permissive defaults so watermark still shows
  }
  return { watermarkEnabled: true, watermarkModules: ['exam', 'results', 'documents', 'classes', 'dashboard'], watermarkIntervalSec: 8 };
}

const DynamicWatermark: React.FC<DynamicWatermarkProps> = ({
  module = 'general',
  userId: userIdProp,
  orgName: orgNameProp,
  customText = '',
  color: colorProp,
  isBold = true,
  opacity = 0.18,
  includeCandidate = true,
  includeTimestamp = true,
  includeSession = true,
  intervalMs = 8_000,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { userId: ctxUserId, sessionId: ctxSessionId, orgName: ctxOrgName } = useSecurityContext();

  // Tenant org state — refreshed on storage events for multi-tenant accuracy
  const [tenantInfo, setTenantInfo] = useState(() => resolveTenantOrgName(ctxOrgName));

  // Admin-controlled visibility: null = pending first check, true/false = known state
  const [isWatermarkActive, setIsWatermarkActive] = useState<boolean | null>(null);

  // Fetch security config on mount and every 5s to respond to admin toggles quickly
  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      const config = await fetchSecurityConfig();
      if (cancelled) return;
      const moduleActive = config.watermarkEnabled && (
        module === 'general' || config.watermarkModules.includes(module)
      );
      setIsWatermarkActive(moduleActive);
    };

    // First fetch — immediately
    loadConfig();
    // Poll every 5s so admin disable takes effect within 5 seconds
    const pollInterval = setInterval(() => {
      _lastConfigFetch = 0; // force cache bypass
      loadConfig();
    }, CONFIG_CACHE_TTL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [module]);

  // Listen to sessionStorage changes from other parts of the app (e.g., tenant switch)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === 'tenant_info' ||
        e.key === 'tenantName' ||
        e.key === 'tenantBrandTitle' ||
        e.key === 'orgName' ||
        e.key === 'tenantWatermarkColor'
      ) {
        setTenantInfo(resolveTenantOrgName(ctxOrgName));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [ctxOrgName]);

  // Re-resolve when context org name changes
  useEffect(() => {
    setTenantInfo(resolveTenantOrgName(ctxOrgName));
  }, [ctxOrgName]);

  const resolvedOrgName = orgNameProp || tenantInfo.orgName;
  // Color priority: explicit prop > tenant primary color > tenant watermark color > default dark
  const resolvedColor = colorProp || tenantInfo.color || '#1a1a2e';

  const userId = userIdProp || ctxUserId || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('userId') || '' : '') || 'Candidate';
  const sessionId = ctxSessionId || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('securitySessionId') || '' : '');

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Still pending first config check — keep canvas hidden
    if (isWatermarkActive === null) return;
    if (!isWatermarkActive) {
      // Immediately clear canvas when watermark is disabled by admin
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = canvas.offsetWidth || window.innerWidth;
        canvas.height = canvas.offsetHeight || window.innerHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    drawWatermark(
      canvas,
      userId,
      sessionId,
      resolvedOrgName,
      customText,
      resolvedColor,
      opacity,
      isBold,
      includeCandidate,
      includeTimestamp,
      includeSession
    );
  }, [userId, sessionId, resolvedOrgName, customText, resolvedColor, opacity, isBold, includeCandidate, includeTimestamp, includeSession, isWatermarkActive]);

  // Initial draw and redraw on resize
  useEffect(() => {
    redraw();

    let resizeRaf: number | null = null;
    const onResize = () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => redraw());
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
    };
  }, [redraw]);

  // Periodic redraw (updates timestamp + jitter)
  useEffect(() => {
    const timerId = setInterval(redraw, intervalMs);
    return () => clearInterval(timerId);
  }, [redraw, intervalMs]);

  return (
    <canvas
      ref={canvasRef}
      className="shine-watermark-canvas"
      aria-hidden="true"
      role="presentation"
    />
  );
};

export default DynamicWatermark;
