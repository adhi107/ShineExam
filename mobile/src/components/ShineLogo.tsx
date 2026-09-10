import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { useTenant } from "../context/TenantContext";

interface ShineLogoProps {
  inverse?: boolean;
  size?: "sm" | "md" | "lg";
}

export const ShineLogo: React.FC<ShineLogoProps> = ({ inverse = false, size = "md" }) => {
  const { tenant } = useTenant();

  const brandName = tenant?.brandTitle || tenant?.name || "VICTORY STUDY CIRCLE";
  const logoUrl = tenant?.logoUrl;

  const fontSizes = {
    sm: 16,
    md: 20,
    lg: 26,
  };

  if (logoUrl) {
    return (
      <View style={styles.container}>
        <Image
          source={{ uri: logoUrl }}
          style={{ width: size === "sm" ? 80 : size === "md" ? 120 : 160, height: 40 }}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: inverse ? "#ffffff" : "#2563eb" }]}>
        <Text style={[styles.badgeChar, { color: inverse ? "#2563eb" : "#ffffff" }]}>
          {brandName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text
        style={[
          styles.text,
          {
            fontSize: fontSizes[size],
            color: inverse ? "#ffffff" : "#0f172a",
          },
        ]}
        numberOfLines={1}
      >
        {brandName.toUpperCase()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeChar: {
    fontSize: 18,
    fontWeight: "900",
  },
  text: {
    fontWeight: "900",
    letterSpacing: -0.3,
  },
});

export default ShineLogo;
