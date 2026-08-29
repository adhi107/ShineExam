/**
 * SensitiveContent
 * ─────────────────
 * Full-protection wrapper:
 * On screenshot or screen recording violation:
 *  1. Checks if current module is enabled in screenshotProtectedModules.
 *  2. Calls backend /security/violation/block.
 *  3. If backend returns blocked=true  → full suspension screen (permanent).
 *  4. If backend returns warned=true   → in-screen warning banner (grace attempt),
 *     candidate can continue until the threshold is reached.
 *  5. Respects strictScreenshotLock: if disabled, shows a soft warning only.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useScreenProtection } from './useScreenProtection';
import { useVideoOverlayProtection } from './useVideoOverlayProtection';
import { useSecurityContext } from './SecurityContext';
import DynamicWatermark from './DynamicWatermark';
import { buildUrl } from '../services/api';
import './security.css';

export type ProtectedModuleType = 'exam' | 'results' | 'documents' | 'classes' | 'dashboard';

interface SensitiveContentProps {
  children: React.ReactNode;
  userId?: string;
  module?: ProtectedModuleType;
  showWatermark?: boolean;
  watermarkColor?: string;
  watermarkCustomText?: string;
  watermarkOpacity?: number;
  watermarkIsBold?: boolean;
  hideOnTabSwitch?: boolean;
  blurOnTabSwitch?: boolean;
  shieldOnScreenShare?: boolean;
  /** Hide content when browser window loses focus (default: true) */
  hideOnWindowBlur?: boolean;
  /** Enable the GPU video overlay trick (default: true) */
  enableVideoOverlay?: boolean;
  className?: string;
  shieldMessage?: string;
  /** Exempt violations during exam submission phase */
  exemptOnSubmit?: boolean;
}

interface ViolationResult {
  blocked: boolean;
  warned: boolean;
  attempt: number;
  allowedAttempts: number;
  remainingAttempts: number;
  message: string;
}

const SensitiveContent: React.FC<SensitiveContentProps> = ({
  children,
  userId: userIdProp,
  module = 'exam',
  showWatermark = true,
  watermarkColor,
  watermarkCustomText,
  watermarkOpacity,
  watermarkIsBold = true,
  hideOnTabSwitch = true,
  blurOnTabSwitch = false,
  shieldOnScreenShare = true,
  hideOnWindowBlur = true,
  enableVideoOverlay = true,
  className = '',
  shieldMessage = 'Content protected for exam security.',
  exemptOnSubmit = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { userId: ctxUserId, sessionId, clearSession } = useSecurityContext();
  const userId = userIdProp || ctxUserId || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('userId') || '' : '');

  // === Dynamic Module Protection Status ===
  const [isModuleProtected, setIsModuleProtected] = useState<boolean>(true);

  // === Suspension state (permanent block) ===
  const [isPermanentlySuspended, setIsPermanentlySuspended] = useState<boolean>(false);
  const [suspensionReason, setSuspensionReason] = useState<string>('');

  // === Warning state (grace period — threshold not reached yet) ===
  const [warningBanner, setWarningBanner] = useState<{
    visible: boolean;
    attempt: number;
    allowedAttempts: number;
    remainingAttempts: number;
    message: string;
  } | null>(null);

  // Track in-flight calls to avoid duplicate rapid triggers
  const violationInFlightRef = useRef<boolean>(false);

  // Fetch active public security config to check if this module is protected
  useEffect(() => {
    fetch(buildUrl('/public/security/config'))
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.screenshotProtectedModules)) {
          const protectedList: string[] = data.screenshotProtectedModules;
          setIsModuleProtected(protectedList.includes(module));
        }
      })
      .catch(() => {
        // Fallback: active for exam and results
        setIsModuleProtected(['exam', 'results', 'documents', 'classes'].includes(module));
      });
  }, [module]);

  const callViolationBlock = useCallback(async (reason: 'screenshot' | 'recording'): Promise<ViolationResult | null> => {
    const activeUserId = userId || sessionStorage.getItem('userId') || '';
    if (!activeUserId) return null;

    const payload = JSON.stringify({
      userId: activeUserId,
      reason,
      sessionId: sessionId || sessionStorage.getItem('securitySessionId') || '',
      module,
    });

    // Best-effort beacon
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(buildUrl('/security/violation/block'), blob);
      } catch {}
    }

    // Awaited fetch to get structured response
    try {
      const res = await fetch(buildUrl('/security/violation/block'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (res.ok) {
        return await res.json() as ViolationResult;
      }
    } catch {
      // Backend offline
    }
    return null;
  }, [userId, sessionId, module]);

  const triggerViolation = useCallback(async (reason: 'screenshot' | 'recording') => {
    // Exempt if user is submitting the exam
    if (exemptOnSubmit) return;

    // If this module is not in the protected list, bypass
    if (!isModuleProtected) return;

    // Avoid duplicate rapid calls
    if (violationInFlightRef.current || isPermanentlySuspended) return;
    violationInFlightRef.current = true;

    try {
      const result = await callViolationBlock(reason);
      if (result && result.blocked) {
        setIsPermanentlySuspended(true);
        setSuspensionReason(reason);
        sessionStorage.setItem('account_permanently_blocked', 'true');
        setWarningBanner(null);
      } else if (result && result.warned) {
        setWarningBanner({
          visible: true,
          attempt: result.attempt,
          allowedAttempts: result.allowedAttempts,
          remainingAttempts: result.remainingAttempts,
          message: result.message,
        });
        setTimeout(() => setWarningBanner(null), 8000);
      }
    } finally {
      setTimeout(() => { violationInFlightRef.current = false; }, 2000);
    }
  }, [exemptOnSubmit, isModuleProtected, isPermanentlySuspended, callViolationBlock]);

  const {
    isPageHidden,
    isScreenSharing,
    isPrintScreenAttempted,
    isWindowBlurred,
  } = useScreenProtection({
    blockCopy: isModuleProtected && !exemptOnSubmit,
    blockContextMenu: isModuleProtected && !exemptOnSubmit,
    blockDrag: isModuleProtected && !exemptOnSubmit,
    flashOnPrintScreen: isModuleProtected && !exemptOnSubmit,
    onPrintScreenAttempt: () => {
      if (!exemptOnSubmit && isModuleProtected) {
        triggerViolation('screenshot');
      }
    },
    onScreenShareStart: () => {
      if (!exemptOnSubmit && isModuleProtected) {
        triggerViolation('recording');
      }
    },
  });

  // Check if screen sharing started
  useEffect(() => {
    if (!exemptOnSubmit && isModuleProtected && isScreenSharing && !isPermanentlySuspended) {
      triggerViolation('recording');
    }
  }, [exemptOnSubmit, isModuleProtected, isScreenSharing, isPermanentlySuspended, triggerViolation]);

  // Check if printscreen attempted
  useEffect(() => {
    if (!exemptOnSubmit && isModuleProtected && isPrintScreenAttempted && !isPermanentlySuspended) {
      triggerViolation('screenshot');
    }
  }, [exemptOnSubmit, isModuleProtected, isPrintScreenAttempted, isPermanentlySuspended, triggerViolation]);

  // Hardware GPU video overlay
  useVideoOverlayProtection(enableVideoOverlay && isModuleProtected && !exemptOnSubmit);

  const shouldShieldShare = isModuleProtected && shieldOnScreenShare && isScreenSharing;
  const shouldHideTab     = isModuleProtected && hideOnTabSwitch && isPageHidden && !blurOnTabSwitch;
  const shouldBlurTab     = isModuleProtected && blurOnTabSwitch && isPageHidden;
  const shouldHideBlur    = isModuleProtected && hideOnWindowBlur && isWindowBlurred;

  // Full blackout only if actually permanently suspended
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
        if (!isModuleProtected) return;
        const t = e.target as HTMLElement;
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t.isContentEditable) return;
        e.preventDefault();
      }}
      onCut={(e) => {
        if (!isModuleProtected) return;
        const t = e.target as HTMLElement;
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t.isContentEditable) return;
        e.preventDefault();
      }}
      onDragStart={(e) => {
        if (!isModuleProtected) return;
        const t = e.target as HTMLElement;
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t.isContentEditable) return;
        e.preventDefault();
      }}
      onContextMenu={(e) => {
        if (!isModuleProtected) return;
        const t = e.target as HTMLElement;
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t.isContentEditable) return;
        e.preventDefault();
      }}
    >
      {/* ── Protected content (COMPLETELY unmounted when permanently suspended) ── */}
      {!isShielded && children}

      {/* ── Anti-capture GPU compositing overlay ── */}
      {!isShielded && isModuleProtected && (
        <div className="shine-anti-capture-layer" aria-hidden="true" />
      )}

      {/* ── Warning Banner (Grace period — threshold NOT yet reached) ── */}
      {!isPermanentlySuspended && warningBanner?.visible && (
        <div className="shine-violation-warning-banner" role="alert">
          <div className="shine-violation-warning-inner">
            <div className="shine-violation-warning-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="shine-violation-warning-text">
              <strong>Security Warning — Attempt {warningBanner.attempt} of {warningBanner.allowedAttempts}</strong>
              <span>
                {warningBanner.remainingAttempts > 0
                  ? `${warningBanner.remainingAttempts} attempt${warningBanner.remainingAttempts !== 1 ? 's' : ''} remaining before your account is permanently blocked.`
                  : 'This was your final warning. Next attempt will permanently block your account.'}
              </span>
            </div>
            <button
              type="button"
              className="shine-violation-warning-close"
              onClick={() => setWarningBanner(null)}
              aria-label="Dismiss warning"
            >
              &#x2715;
            </button>
          </div>
        </div>
      )}

      {/* ── Full-Screen Suspended / Shield Overlay Modal ── */}
      {isShielded && (
        <div className="shine-screen-shield shine-screen-suspended-backdrop" role="alert" aria-live="assertive">
          <div className="shine-screen-shield__inner shine-suspended-modal-card">
            <div className="shine-screen-shield__icon" aria-hidden="true">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
              </svg>
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

      {/* ── Dynamic watermark (rendered if enabled) ── */}
      {showWatermark && (
        <DynamicWatermark
          userId={userId}
          color={watermarkColor}
          customText={watermarkCustomText}
          opacity={watermarkOpacity}
          isBold={watermarkIsBold}
        />
      )}
    </div>
  );
};

export default SensitiveContent;
