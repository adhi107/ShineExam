import { apiClient } from "./client";

export interface SuperAdminStats {
  totalOrganizations: number;
  activeOrganizations: number;
  totalAdmins: number;
  totalCandidates: number;
  totalExams: number;
  totalAttempts: number;
  totalViolations: number;
}

export interface OrganizationItem {
  id: string;
  tenantId: string;
  name: string;
  brandTitle?: string;
  logoUrl?: string;
  status: "active" | "inactive" | "suspended";
  primaryColor?: string;
  adminsCount?: number;
  candidatesCount?: number;
  examsCount?: number;
  attemptsCount?: number;
  contactEmail?: string;
  contactPhone?: string;
  createdAt?: string;
}

export const superAdminApi = {
  async getDashboardStats(): Promise<{ stats: SuperAdminStats; organizations: OrganizationItem[] }> {
    return apiClient.get("/super-admin/dashboard/stats");
  },

  async getOrganizations(params?: { search?: string; status?: string }): Promise<{
    organizations: OrganizationItem[];
    totalCount: number;
  }> {
    return apiClient.get("/super-admin/organizations", { params });
  },

  async createOrganization(payload: Partial<OrganizationItem>): Promise<{ organization: OrganizationItem }> {
    return apiClient.post("/super-admin/organizations", payload);
  },

  async updateOrganization(
    orgId: string,
    payload: Partial<OrganizationItem>
  ): Promise<{ message: string; organization: OrganizationItem }> {
    return apiClient.put(`/super-admin/organizations/${orgId}`, payload);
  },

  async deleteOrganization(orgId: string): Promise<{ message: string }> {
    return apiClient.delete(`/super-admin/organizations/${orgId}`);
  },

  async getTenantOptions(): Promise<{ options: Array<{ label: string; value: string; name: string }> }> {
    return apiClient.get("/super-admin/tenants/options");
  },
};
