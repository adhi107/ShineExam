import { defaultPalette, ThemeColors } from "./colors";
import { typography } from "./typography";
import { spacing, borderRadius, shadows } from "./spacing";
import { TenantInfo } from "../types/tenant";

export function createTheme(tenant?: Partial<TenantInfo>) {
  const primary = tenant?.primaryColor || defaultPalette.primary;
  const accent = tenant?.accentColor || defaultPalette.accent;

  const colors: ThemeColors = {
    ...defaultPalette,
    primary,
    accent,
  };

  return {
    colors,
    typography,
    spacing,
    borderRadius,
    shadows,
  };
}

export const theme = createTheme();
export type Theme = ReturnType<typeof createTheme>;
