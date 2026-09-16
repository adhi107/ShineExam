/**
 * SecurityContext
 * ───────────────
 * Holds session-level security metadata (userId, sessionId, orgName).
 * Wrap your app (or a protected subtree) with <SecurityProvider> so that
 * DynamicWatermark and SensitiveContent can read these values without
 * prop-drilling.
 *
 * orgName is now resolved dynamically from the active tenant (sessionStorage
 * tenant_info / tenantBrandTitle / tenantName), so watermarks always show
 * the correct organisation name for every tenant.
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

/** Resolve tenant org name from all available sessionStorage sources */
function resolveTenantOrgNameFromStorage(): string {
  if (typeof sessionStorage === 'undefined') return '';
  try {
    const storedTenant = sessionStorage.getItem('tenant_info');
    if (storedTenant) {
      const parsed = JSON.parse(storedTenant);
      const name = parsed.brandTitle || parsed.name || '';
      if (name && !name.toLowerCase().includes('shine') && name !== 'Examination Portal') {
        return name;
      }
      // If it IS a shine org, still return it for the watermark
      if (name) return name;
    }
    return (
      sessionStorage.getItem('tenantBrandTitle') ||
      sessionStorage.getItem('tenantName') ||
      sessionStorage.getItem('orgName') ||
      ''
    );
  } catch {
    return '';
  }
}

const SecurityContext = createContext<SecurityContextValue>({
  userId: '',
  sessionId: '',
  orgName: '',
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
  // Dynamically resolved from tenant sessionStorage — never hardcoded
  const [orgName, setOrgName] = useState<string>(() => resolveTenantOrgNameFromStorage());

  /** Restore session on page refresh and resolve org name from active tenant. */
  useEffect(() => {
    const savedUser = sessionStorage.getItem('userId') || '';
    const savedSession = sessionStorage.getItem('securitySessionId') || '';
    if (savedUser) setUserId(savedUser);
    if (savedSession) {
      setSessionId(savedSession);
    } else if (savedUser) {
      const local = generateLocalSessionId();
      sessionStorage.setItem('securitySessionId', local);
      setSessionId(local);
    }

    // Resolve org name on mount
    const resolved = resolveTenantOrgNameFromStorage();
    if (resolved) setOrgName(resolved);
  }, []);

  /** Listen for tenant changes from other tabs or components writing to sessionStorage. */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === 'tenant_info' ||
        e.key === 'tenantName' ||
        e.key === 'tenantBrandTitle' ||
        e.key === 'orgName'
      ) {
        const resolved = resolveTenantOrgNameFromStorage();
        if (resolved) setOrgName(resolved);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /** Poll sessionStorage every 3s to pick up same-tab tenant changes (e.g. after login). */
  useEffect(() => {
    const interval = setInterval(() => {
      const resolved = resolveTenantOrgNameFromStorage();
      if (resolved) {
        setOrgName(prev => (prev !== resolved ? resolved : prev));
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const initSession = useCallback(async (uid: string, org?: string): Promise<void> => {
    setUserId(uid);

    // Resolve org name from argument or active tenant
    const resolvedOrg = org || resolveTenantOrgNameFromStorage() || uid;
    setOrgName(resolvedOrg);

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
    setOrgName('');
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
