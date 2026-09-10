import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { TenantInfo, StaticBrandConfig } from "../types/tenant";
import { ACTIVE_BUILD_BRAND } from "../config/brandConfig";
import { authApi } from "../api/authApi";
import { Storage, StorageKeys } from "../utils/storage";
import { createTheme, Theme } from "../theme";

interface TenantContextValue {
  tenant: TenantInfo;
  brand: StaticBrandConfig;
  theme: Theme;
  isWhiteLabel: boolean;
  loadTenantBranding: (tenantId?: string) => Promise<void>;
  setTenantState: (info: Partial<TenantInfo>) => void;
  isFeatureEnabled: (featureName: string) => boolean;
}

const DEFAULT_TENANT_INFO: TenantInfo = {
  tenantId: ACTIVE_BUILD_BRAND.tenantId || "default",
  name: ACTIVE_BUILD_BRAND.appName || "Examination Portal",
  brandTitle: ACTIVE_BUILD_BRAND.brandTitle || "Examination Portal",
  logoUrl: "",
  primaryColor: ACTIVE_BUILD_BRAND.theme.primaryColor || "#2563eb",
  accentColor: ACTIVE_BUILD_BRAND.theme.accentColor || "#38bdf8",
  status: "active",
  features: ACTIVE_BUILD_BRAND.features,
};

const TenantContext = createContext<TenantContextValue>({
  tenant: DEFAULT_TENANT_INFO,
  brand: ACTIVE_BUILD_BRAND,
  theme: createTheme(DEFAULT_TENANT_INFO),
  isWhiteLabel: ACTIVE_BUILD_BRAND.isWhiteLabel,
  loadTenantBranding: async () => {},
  setTenantState: () => {},
  isFeatureEnabled: () => true,
});

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<TenantInfo>(DEFAULT_TENANT_INFO);
  const [themeState, setThemeState] = useState<Theme>(createTheme(DEFAULT_TENANT_INFO));

  const loadTenantBranding = useCallback(async (tenantId?: string) => {
    const targetTid =
      tenantId ||
      (await Storage.getItem<string>(StorageKeys.ACTIVE_TENANT_ID)) ||
      (await Storage.getItem<string>(StorageKeys.TENANT_ID)) ||
      ACTIVE_BUILD_BRAND.tenantId ||
      "default";

    try {
      const res = await authApi.getTenantBranding(targetTid);
      if (res && res.branding) {
        const updatedTenant: TenantInfo = {
          ...DEFAULT_TENANT_INFO,
          ...res.branding,
          features: {
            ...DEFAULT_TENANT_INFO.features,
            ...(res.branding.features || {}),
          },
        };
        setTenant(updatedTenant);
        setThemeState(createTheme(updatedTenant));
        await Storage.setItem(StorageKeys.TENANT_INFO, updatedTenant);
      }
    } catch (e) {
      console.warn("Failed to load tenant branding:", e);
    }
  }, []);

  const setTenantState = useCallback((info: Partial<TenantInfo>) => {
    setTenant((prev) => {
      const updated = { ...prev, ...info };
      setThemeState(createTheme(updated));
      Storage.setItem(StorageKeys.TENANT_INFO, updated);
      return updated;
    });
  }, []);

  const isFeatureEnabled = useCallback(
    (featureName: string): boolean => {
      if (tenant?.features && typeof tenant.features[featureName] === "boolean") {
        return Boolean(tenant.features[featureName]);
      }
      return Boolean(ACTIVE_BUILD_BRAND.features?.[featureName] ?? true);
    },
    [tenant]
  );

  useEffect(() => {
    loadTenantBranding();
  }, [loadTenantBranding]);

  return (
    <TenantContext.Provider
      value={{
        tenant,
        brand: ACTIVE_BUILD_BRAND,
        theme: themeState,
        isWhiteLabel: ACTIVE_BUILD_BRAND.isWhiteLabel,
        loadTenantBranding,
        setTenantState,
        isFeatureEnabled,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => useContext(TenantContext);
