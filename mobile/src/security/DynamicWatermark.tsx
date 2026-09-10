import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { useSecurity } from "../context/SecurityContext";
import { useTenant } from "../context/TenantContext";

interface DynamicWatermarkProps {
  userId: string;
  opacity?: number;
}

export const DynamicWatermark: React.FC<DynamicWatermarkProps> = ({
  userId,
  opacity = 0.12,
}) => {
  const { config, sessionId } = useSecurity();
  const { tenant } = useTenant();
  const [timestamp, setTimestamp] = useState<string>(() => new Date().toLocaleTimeString());

  useEffect(() => {
    if (!config.watermarkEnabled) return;
    const intervalSec = config.watermarkIntervalSec || 8;
    const timer = setInterval(() => {
      setTimestamp(new Date().toLocaleTimeString());
    }, intervalSec * 1000);
    return () => clearInterval(timer);
  }, [config.watermarkEnabled, config.watermarkIntervalSec]);

  if (!config.watermarkEnabled || !userId) {
    return null;
  }

  const orgName = tenant?.brandTitle || tenant?.name || "EXAMINATION PORTAL";
  const displaySession = sessionId ? sessionId.slice(0, 8) : "";
  const watermarkText = `${userId} • ${orgName} • ${timestamp} • ${displaySession}`;

  // Build grid items to cover the entire mobile viewport
  const items = Array.from({ length: 12 });

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.grid}>
        {items.map((_, i) => (
          <View key={i} style={[styles.tile, { opacity }]}>
            <Text style={styles.text}>{watermarkText}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  grid: {
    width: Dimensions.get("window").width * 1.5,
    height: Dimensions.get("window").height * 1.5,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    alignItems: "center",
    transform: [{ rotate: "-28deg" }],
  },
  tile: {
    marginVertical: 45,
    marginHorizontal: 15,
    padding: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.8,
    textAlign: "center",
  },
});

export default DynamicWatermark;
