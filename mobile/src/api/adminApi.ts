import { apiClient } from "./client";

export const adminApi = {
  async getDashboardStats(): Promise<any> {
    return apiClient.get("/admin/dashboard");
  },

  async getExams(): Promise<{ exams: any[] }> {
    return apiClient.get("/admin/exams");
  },

  async getUsers(params?: { role?: string; search?: string }): Promise<{ users: any[] }> {
    return apiClient.get("/admin/users", { params });
  },

  async getViolations(): Promise<{ violations: any[] }> {
    return apiClient.get("/admin/violations");
  },

  async unblockUser(userId: string): Promise<{ message: string }> {
    return apiClient.post(`/admin/users/${userId}/unblock`);
  },

  async getSecuritySettings(): Promise<{ settings: any }> {
    return apiClient.get("/admin/security-settings");
  },
};
