import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { getApiBaseUrl, ENV } from "../config/env";
import { Storage, StorageKeys } from "../utils/storage";

let onAccountSuspendedCallback: ((reason: string) => void) | null = null;
let onUnauthorizedCallback: (() => void) | null = null;

export function setSecurityCallbacks(callbacks: {
  onSuspended: (reason: string) => void;
  onUnauthorized: () => void;
}) {
  onAccountSuspendedCallback = callbacks.onSuspended;
  onUnauthorizedCallback = callbacks.onUnauthorized;
}

// In-flight request deduplication map
const inFlightRequests = new Map<string, Promise<any>>();

// Short TTL memory cache for debouncing rapid identical GET renders
interface CacheEntry {
  data: any;
  timestamp: number;
}
const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1200;

export function clearApiCache() {
  responseCache.clear();
}

const axiosInstance: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: ENV.TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Request Interceptor: Attach Auth & Tenant Headers
axiosInstance.interceptors.request.use(
  async (config) => {
    config.baseURL = getApiBaseUrl();

    const [userId, role, activeTenantId, tenantId] = await Promise.all([
      Storage.getItem<string>(StorageKeys.USER_ID),
      Storage.getItem<string>(StorageKeys.USER_ROLE),
      Storage.getItem<string>(StorageKeys.ACTIVE_TENANT_ID),
      Storage.getItem<string>(StorageKeys.TENANT_ID),
    ]);

    if (userId) config.headers["X-User-Id"] = userId;
    if (role) config.headers["X-User-Role"] = role;
    if (activeTenantId || tenantId) {
      config.headers["X-Tenant-Id"] = activeTenantId || tenantId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Suspension, 401, and Normalized Error Messages
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const status = error?.response?.status;
    const data = error?.response?.data;
    const message = data?.error || data?.message || error.message || "Network request failed";

    // Handle 403 Suspension / Security Block
    const isSuspended =
      Boolean(data?.blocked) ||
      (status === 403 &&
        (message.toLowerCase().includes("suspended") ||
          message.toLowerCase().includes("blocked") ||
          message.toLowerCase().includes("screenshot") ||
          message.toLowerCase().includes("recording") ||
          message.toLowerCase().includes("expired")));

    if (isSuspended) {
      await Storage.setItem(StorageKeys.SUSPENDED_FLAG, "true");
      if (onAccountSuspendedCallback) {
        onAccountSuspendedCallback(message);
      }
    }

    // Handle 401 Unauthorized
    if (status === 401) {
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }

    const enhancedError = new Error(message);
    (enhancedError as any).status = status;
    (enhancedError as any).data = data;
    return Promise.reject(enhancedError);
  }
);

export interface RequestOptions {
  bypassCache?: boolean;
  cacheTtlMs?: number;
}

export const apiClient = {
  async get<T>(url: string, config?: AxiosRequestConfig, options?: RequestOptions): Promise<T> {
    const fullUrl = `${getApiBaseUrl()}${url}`;
    const cacheKey = `GET::${fullUrl}::${JSON.stringify(config?.params || {})}`;
    const bypassCache = options?.bypassCache ?? false;
    const ttl = options?.cacheTtlMs ?? CACHE_TTL_MS;

    // 1. Check short-term cache
    if (!bypassCache && responseCache.has(cacheKey)) {
      const entry = responseCache.get(cacheKey)!;
      if (Date.now() - entry.timestamp < ttl) {
        return entry.data as T;
      }
      responseCache.delete(cacheKey);
    }

    // 2. Return active in-flight promise if duplicate
    if (!bypassCache && inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey) as Promise<T>;
    }

    // 3. Dispatch Axios GET
    const fetchPromise = (async () => {
      try {
        const res = await axiosInstance.get<T>(url, config);
        responseCache.set(cacheKey, { data: res.data, timestamp: Date.now() });
        return res.data;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  },

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    clearApiCache();
    const res = await axiosInstance.post<T>(url, data, config);
    return res.data;
  },

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    clearApiCache();
    const res = await axiosInstance.put<T>(url, data, config);
    return res.data;
  },

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    clearApiCache();
    const res = await axiosInstance.patch<T>(url, data, config);
    return res.data;
  },

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    clearApiCache();
    const res = await axiosInstance.delete<T>(url, config);
    return res.data;
  },

  async postForm<T>(url: string, formData: FormData): Promise<T> {
    clearApiCache();
    const res = await axiosInstance.post<T>(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
};
