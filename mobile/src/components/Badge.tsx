import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";

export type BadgeVariant =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "answered"
  | "notAnswered"
  | "marked"
  | "answeredMarked"
  | "notVisited";

interface BadgeProps {
  label: string | number;
  variant?: BadgeVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = "primary",
  style,
  textStyle,
  size = "md",
}) => {
  const getStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case "primary":
        return { container: { backgroundColor: "#dbeafe" }, text: { color: "#1e40af" } };
      case "success":
        return { container: { backgroundColor: "#dcfce7" }, text: { color: "#166534" } };
      case "warning":
        return { container: { backgroundColor: "#fef3c7" }, text: { color: "#92400e" } };
      case "danger":
        return { container: { backgroundColor: "#fee2e2" }, text: { color: "#991b1b" } };
      case "info":
        return { container: { backgroundColor: "#e0f2fe" }, text: { color: "#075985" } };
      case "neutral":
        return { container: { backgroundColor: "#f1f5f9" }, text: { color: "#475569" } };
      // TCS iON Exam Palette Status Badges
      case "answered":
        return { container: { backgroundColor: "#16a34a" }, text: { color: "#ffffff" } };
      case "notAnswered":
        return { container: { backgroundColor: "#ea580c" }, text: { color: "#ffffff" } };
      case "marked":
        return { container: { backgroundColor: "#9333ea" }, text: { color: "#ffffff" } };
      case "answeredMarked":
        return { container: { backgroundColor: "#4f46e5" }, text: { color: "#ffffff" } };
      case "notVisited":
        return { container: { backgroundColor: "#e2e8f0" }, text: { color: "#475569" } };
    }
  };

  const current = getStyles();
  const isSm = size === "sm";

  return (
    <View
      style={[
        styles.badge,
        isSm ? styles.badgeSm : styles.badgeMd,
        current.container,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          isSm ? styles.textSm : styles.textMd,
          current.text,
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeMd: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontWeight: "700",
  },
  textSm: {
    fontSize: 11,
  },
  textMd: {
    fontSize: 12,
  },
});

export default Badge;
