import { useEffect } from "react";
import { ScreenSecurityModule } from "../security/ScreenSecurityModule";
import { useSecurity } from "../context/SecurityContext";

interface ScreenProtectionOptions {
  module: "exam" | "results" | "documents" | "classes" | "dashboard";
  enabled?: boolean;
}

export function useScreenProtection({ module, enabled = true }: ScreenProtectionOptions) {
  const { config } = useSecurity();

  useEffect(() => {
    const isModuleProtected =
      enabled &&
      (config.screenshotProtectedModules?.includes(module) ||
        module === "exam" ||
        module === "results");

    if (isModuleProtected) {
      ScreenSecurityModule.enableSecureScreen();
    }

    return () => {
      if (isModuleProtected) {
        ScreenSecurityModule.disableSecureScreen();
      }
    };
  }, [module, enabled, config.screenshotProtectedModules]);
}
