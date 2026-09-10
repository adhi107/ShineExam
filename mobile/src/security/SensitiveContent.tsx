import React, { useState, useEffect } from "react";
import { View, StyleSheet, AppState, AppStateStatus, Text } from "react-native";
import { useScreenProtection } from "../hooks/useScreenProtection";
import DynamicWatermark from "./DynamicWatermark";

interface SensitiveContentProps {
  userId?: string;
  module: "exam" | "results" | "documents" | "classes" | "dashboard";
  showWatermark?: boolean;
  watermarkOpacity?: number;
  shieldOnBackground?: boolean;
  shieldMessage?: string;
  children: React.ReactNode;
}

export const SensitiveContent: React.FC<SensitiveContentProps> = ({
  userId = "",
  module,
  showWatermark = true,
  watermarkOpacity = 0.12,
  shieldOnBackground = false,
  shieldMessage = "Assessment content is secured while app is in background.",
  children,
}) => {
  useScreenProtection({ module, enabled: true });
  const [isBackgrounded, setIsBackgrounded] = useState(false);

  useEffect(() => {
    if (!shieldOnBackground) return;

    const handleAppState = (state: AppStateStatus) => {
      setIsBackgrounded(state === "background" || state === "inactive");
    };

    const sub = AppState.addEventListener("change", handleAppState);
    return () => sub.remove();
  }, [shieldOnBackground]);

  return (
    <View style={styles.container}>
      {children}

      {showWatermark && userId ? (
        <DynamicWatermark userId={userId} opacity={watermarkOpacity} />
      ) : null}

      {isBackgrounded && shieldOnBackground ? (
        <View style={styles.shield}>
          <Text style={styles.shieldIcon}>🛡️</Text>
          <Text style={styles.shieldTitle}>Protected Session</Text>
          <Text style={styles.shieldSubtitle}>{shieldMessage}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  shield: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#07070d",
    zIndex: 99999,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  shieldIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  shieldTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 8,
  },
  shieldSubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    maxWidth: 280,
  },
});

export default SensitiveContent;
