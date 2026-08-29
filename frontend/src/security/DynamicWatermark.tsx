/**
 * DynamicWatermark
 * ────────────────
 * Renders a continuously updating, semi-transparent canvas watermark over
 * sensitive content. Contains the logged-in user ID, session ID (truncated),
 * current timestamp, custom text, and organization name with bold colors.
 *
 * Design principles:
 *  - Canvas-based: cannot be hidden by toggling a single DOM element's visibility
 *  - Redraws every 8-15 seconds with a new timestamp and random position offset
 *  - pointer-events: none so it doesn't interfere with candidate interaction
 *  - Supports customizable bold colors, opacity, and custom text stamps
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { useSecurityContext } from './SecurityContext';
import './security.css';

export interface DynamicWatermarkProps {
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
  /** Opacity 0–1; default 0.14 */
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

  if (lines.length === 0) {
    lines.push('CONFIDENTIAL • SHINE EXAM');
  }

  ctx.globalAlpha = Math.max(0.04, Math.min(0.95, opacity));
  ctx.fillStyle = color || '#1a1a2e';
  const weight = isBold ? '900' : '700';
  ctx.font = `${weight} 13.5px "Inter", "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';

  // Tile the watermark in a diagonal grid across the canvas
  const tileW = 340;
  const tileH = Math.max(130, lines.length * 28 + 40);
  const angleRad = -Math.PI / 6; // -30 degrees

  // Random positional jitter (re-applied on each draw cycle)
  const jitterX = Math.floor(Math.random() * 30) - 15;
  const jitterY = Math.floor(Math.random() * 30) - 15;

  for (let y = -tileH; y < canvas.height + tileH * 2; y += tileH) {
    for (let x = -tileW; x < canvas.width + tileW * 2; x += tileW) {
      ctx.save();
      ctx.translate(x + jitterX, y + jitterY);
      ctx.rotate(angleRad);

      lines.forEach((line, idx) => {
        ctx.fillText(line, 0, idx * 19 - ((lines.length - 1) * 19) / 2);
      });

      ctx.restore();
    }
  }
}

const DynamicWatermark: React.FC<DynamicWatermarkProps> = ({
  userId: userIdProp,
  orgName: orgNameProp,
  customText = '',
  color = '#1a1a2e',
  isBold = true,
  opacity = 0.18,
  includeCandidate = true,
  includeTimestamp = true,
  includeSession = true,
  intervalMs = 8_000,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { userId: ctxUserId, sessionId: ctxSessionId, orgName: ctxOrgName } = useSecurityContext();

  const userId = userIdProp || ctxUserId || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('userId') || '' : '') || 'Candidate';
  const sessionId = ctxSessionId || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('securitySessionId') || '' : '');
  const orgName = orgNameProp || ctxOrgName || 'Shine Exam';

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawWatermark(
      canvas,
      userId,
      sessionId,
      orgName,
      customText,
      color,
      opacity,
      isBold,
      includeCandidate,
      includeTimestamp,
      includeSession
    );
  }, [userId, sessionId, orgName, customText, color, opacity, isBold, includeCandidate, includeTimestamp, includeSession]);

  // Initial draw and redraw on resize
  useEffect(() => {
    redraw();

    const onResize = () => redraw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
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

