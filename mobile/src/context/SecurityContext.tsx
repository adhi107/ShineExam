import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { securityApi } from "../api/securityApi";
import { SecurityConfig } from "../types/security";
import { Storage, StorageKeys } from "../utils/storage";

interface SecurityContextValue {
  config: SecurityConfig;
  sessionId: string;
  initSession: (userId: string) => Promise<string>;
  clearSession: () => Promise<void>;
  reportViolation: (
    userId: string,
    reason: "screenshot" | "recording",
    module: string
  ) => Promise<{ blocked: boolean; message: string }>;
}

const DEFAULT_CONFIG: SecurityConfig = {
  autoLogoutEnabled: true,
  autoLogoutMinutes: 15,
  strictScreenshotLock: true,
  screenshotAllowedAttempts: 1,
  screenshotProtectedModules: ["exam", "results", "documents", "classes"],
  watermarkEnabled: true,
  watermarkIntervalSec: 8,
  allowCandidateDocumentView: true,
  allowCandidateDocumentDownload: false,
  watermarkDocuments: true,
};

const SecurityContext = createContext<SecurityContextValue>({
  config: DEFAULT_CONFIG,
  sessionId: "",
  initSession: async () => "",
  clearSession: async () => {},
  reportViolation: async () => ({ blocked: false, message: "" }),
});

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<SecurityConfig>(DEFAULT_CONFIG);
  const [sessionId, setSessionId] = useState<string>("");

  const loadConfig = useCallback(async () => {
    try {
      const serverConfig = await securityApi.getPublicSecurityConfig();
      if (serverConfig) {
        setConfig((prev) => ({ ...prev, ...serverConfig }));
      }
    } catch (e) {
      console.warn("Failed to fetch public security config:", e);
    }
  }, []);

  const initSession = useCallback(async (userId: string): Promise<string> => {
    try {
      const res = await securityApi.createSession(userId);
      const sid = res.sessionId;
      setSessionId(sid);
      await Storage.setItem(StorageKeys.SESSION_ID, sid);
      return sid;
    } catch (e) {
      const fallbackSid = `local_${Date.now()}`;
      setSessionId(fallbackSid);
      return fallbackSid;
    }
  }, []);

  const clearSession = useCallback(async () => {
    const sid = sessionId || (await Storage.getItem<string>(StorageKeys.SESSION_ID));
    const uid = await Storage.getItem<string>(StorageKeys.USER_ID);
    if (sid && uid) {
      securityApi.invalidateSession(uid, sid).catch(() => {});
    }
    setSessionId("");
    await Storage.removeItem(StorageKeys.SESSION_ID);
  }, [sessionId]);

  const reportViolation = useCallback(
    async (userId: string, reason: "screenshot" | "recording", module: string) => {
      try {
        const res = await securityApi.reportViolation({
          userId,
          reason,
          sessionId: sessionId || undefined,
          module,
        });
        return {
          blocked: res.blocked,
          message: res.message,
        };
      } catch (e: any) {
        return {
          blocked: false,
          message: e.message || "Violation reported",
        };
      }
    },
    [sessionId]
  );

  useEffect(() => {
    loadConfig();
    Storage.getItem<string>(StorageKeys.SESSION_ID).then((sid) => {
      if (sid) setSessionId(sid);
    });
  }, [loadConfig]);

  return (
    <SecurityContext.Provider
      value={{
        config,
        sessionId,
        initSession,
        clearSession,
        reportViolation,
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => useContext(SecurityContext);
