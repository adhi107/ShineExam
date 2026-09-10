import { apiClient } from "./client";
import { User, UserRole } from "../types/user";
import { TenantInfo } from "../types/tenant";

export const authApi = {
  async getTenantBranding(tenantId: string = "default"): Promise<{ branding: TenantInfo }> {
    return apiClient.get<{ branding: TenantInfo }>(`/auth/tenant-branding`, {
      params: { tenantId },
    });
  },

  async login(payload: {
    userId: string;
    password: string;
    role: UserRole;
  }): Promise<{ user: User }> {
    return apiClient.post<{ user: User }>("/auth/login", payload);
  },

  async changePassword(payload: {
    userId: string;
    oldPassword: string;
    newPassword: string;
    role: string;
  }): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>("/auth/change-password", payload);
  },
};
