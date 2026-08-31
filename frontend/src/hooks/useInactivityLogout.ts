/**
 * useInactivityLogout
 * ───────────────────
 * Tracks user interaction (mouse, keyboard, click, touch, scroll).
 * When idle time exceeds the configured timeout, logs the user out
 * and clears session credentials with an expiration alert.
 */

import { useEffect, useRef, useCallback } from 'react';
import { API_BASE } from '../services/api';

interface InactivityOptions {
  onLogout: () => void;
  isLoggedIn: boolean;
}

export function useInactivityLogout({ onLogout, isLoggedIn }: InactivityOptions): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleMinutesRef = useRef<number>(15);
  const enabledRef = useRef<boolean>(true);

  // Fetch active system auto-logout configuration
  useEffect(() => {
    fetch(`${API_BASE}/public/security/config`)
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.autoLogoutMinutes === 'number') {
          idleMinutesRef.current = data.autoLogoutMinutes;
        }
        if (typeof data.autoLogoutEnabled === 'boolean') {
          enabledRef.current = data.autoLogoutEnabled;
        }
      })
      .catch(() => {
        // Fallback default 15 minutes
      });
  }, []);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (!isLoggedIn || !enabledRef.current) return;

    const timeoutMs = (idleMinutesRef.current || 15) * 60 * 1000;

    timeoutRef.current = setTimeout(() => {
      if (!isLoggedIn) return;
      const mins = idleMinutesRef.current;
      sessionStorage.clear();
      sessionStorage.setItem("inactivity_logout_alert", String(mins));
      onLogout();
    }, timeoutMs);

  }, [isLoggedIn, onLogout]);

  const lastActivityRef = useRef<number>(0);

  useEffect(() => {
    if (!isLoggedIn) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handleActivity = () => {
      const now = Date.now();
      // Throttle rapid events (like continuous mousemove or scrolling) to once per 2 seconds
      if (now - lastActivityRef.current < 2000) {
        return;
      }
      lastActivityRef.current = now;
      resetTimer();
    };

    activityEvents.forEach((ev) => {
      window.addEventListener(ev, handleActivity, { passive: true });
    });

    // Start timer on mount
    resetTimer();

    return () => {
      activityEvents.forEach((ev) => {
        window.removeEventListener(ev, handleActivity);
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isLoggedIn, resetTimer]);
}
