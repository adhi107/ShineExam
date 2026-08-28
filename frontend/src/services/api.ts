const rawBase = (process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:5000").replace(/\/+$/, "");
export const API_BASE = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

export function buildUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (cleanPath.startsWith("/api/")) {
    const rootBase = rawBase.replace(/\/api$/, "");
    return `${rootBase}${cleanPath}`;
  }
  return `${API_BASE}${cleanPath}`;
}

function getAuthHeaders(): Record<string, string> {
  const userId = sessionStorage.getItem("userId") || "";
  const role = sessionStorage.getItem("role") || "";
  const headers: Record<string, string> = {};
  if (userId) headers["X-User-Id"] = userId;
  if (role) headers["X-User-Role"] = role;
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

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(buildUrl(url), {
    headers: {
      ...getAuthHeaders(),
    },
  });
  return handleResponse<T>(res);
}

export async function apiPost<T>(url: string, body: any): Promise<T> {
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
  const res = await fetch(buildUrl(url), {
    method: "DELETE",
    headers: {
      ...getAuthHeaders(),
    },
  });
  return handleResponse<T>(res);
}
