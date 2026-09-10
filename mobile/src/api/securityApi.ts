import { apiClient } from "./client";
import { SecurityConfig } from "../types/security";

export const securityApi = {
  async getPublicSecurityConfig(): Promise<SecurityConfig> {
    return apiClient.get<SecurityConfig>("/public/security/config");
  },

  async createSession(userId: string): Promise<{ sessionId: string; expiresAt: string }> {
    return apiClient.post("/security/session", { userId });
  },

  async validateSession(sessionId: string, userId: string): Promise<{ valid: boolean }> {
    return apiClient.get("/security/session/validate", {
      params: { sessionId, userId },
    });
  },

  async invalidateSession(userId: string, sessionId: string): Promise<{ invalidated: boolean }> {
    return apiClient.post("/security/session/invalidate", { userId, sessionId });
  },

  async recordAuditEvent(payload: {
    userId: string;
    sessionId?: string;
    event: string;
    context?: Record<string, any>;
  }): Promise<{ logged: boolean }> {
    return apiClient.post("/security/audit", payload);
  },

  async reportViolation(payload: {
    userId: string;
    reason: "screenshot" | "recording";
    sessionId?: string;
    module: string;
  }): Promise<{
    blocked: boolean;
    warned: boolean;
    attempt: number;
    allowedAttempts?: number;
    remainingAttempts?: number;
    message: string;
  }> {
    return apiClient.post("/security/violation/block", payload);
  },
};
