export const defaultPalette = {
  // Brand default colors
  primary: "#2563eb",
  primaryDark: "#1d4ed8",
  primaryLight: "#dbeafe",
  accent: "#38bdf8",
  
  // Status Colors
  success: "#10b981",
  successBg: "#ecfdf5",
  warning: "#f59e0b",
  warningBg: "#fffbeb",
  danger: "#ef4444",
  dangerBg: "#fef2f2",
  info: "#3b82f6",
  infoBg: "#eff6ff",

  // Exam Palette State Colors (TCS iON Standard)
  paletteAnswered: "#16a34a",
  paletteNotAnswered: "#ea580c",
  paletteMarked: "#9333ea",
  paletteAnsweredMarked: "#4f46e5",
  paletteNotVisited: "#94a3b8",

  // Neutrals & Surfaces
  background: "#f8fafc",
  surface: "#ffffff",
  surfaceAlt: "#f1f5f9",
  cardBorder: "#e2e8f0",
  headerBg: "#090e1a",
  
  // Text Colors
  text: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#64748b",
  textInverse: "#ffffff",
  border: "#cbd5e1",
  inputBg: "#f8fafc",
  inputBorder: "#cbd5e1",
};

export type ThemeColors = typeof defaultPalette;
