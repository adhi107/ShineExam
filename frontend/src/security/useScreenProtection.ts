/**
 * useScreenProtection
 * ───────────────────
 * Core security hook: Immediately detects and blocks account on:
 *  - PrintScreen (keydown & keyup)
 *  - Alt+PrintScreen, Win+Shift+S, Cmd+Shift+3/4/5/6, Ctrl+P
 *  - Window Blur (user triggers Snipping Tool / external screenshot overlay)
 *  - Tab switch / Page visibility change
 *  - Screen sharing via getDisplayMedia
 *  - beforeprint event
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface ScreenProtectionState {
  isPageHidden: boolean;
  isScreenSharing: boolean;
  isPrintScreenAttempted: boolean;
  lockRemainingSeconds: number;
  isWindowBlurred: boolean;
  unlockScreenshotBlock: () => void;
}

interface UseScreenProtectionOptions {
  blockCopy?: boolean;
  blockContextMenu?: boolean;
  blockDrag?: boolean;
  flashOnPrintScreen?: boolean;
  screenshotLockDurationSec?: number;
  enableBlurDetection?: boolean;
  onScreenShareStart?: () => void;
  onScreenShareStop?: () => void;
  onPageHide?: () => void;
  onPageShow?: () => void;
  onPrintScreenAttempt?: () => void;
}

/** Flash a solid black overlay for `ms` milliseconds to dirty the captured frame. */
function flashBlackOverlay(ms = 800): void {
  const existing = document.getElementById('shine-prtsc-flash');
  if (existing) return;

  const overlay = document.createElement('div');
  overlay.id = 'shine-prtsc-flash';
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'width:100vw',
    'height:100vh',
    'z-index:2147483647',
    'background:#000000',
    'pointer-events:none',
    'opacity:1',
    'transition:opacity 0.2s ease',
  ].join(';');
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 250);
  }, ms);
}

/** Overwrite the OS clipboard after a PrintScreen keypress. */
async function tryOverwriteClipboard(): Promise<void> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(
        '[🔒 Screenshot Blocked by Shine Exam Security — Account has been permanently suspended]'
      );
    }
  } catch {
    // Best-effort
  }
}

export function useScreenProtection(
  options: UseScreenProtectionOptions = {}
): ScreenProtectionState {
  const {
    blockCopy = true,
    blockContextMenu = true,
    blockDrag = true,
    flashOnPrintScreen = true,
    screenshotLockDurationSec = 300,
    enableBlurDetection = true,
    onScreenShareStart,
    onScreenShareStop,
    onPageHide,
    onPageShow,
    onPrintScreenAttempt,
  } = options;

  const [isPageHidden, setIsPageHidden] = useState<boolean>(
    typeof document !== 'undefined' ? document.hidden : false
  );
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [isPrintScreenAttempted, setIsPrintScreenAttempted] = useState<boolean>(false);
  const [lockRemainingSeconds, setLockRemainingSeconds] = useState<number>(0);
  const [isWindowBlurred, setIsWindowBlurred] = useState<boolean>(false);

  const streamTrackerRef = useRef<MediaStream | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const unlockScreenshotBlock = useCallback(() => {
    setIsPrintScreenAttempted(false);
    setLockRemainingSeconds(0);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const isInputTarget = (target: EventTarget | null): boolean => {
    if (!target) return false;
    const el = target as HTMLElement;
    return (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el.isContentEditable
    );
  };

  const preventCopy = useCallback((e: Event) => {
    if (isInputTarget(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const preventDrag = useCallback((e: Event) => {
    if (isInputTarget(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const preventContextMenu = useCallback((e: MouseEvent) => {
    if (isInputTarget(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ── PrintScreen / Screenshot Detection ──────────────────────────────────
  const handlePrintScreenDetected = useCallback(() => {
    if (flashOnPrintScreen) flashBlackOverlay(800);
    tryOverwriteClipboard();

    setIsPrintScreenAttempted(true);
    setLockRemainingSeconds(screenshotLockDurationSec);

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    let remaining = screenshotLockDurationSec;
    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        setIsPrintScreenAttempted(false);
        setLockRemainingSeconds(0);
      } else {
        setLockRemainingSeconds(remaining);
      }
    }, 1000);

    onPrintScreenAttempt?.();
  }, [flashOnPrintScreen, screenshotLockDurationSec, onPrintScreenAttempt]);

  // ── Page Visibility change ──────────────────────────────────────────────
  useEffect(() => {
    const onVisibilityChange = () => {
      const hidden = document.hidden;
      setIsPageHidden(hidden);
      if (hidden) {
        handlePrintScreenDetected();
        onPageHide?.();
      } else {
        onPageShow?.();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [handlePrintScreenDetected, onPageHide, onPageShow]);

  // ── Window blur/focus (Snipping Tool trigger, Alt+Tab, focus loss) ───────
  useEffect(() => {
    const onBlur = () => {
      if (!enableBlurDetection) return;
      // Do not trigger screenshot violation if focus shifted to an embedded video iframe (YouTube/Vimeo)
      setTimeout(() => {
        if (document.activeElement && document.activeElement.tagName === 'IFRAME') {
          return;
        }
        setIsWindowBlurred(true);
        handlePrintScreenDetected();
      }, 50);
    };
    const onFocus = () => {
      setIsWindowBlurred(false);
    };
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [enableBlurDetection, handlePrintScreenDetected]);

  // ── Print event protection ──────────────────────────────────────────────
  useEffect(() => {
    const beforePrint = () => {
      handlePrintScreenDetected();
    };
    window.addEventListener('beforeprint', beforePrint);
    return () => window.removeEventListener('beforeprint', beforePrint);
  }, [handlePrintScreenDetected]);

  // ── Copy / drag / context-menu listeners ─────────────────────────────────
  useEffect(() => {
    if (blockCopy) {
      document.addEventListener('copy', preventCopy, { capture: true });
      document.addEventListener('cut', preventCopy, { capture: true });
    }
    if (blockDrag) {
      document.addEventListener('dragstart', preventDrag, { capture: true });
    }
    if (blockContextMenu) {
      document.addEventListener('contextmenu', preventContextMenu, { capture: true });
    }
    return () => {
      document.removeEventListener('copy', preventCopy, { capture: true });
      document.removeEventListener('cut', preventCopy, { capture: true });
      document.removeEventListener('dragstart', preventDrag, { capture: true });
      document.removeEventListener('contextmenu', preventContextMenu, { capture: true });
    };
  }, [blockCopy, blockContextMenu, blockDrag, preventCopy, preventDrag, preventContextMenu]);

  // ── Comprehensive Keyboard Guards ───────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key || '';
      const code = e.code || '';

      // 1. PrintScreen (all variants, Snapshot)
      if (key === 'PrintScreen' || code === 'PrintScreen' || key === 'Snapshot') {
        e.preventDefault();
        e.stopPropagation();
        handlePrintScreenDetected();
        return;
      }
      // 2. Alt + PrintScreen
      if (e.altKey && (key === 'PrintScreen' || code === 'PrintScreen' || key === 'Snapshot')) {
        e.preventDefault();
        e.stopPropagation();
        handlePrintScreenDetected();
        return;
      }
      // 3. Win+Shift+S / Meta+Shift+S (Windows Snipping Tool)
      if (e.shiftKey && (e.metaKey || e.ctrlKey) && (key.toLowerCase() === 's' || code === 'KeyS')) {
        e.preventDefault();
        e.stopPropagation();
        handlePrintScreenDetected();
        return;
      }
      // 4. macOS Cmd+Shift+3 / Cmd+Shift+4 / Cmd+Shift+5 / Cmd+Shift+6
      if (e.metaKey && e.shiftKey && ['3', '4', '5', '6'].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
        handlePrintScreenDetected();
        return;
      }
      // 5. Ctrl+P (Print)
      if ((e.ctrlKey || e.metaKey) && (key.toLowerCase() === 'p' || code === 'KeyP')) {
        e.preventDefault();
        e.stopPropagation();
        handlePrintScreenDetected();
        return;
      }
      // 6. Ctrl+S (Save Page)
      if ((e.ctrlKey || e.metaKey) && (key.toLowerCase() === 's' || code === 'KeyS')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // 7. Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && (key.toLowerCase() === 'u' || code === 'KeyU')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // 8. F12 & DevTools Shortcuts
      if (key === 'F12' || code === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (key.toUpperCase() === 'I' || key.toUpperCase() === 'C' || key.toUpperCase() === 'J')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key || '';
      const code = e.code || '';
      if (key === 'PrintScreen' || code === 'PrintScreen' || key === 'Snapshot') {
        handlePrintScreenDetected();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('keyup', handleKeyUp, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('keyup', handleKeyUp, { capture: true });
    };
  }, [handlePrintScreenDetected]);

  // ── Screen Sharing Detection via MediaDevices ────────────────────────────
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return;

    const originalGetDisplayMedia =
      navigator.mediaDevices.getDisplayMedia?.bind(navigator.mediaDevices);

    if (!originalGetDisplayMedia) return;

    navigator.mediaDevices.getDisplayMedia = async (
      constraints?: DisplayMediaStreamOptions
    ): Promise<MediaStream> => {
      const stream = await originalGetDisplayMedia(constraints);
      streamTrackerRef.current = stream;
      setIsScreenSharing(true);
      onScreenShareStart?.();

      stream.getTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          const allEnded = stream.getTracks().every((t) => t.readyState === 'ended');
          if (allEnded) {
            streamTrackerRef.current = null;
            setIsScreenSharing(false);
            onScreenShareStop?.();
          }
        });
      });

      return stream;
    };

    return () => {
      if (originalGetDisplayMedia) {
        navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
      }
      streamTrackerRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onScreenShareStart, onScreenShareStop]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      document.getElementById('shine-prtsc-flash')?.remove();
    };
  }, []);

  return {
    isPageHidden,
    isScreenSharing,
    isPrintScreenAttempted,
    lockRemainingSeconds,
    isWindowBlurred,
    unlockScreenshotBlock,
  };
}
