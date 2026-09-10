import { TextStyle } from "react-native";

export const typography: Record<string, TextStyle> = {
  h1: {
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  body: {
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 22,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
  },
  caption: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
    letterSpacing: 0.2,
  },
  button: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  timer: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 22,
    fontVariant: ["tabular-nums"],
  },
};
