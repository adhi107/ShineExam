/**
 * DynamicWatermark
 * ────────────────
 * Renders a continuously updating, semi-transparent canvas watermark over
 * sensitive content. Contains the logged-in user ID, session ID (truncated),
 * current timestamp, and organisation name.
 *
 * Design principles:
 *  - Canvas-based: cannot be hidden by toggling a single DOM element's visibility
 *  - Redraws every 30 seconds with a new timestamp and random position offset
 *  - pointer-events: none so it doesn't interfere with interaction
 *  - Will appear in screenshots / screen recordings — this is intentional
 *  - Does NOT prevent screenshots; it makes captured content attributable
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { useSecurityContext } from './SecurityContext';
import './security.css';

interface DynamicWatermarkProps {
  /** Override userId from context if needed */
  userId?: string;
  /** Override orgName from context if needed */
  orgName?: string;
  /** Opacity 0–1; default 0.14 */
  opacity?: number;
  /** Redraw interval in milliseconds; default 8000 (8s) — keeps timestamp fresh
   *  and shifts position so screenshots always show a unique watermark */
  intervalMs?: number;
}

function drawWatermark(
  canvas: HTMLCanvasElement,
  userId: string,
  sessionId: string,
  orgName: string,
  opacity: number
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

  const shortSession = sessionId ? sessionId.slice(0, 8).toUpperCase() : 'LOCAL';
  const lines = [
    orgName,
    `User: ${userId}`,
    `${dateStr} ${timeStr}`,
    `Session: ${shortSession}`,
  ];

  ctx.globalAlpha = opacity;
  ctx.fillStyle = '#1a1a2e';
  ctx.font = 'bold 13px "Inter", "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';

  // Tile the watermark in a diagonal grid across the canvas
  const tileW = 320;
  const tileH = 140;
  const angleRad = -Math.PI / 6; // -30 degrees

  // Random positional jitter (re-applied on each draw cycle)
  const jitterX = Math.floor(Math.random() * 40) - 20;
  const jitterY = Math.floor(Math.random() * 40) - 20;

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

const DynamicWatermark: React.FC<DynamicWatermarkProps> = ({
  userId: userIdProp,
  orgName: orgNameProp,
  opacity = 0.14,
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
    drawWatermark(canvas, userId, sessionId, orgName, opacity);
  }, [userId, sessionId, orgName, opacity]);

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
