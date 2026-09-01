export function getApiBase(): string {
  if (process.env.REACT_APP_API_BASE_URL) {
    return process.env.REACT_APP_API_BASE_URL.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && window.location) {
    const { hostname, protocol, port } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://127.0.0.1:5000";
    }
    // If frontend is on a dedicated client port (e.g. 3000, 5173, 8080), route backend API calls to port 5000 on that same host
    if (port && port !== "80" && port !== "443" && port !== "5000") {
      return `${protocol}//${hostname}:5000`;
    }
    return window.location.origin;
  }
  return "http://127.0.0.1:5000";
}

export const API_BASE = getApiBase().endsWith("/api") ? getApiBase() : `${getApiBase()}/api`;

export function buildUrl(path: string): string {
  const base = getApiBase();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (cleanPath.startsWith("/api/")) {
    const rootBase = base.replace(/\/api$/, "");
    return `${rootBase}${cleanPath}`;
  }
  const apiRoot = base.endsWith("/api") ? base : `${base}/api`;
  return `${apiRoot}${cleanPath}`;
}

export function getMediaUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) {
    return url;
  }
  const rootBase = getApiBase().replace(/\/api$/, "");
  const cleanPath = url.startsWith("/") ? url : `/${url}`;
  return `${rootBase}${cleanPath}`;
}

export function getAuthHeaders(): Record<string, string> {
  const userId = sessionStorage.getItem("userId") || "";
  const role = sessionStorage.getItem("role") || "";
  const tenantId = sessionStorage.getItem("activeTenantId") || sessionStorage.getItem("tenantId") || "";
  const headers: Record<string, string> = {};
  if (userId) headers["X-User-Id"] = userId;
  if (role) headers["X-User-Role"] = role;
  if (tenantId) headers["X-Tenant-Id"] = tenantId;
  return headers;
}

let isAlertingSuspension = false;

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = "Request failed";
    let isBlocked = false;
    try {
      const body = await res.json();
      message = body.error || body.message || message;
      isBlocked = Boolean(body.blocked || res.status === 403);
    } catch {
      const text = await res.text().catch(() => "");
      message = text || message;
      isBlocked = res.status === 403;
    }

    if (isBlocked && (message.toLowerCase().includes("suspended") || message.toLowerCase().includes("blocked") || message.toLowerCase().includes("screenshot"))) {
      if (!isAlertingSuspension) {
        isAlertingSuspension = true;
        sessionStorage.clear();
        sessionStorage.setItem("account_permanently_blocked", "true");
        window.location.href = "/login";
      }
    }


    throw new Error(message);
  }
  return res.json();
}

// In-flight GET promise deduplication map to prevent simultaneous duplicate network requests
const inFlightRequests = new Map<string, Promise<any>>();

// Short TTL response cache (in milliseconds) for GET requests to eliminate duplicate cascading calls
interface CacheEntry {
  data: any;
  timestamp: number;
}
const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1200; // 1.2 seconds window for debouncing identical React renders/mounts

export function clearApiCache(pathPrefix?: string) {
  if (!pathPrefix) {
    responseCache.clear();
    return;
  }
  for (const key of responseCache.keys()) {
    if (key.includes(pathPrefix)) {
      responseCache.delete(key);
    }
  }
}

export interface ApiGetOptions {
  bypassCache?: boolean;
  cacheTtlMs?: number;
}

export async function apiGet<T>(url: string, options?: ApiGetOptions): Promise<T> {
  const fullUrl = buildUrl(url);
  const authHeaders = getAuthHeaders();
  const cacheKey = `${fullUrl}::${JSON.stringify(authHeaders)}`;
  const bypassCache = options?.bypassCache ?? false;
  const ttl = options?.cacheTtlMs ?? CACHE_TTL_MS;

  // 1. Return from short-term cache if fresh and not bypassed
  if (!bypassCache && responseCache.has(cacheKey)) {
    const entry = responseCache.get(cacheKey)!;
    if (Date.now() - entry.timestamp < ttl) {
      return Promise.resolve(entry.data as T);
    }
    responseCache.delete(cacheKey);
  }

  // 2. Return in-flight promise if identical request is already active
  if (!bypassCache && inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey) as Promise<T>;
  }

  // 3. Initiate new fetch request
  const fetchPromise = (async () => {
    try {
      const res = await fetch(fullUrl, {
        headers: {
          ...authHeaders,
        },
      });
      const data = await handleResponse<T>(res);
      responseCache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

export async function apiPost<T>(url: string, body: any): Promise<T> {
  clearApiCache();
  const res = await fetch(buildUrl(url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export async function apiPut<T>(url: string, body: any): Promise<T> {
  clearApiCache();
  const res = await fetch(buildUrl(url), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export async function apiPatch<T>(url: string, body: any): Promise<T> {
  clearApiCache();
  const res = await fetch(buildUrl(url), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export async function apiPostForm<T>(url: string, body: FormData): Promise<T> {
  clearApiCache();
  const res = await fetch(buildUrl(url), {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
    },
    body,
  });
  return handleResponse<T>(res);
}

export async function apiPutForm<T>(url: string, body: FormData): Promise<T> {
  clearApiCache();
  const res = await fetch(buildUrl(url), {
    method: "PUT",
    headers: {
      ...getAuthHeaders(),
    },
    body,
  });
  return handleResponse<T>(res);
}

export async function apiDelete<T>(url: string): Promise<T> {
  clearApiCache();
  const res = await fetch(buildUrl(url), {
    method: "DELETE",
    headers: {
      ...getAuthHeaders(),
    },
  });
  return handleResponse<T>(res);
}

