import AsyncStorage from "@react-native-async-storage/async-storage";

export const StorageKeys = {
  AUTH_USER: "shine_auth_user",
  USER_ID: "shine_user_id",
  USER_ROLE: "shine_user_role",
  TENANT_ID: "shine_tenant_id",
  ACTIVE_TENANT_ID: "shine_active_tenant_id",
  SESSION_ID: "shine_session_id",
  TENANT_INFO: "shine_tenant_info",
  SUSPENDED_FLAG: "shine_account_suspended",
  EXAM_PROGRESS_PREFIX: "shine_exam_progress_",
  OFFLINE_QUEUE: "shine_offline_answer_queue",
};

export const Storage = {
  async setItem(key: string, value: any): Promise<void> {
    try {
      const stringValue = typeof value === "string" ? value : JSON.stringify(value);
      await AsyncStorage.setItem(key, stringValue);
    } catch (e) {
      console.warn("Storage setItem error:", e);
    }
  },

  async getItem<T = string>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      if (!value) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    } catch (e) {
      console.warn("Storage getItem error:", e);
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn("Storage removeItem error:", e);
    }
  },

  /**
   * Scoped Multi-Tenant Cache key builder
   * Prevents cross-tenant state leakage (e.g. tenant:A:exams vs tenant:B:exams)
   */
  getTenantCacheKey(tenantId: string, resource: string): string {
    const cleanTenant = (tenantId || "default").trim().toLowerCase();
    return `cache:tenant:${cleanTenant}:${resource}`;
  },

  async setTenantCache(tenantId: string, resource: string, data: any): Promise<void> {
    const key = this.getTenantCacheKey(tenantId, resource);
    await this.setItem(key, {
      data,
      cachedAt: Date.now(),
    });
  },

  async getTenantCache<T>(tenantId: string, resource: string, maxAgeMs: number = 300000): Promise<T | null> {
    const key = this.getTenantCacheKey(tenantId, resource);
    const cached = await this.getItem<{ data: T; cachedAt: number }>(key);
    if (!cached) return null;
    if (Date.now() - cached.cachedAt > maxAgeMs) {
      await this.removeItem(key);
      return null;
    }
    return cached.data;
  },

  async clearUserSession(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        StorageKeys.AUTH_USER,
        StorageKeys.USER_ID,
        StorageKeys.USER_ROLE,
        StorageKeys.SESSION_ID,
        StorageKeys.SUSPENDED_FLAG,
      ]);
    } catch (e) {
      console.warn("Storage clearUserSession error:", e);
    }
  },
};
