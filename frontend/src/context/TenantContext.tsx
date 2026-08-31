import React, { createContext, useContext, useState, useEffect } from "react";
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

  const setTenant = (info: Partial<TenantInfo>) => {
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
  };

  const loadTenantBranding = async (tenantId?: string) => {
    const targetId = tenantId || tenant.tenantId || sessionStorage.getItem("activeTenantId") || "default";
    try {
      const res = await apiGet<{ branding: TenantInfo }>(`/auth/tenant-branding?tenantId=${encodeURIComponent(targetId)}`);
      if (res && res.branding) {
        setTenant(res.branding);
      }
    } catch (err) {
      console.warn("Failed to load tenant branding:", err);
    }
  };

  const getTenantLogo = (): string | null => {
    if (tenant.logoUrl) {
      return getMediaUrl(tenant.logoUrl);
    }
    return null;
  };

  useEffect(() => {
    // Initial fetch of active branding
    const storedTid = sessionStorage.getItem("activeTenantId") || sessionStorage.getItem("tenantId");
    if (storedTid) {
      loadTenantBranding(storedTid);
    }
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (tenant && tenant.name && tenant.name !== "Shine Examination Portal" && tenant.name !== "Shine Exam") {
      document.title = `${tenant.name} | Examination Portal`;
    } else {
      document.title = "Shine Exam Prep";
    }

    // Dynamically update browser tab favicon if tenant has custom logo
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.getElementsByTagName("head")[0].appendChild(link);
    }
    if (tenant && tenant.logoUrl) {
      link.href = getMediaUrl(tenant.logoUrl);
    } else {
      link.href = "/favicon.ico";
    }
  }, [tenant]);

  return (
    <TenantContext.Provider value={{ tenant, setTenant, loadTenantBranding, getTenantLogo }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => useContext(TenantContext);
