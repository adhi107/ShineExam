/**
 * SecurityContext
 * ───────────────
 * Holds session-level security metadata (userId, sessionId, orgName).
 * Wrap your app (or a protected subtree) with <SecurityProvider> so that
 * DynamicWatermark and SensitiveContent can read these values without
 * prop-drilling.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { buildUrl } from '../services/api';

export interface SecurityContextValue {
  userId: string;
  sessionId: string;
  orgName: string;
  /** Call this after login to initialise the security context. */
  initSession: (userId: string, orgName?: string) => Promise<void>;
  /** Call this on logout to clear security state. */
  clearSession: () => void;
}

const SecurityContext = createContext<SecurityContextValue>({
  userId: '',
  sessionId: '',
  orgName: 'Shine Exam',
  initSession: async () => {},
  clearSession: () => {},
});

/** Generate a client-side UUID v4 (fallback when backend session is unavailable). */
function generateLocalSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userId, setUserId] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [orgName] = useState<string>('Shine Exam');

  /** Restore session on page refresh. */
  useEffect(() => {
    const savedUser = sessionStorage.getItem('userId') || '';
    const savedSession = sessionStorage.getItem('securitySessionId') || '';
    if (savedUser) setUserId(savedUser);
    if (savedSession) {
      setSessionId(savedSession);
    } else if (savedUser) {
      // Generate a local session id if not already stored
      const local = generateLocalSessionId();
      sessionStorage.setItem('securitySessionId', local);
      setSessionId(local);
    }
  }, []);

  const initSession = useCallback(async (uid: string, org?: string): Promise<void> => {
    setUserId(uid);

    // Try to fetch a server-issued session token; fall back to local UUID.
    let sid = generateLocalSessionId();
    try {
      const resp = await fetch(buildUrl('/security/session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.sessionId) sid = data.sessionId;
      }
    } catch {
      // Backend unavailable — use local UUID; still provides unique watermark ID.
    }

    sessionStorage.setItem('securitySessionId', sid);
    setSessionId(sid);
  }, []);

  const clearSession = useCallback(() => {
    setUserId('');
    setSessionId('');
    sessionStorage.removeItem('securitySessionId');
  }, []);

  return (
    <SecurityContext.Provider value={{ userId, sessionId, orgName, initSession, clearSession }}>
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurityContext = (): SecurityContextValue => useContext(SecurityContext);

export default SecurityContext;
