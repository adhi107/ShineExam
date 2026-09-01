import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiGet, getMediaUrl } from "../services/api";

export interface TenantInfo {
  tenantId: string;
  name: string;
  brandTitle: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  status?: string;
}

interface TenantContextValue {
  tenant: TenantInfo;
  setTenant: (info: Partial<TenantInfo>) => void;
  loadTenantBranding: (tenantId?: string) => Promise<void>;
  getTenantLogo: () => string | null;
}

const DEFAULT_TENANT: TenantInfo = {
  tenantId: "default",
  name: "Examination Portal",
  brandTitle: "Examination Portal",
  logoUrl: "",
  primaryColor: "#2563eb",
  accentColor: "#38bdf8",
  status: "active",
};

const TenantContext = createContext<TenantContextValue>({
  tenant: DEFAULT_TENANT,
  setTenant: () => {},
  loadTenantBranding: async () => {},
  getTenantLogo: () => null,
});

function updateDynamicFavicon(logoUrl?: string, tenantName?: string, primaryColor?: string) {
  if (typeof document === "undefined") return;

  const setFaviconLinks = (href: string, mimeType: string = "image/png") => {
    const head = document.head || document.getElementsByTagName("head")[0];
    if (!head) return;

    const existingLinks = document.querySelectorAll("link[rel*='icon'], link[rel='apple-touch-icon']");
    existingLinks.forEach((el) => el.parentNode?.removeChild(el));

    const iconLink = document.createElement("link");
    iconLink.id = "dynamic-favicon";
    iconLink.rel = "icon";
    iconLink.type = mimeType;
    iconLink.href = href;
    head.appendChild(iconLink);

    const shortcutLink = document.createElement("link");
    shortcutLink.rel = "shortcut icon";
    shortcutLink.type = mimeType;
    shortcutLink.href = href;
    head.appendChild(shortcutLink);

    const appleLink = document.createElement("link");
    appleLink.rel = "apple-touch-icon";
    appleLink.href = href;
    head.appendChild(appleLink);
  };

  const cleanLogo = (logoUrl || "").trim();
  if (cleanLogo) {
    const resolved = getMediaUrl(cleanLogo);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, 64, 64);
          ctx.drawImage(img, 0, 0, 64, 64);
          const dataUrl = canvas.toDataURL("image/png");
          setFaviconLinks(dataUrl, "image/png");
          return;
        }
      } catch {
        // Direct link fallback
      }
      const vUrl = resolved.includes("?") ? `${resolved}&v=${Date.now()}` : `${resolved}?v=${Date.now()}`;
      setFaviconLinks(vUrl, resolved.toLowerCase().includes(".svg") ? "image/svg+xml" : "image/png");
    };
    img.onerror = () => {
      const vUrl = resolved.includes("?") ? `${resolved}&v=${Date.now()}` : `${resolved}?v=${Date.now()}`;
      setFaviconLinks(vUrl, resolved.toLowerCase().includes(".svg") ? "image/svg+xml" : "image/png");
    };
    img.src = resolved;
  } else if (tenantName && tenantName !== "Shine Examination Portal" && tenantName !== "Shine Exam" && tenantName !== "Shine Main Organization") {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const bg = primaryColor || "#2563eb";
        ctx.fillStyle = bg;
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === "function") {
          (ctx as any).roundRect(0, 0, 64, 64, 14);
        } else {
          ctx.rect(0, 0, 64, 64);
        }
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 36px 'Plus Jakarta Sans', Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const char = tenantName.trim().charAt(0).toUpperCase() || "E";
        ctx.fillText(char, 32, 34);

        const dataUrl = canvas.toDataURL("image/png");
        setFaviconLinks(dataUrl, "image/png");
        return;
      }
    } catch {}
    setFaviconLinks("/shine-favicon.svg", "image/svg+xml");
  } else {
    setFaviconLinks("/shine-favicon.svg", "image/svg+xml");
  }
}

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenant, setTenantState] = useState<TenantInfo>(() => {
    try {
      const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const urlTenant = urlParams ? (urlParams.get("tenant") || urlParams.get("tenantId") || urlParams.get("org") || urlParams.get("t")) : null;

      const stored = sessionStorage.getItem("tenant_info");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (urlTenant && urlTenant !== parsed.tenantId) {
          return { ...DEFAULT_TENANT, tenantId: urlTenant };
        }
        return { ...DEFAULT_TENANT, ...parsed };
      }
      const activeTid = urlTenant || sessionStorage.getItem("activeTenantId") || sessionStorage.getItem("tenantId") || "default";
      return { ...DEFAULT_TENANT, tenantId: activeTid };
    } catch {
      return DEFAULT_TENANT;
    }
  });

  const setTenant = useCallback((info: Partial<TenantInfo>) => {
    setTenantState((prev) => {
      const updated = { ...prev, ...info };
      try {
        sessionStorage.setItem("tenant_info", JSON.stringify(updated));
        if (updated.tenantId) {
          sessionStorage.setItem("tenantId", updated.tenantId);
          sessionStorage.setItem("activeTenantId", updated.tenantId);
        }
      } catch {}
      return updated;
    });
  }, []);

  const loadTenantBranding = useCallback(async (tenantId?: string) => {
    const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const urlTenant = urlParams ? (urlParams.get("tenant") || urlParams.get("tenantId") || urlParams.get("org") || urlParams.get("t")) : null;
    const activeTid = tenantId || urlTenant || sessionStorage.getItem("activeTenantId") || sessionStorage.getItem("tenantId") || "default";
    try {
      const res = await apiGet<{ branding: TenantInfo }>(`/auth/tenant-branding?tenantId=${encodeURIComponent(activeTid)}`);
      if (res && res.branding) {
        setTenant(res.branding);
      }
    } catch (err) {
      console.warn("Failed to load tenant branding:", err);
    }
  }, [setTenant]);

  const getTenantLogo = useCallback((): string | null => {
    if (tenant.logoUrl) {
      return getMediaUrl(tenant.logoUrl);
    }
    return null;
  }, [tenant.logoUrl]);

  useEffect(() => {
    const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const urlTenant = urlParams ? (urlParams.get("tenant") || urlParams.get("tenantId") || urlParams.get("org") || urlParams.get("t")) : null;
    const storedTid = sessionStorage.getItem("activeTenantId") || sessionStorage.getItem("tenantId");
    const targetTid = urlTenant || storedTid;
    if (targetTid) {
      loadTenantBranding(targetTid);
    }
  }, [loadTenantBranding]);

  useEffect(() => {
    if (tenant && tenant.name && !tenant.name.toLowerCase().includes("shine") && tenant.name !== "Examination Portal") {
      document.title = `${tenant.brandTitle || tenant.name} | Examination Portal`;
    } else {
      document.title = "Examination Portal";
    }

    // Accurately update dynamic favicon
    try {
      updateDynamicFavicon(tenant?.logoUrl, tenant?.brandTitle || tenant?.name, tenant?.primaryColor);
    } catch (err) {
      console.warn("Failed to update dynamic favicon:", err);
    }
  }, [tenant]);

  return (
    <TenantContext.Provider value={{ tenant, setTenant, loadTenantBranding, getTenantLogo }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => useContext(TenantContext);

