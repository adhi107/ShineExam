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
  name: "Shine Examination Portal",
  brandTitle: "Shine Examination Portal",
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

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenant, setTenantState] = useState<TenantInfo>(() => {
    try {
      const stored = sessionStorage.getItem("tenant_info");
      if (stored) {
        return { ...DEFAULT_TENANT, ...JSON.parse(stored) };
      }
      const activeTid = sessionStorage.getItem("activeTenantId") || sessionStorage.getItem("tenantId") || "default";
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
    const activeTid = sessionStorage.getItem("activeTenantId") || sessionStorage.getItem("tenantId") || "default";
    const targetId = tenantId || activeTid;
    try {
      const res = await apiGet<{ branding: TenantInfo }>(`/auth/tenant-branding?tenantId=${encodeURIComponent(targetId)}`);
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
    // Initial fetch of active branding once on mount
    const storedTid = sessionStorage.getItem("activeTenantId") || sessionStorage.getItem("tenantId");
    if (storedTid) {
      loadTenantBranding(storedTid);
    }
  }, [loadTenantBranding]);

  useEffect(() => {
    if (tenant && tenant.name && tenant.name !== "Shine Examination Portal" && tenant.name !== "Shine Exam") {
      document.title = `${tenant.brandTitle || tenant.name} | Examination Portal`;
    } else {
      document.title = "Shine Exam Prep";
    }

    // Dynamically and accurately update browser tab favicon if tenant has custom logo
    try {
      const head = document.head || document.getElementsByTagName("head")[0];
      if (head) {
        // Remove existing favicon links to avoid browser MIME type conflicts and force immediate visual refresh
        const existingLinks = document.querySelectorAll("link[rel*='icon']");
        existingLinks.forEach((el) => el.parentNode?.removeChild(el));

        const rawLogo = tenant?.logoUrl?.trim();
        const resolvedUrl = rawLogo ? getMediaUrl(rawLogo) : "/shine-favicon.svg";

        let mimeType = "image/x-icon";
        const lowerUrl = resolvedUrl.toLowerCase();
        if (lowerUrl.includes(".svg")) {
          mimeType = "image/svg+xml";
        } else if (lowerUrl.includes(".png")) {
          mimeType = "image/png";
        } else if (lowerUrl.includes(".jpg") || lowerUrl.includes(".jpeg")) {
          mimeType = "image/jpeg";
        } else if (lowerUrl.includes(".webp")) {
          mimeType = "image/webp";
        }

        const iconLink = document.createElement("link");
        iconLink.rel = "icon";
        iconLink.type = mimeType;
        iconLink.href = resolvedUrl;
        head.appendChild(iconLink);

        const shortcutLink = document.createElement("link");
        shortcutLink.rel = "shortcut icon";
        shortcutLink.type = mimeType;
        shortcutLink.href = resolvedUrl;
        head.appendChild(shortcutLink);

        const appleLink = document.createElement("link");
        appleLink.rel = "apple-touch-icon";
        appleLink.href = resolvedUrl;
        head.appendChild(appleLink);
      }
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
