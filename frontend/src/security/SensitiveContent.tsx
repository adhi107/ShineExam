/**
 * SensitiveContent
 * ─────────────────
 * Full-protection wrapper:
 * When a screenshot or screen recording violation is detected:
 *  1. Calls backend /security/violation/block to permanently suspend the user account.
 *  2. Displays a full-screen locked popup: "Your account is suspended. Contact the admin for unblock."
 *  3. Admin can unblock the user from User Management in Admin Dashboard.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useScreenProtection } from './useScreenProtection';
import { useVideoOverlayProtection } from './useVideoOverlayProtection';
import { useSecurityContext } from './SecurityContext';
import DynamicWatermark from './DynamicWatermark';
import './security.css';

interface SensitiveContentProps {
  children: React.ReactNode;
  userId?: string;
  showWatermark?: boolean;
  hideOnTabSwitch?: boolean;
  blurOnTabSwitch?: boolean;
  shieldOnScreenShare?: boolean;
  /** Hide content when browser window loses focus (default: true) */
  hideOnWindowBlur?: boolean;
  /** Enable the GPU video overlay trick (default: true) */
  enableVideoOverlay?: boolean;
  className?: string;
  shieldMessage?: string;
}

const SensitiveContent: React.FC<SensitiveContentProps> = ({
  children,
  userId: userIdProp,
  showWatermark = true,
  hideOnTabSwitch = true,
  blurOnTabSwitch = false,
  shieldOnScreenShare = true,
  hideOnWindowBlur = true,
  enableVideoOverlay = true,
  className = '',
  shieldMessage = 'Content protected for exam security.',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { userId: ctxUserId, sessionId, clearSession } = useSecurityContext();
  const userId = userIdProp || ctxUserId || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('userId') || '' : '');

  const [isPermanentlySuspended, setIsPermanentlySuspended] = useState<boolean>(false);
  const [suspensionReason, setSuspensionReason] = useState<string>('');

  const triggerPermanentAccountBlock = useCallback(async (reason: 'screenshot' | 'recording') => {
    setIsPermanentlySuspended(true);
    setSuspensionReason(reason);

    const activeUserId = userId || sessionStorage.getItem('userId') || '';
    if (!activeUserId) return;

    sessionStorage.setItem('account_permanently_blocked', 'true');
    const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:5000';
    const payload = JSON.stringify({
      userId: activeUserId,
      reason,
      sessionId: sessionId || sessionStorage.getItem('securitySessionId') || '',
    });

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(`${apiBase}/security/violation/block`, blob);
      } catch {}
    }

    try {
      await fetch(`${apiBase}/security/violation/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
    } catch {
      // Backend logged best-effort
    }
  }, [userId, sessionId]);


  const {
    isPageHidden,
    isScreenSharing,
    isPrintScreenAttempted,
    isWindowBlurred,
  } = useScreenProtection({
    blockCopy: true,
    blockContextMenu: true,
    blockDrag: true,
    flashOnPrintScreen: true,
    onPrintScreenAttempt: () => {
      triggerPermanentAccountBlock('screenshot');
    },
    onScreenShareStart: () => {
      triggerPermanentAccountBlock('recording');
    },
  });

  // Check if screen sharing started
  useEffect(() => {
    if (isScreenSharing && !isPermanentlySuspended) {
      triggerPermanentAccountBlock('recording');
    }
  }, [isScreenSharing, isPermanentlySuspended, triggerPermanentAccountBlock]);

  // Check if printscreen attempted
  useEffect(() => {
    if (isPrintScreenAttempted && !isPermanentlySuspended) {
      triggerPermanentAccountBlock('screenshot');
    }
  }, [isPrintScreenAttempted, isPermanentlySuspended, triggerPermanentAccountBlock]);

  // Check if window blurred (Snipping Tool overlay / Alt+Tab) during exam
  useEffect(() => {
    if (hideOnWindowBlur && isWindowBlurred && !isPermanentlySuspended) {
      triggerPermanentAccountBlock('screenshot');
    }
  }, [hideOnWindowBlur, isWindowBlurred, isPermanentlySuspended, triggerPermanentAccountBlock]);

  // Check if tab switched / minimized during exam
  useEffect(() => {
    if (hideOnTabSwitch && isPageHidden && !isPermanentlySuspended) {
      triggerPermanentAccountBlock('screenshot');
    }
  }, [hideOnTabSwitch, isPageHidden, isPermanentlySuspended, triggerPermanentAccountBlock]);

  // Hardware GPU video overlay
  useVideoOverlayProtection(enableVideoOverlay);


  const shouldShieldShare = shieldOnScreenShare && isScreenSharing;
  const shouldHideTab     = hideOnTabSwitch && isPageHidden && !blurOnTabSwitch;
  const shouldBlurTab     = blurOnTabSwitch && isPageHidden;
  const shouldHideBlur    = hideOnWindowBlur && isWindowBlurred;

  // Full blackout if suspended, screenshot attempted, window blurred, tab hidden, or screen shared
  const isShielded = isPermanentlySuspended || shouldShieldShare || shouldHideTab || shouldHideBlur;
  const isBlurred  = shouldBlurTab && !isShielded;

  const handleExitToLogin = () => {
    clearSession();
    sessionStorage.clear();
    window.location.href = '/login';
  };

  const wrapperClasses = [
    'shine-sensitive-content',
    isBlurred ? 'shine-sensitive-content--blurred' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={containerRef}
      className={wrapperClasses}
      onCopy={(e) => {
        const t = e.target as HTMLElement;
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t.isContentEditable) return;
        e.preventDefault();
      }}
      onCut={(e) => {
        const t = e.target as HTMLElement;
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t.isContentEditable) return;
        e.preventDefault();
      }}
      onDragStart={(e) => {
        const t = e.target as HTMLElement;
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t.isContentEditable) return;
        e.preventDefault();
      }}
      onContextMenu={(e) => {
        const t = e.target as HTMLElement;
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t.isContentEditable) return;
        e.preventDefault();
      }}
    >
      {/* ── Protected content (COMPLETELY unmounted when shielded/suspended) ── */}
      {!isShielded && children}

      {/* ── Anti-capture GPU compositing overlay ── */}
      {!isShielded && (
        <div className="shine-anti-capture-layer" aria-hidden="true" />
      )}

      {/* ── Full-Screen Suspended / Shield Overlay Modal ── */}
      {isShielded && (
        <div className="shine-screen-shield shine-screen-suspended-backdrop" role="alert" aria-live="assertive">
          <div className="shine-screen-shield__inner shine-suspended-modal-card">
            <div className="shine-screen-shield__icon" aria-hidden="true">
              🚫
            </div>
            
            <h2 className="shine-screen-shield__title shine-suspended-title">
              ACCOUNT SUSPENDED
            </h2>

            <div className="shine-suspended-highlight-msg">
              Your account is suspended. Contact the admin for unblock.
            </div>

            <div className="shine-lock-note-box">
              <strong>REASON:</strong> Security violation detected ({suspensionReason === 'recording' ? 'Screen Recording / Sharing' : 'Unauthorized Screenshot attempt'}). Your exam session has been terminated and your portal account is permanently blocked.
            </div>

            <div className="shine-shield-action-box">
              <button
                type="button"
                className="shine-shield-unlock-btn"
                onClick={handleExitToLogin}
              >
                Exit to Login
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dynamic watermark (always rendered) ── */}
      {showWatermark && <DynamicWatermark />}
    </div>
  );
};

export default SensitiveContent;
