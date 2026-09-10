import React from "react";
import { Modal, View, Text, StyleSheet } from "react-native";
import Button from "./Button";

export type AlertVariant = "info" | "warning" | "error" | "suspended" | "success";

interface AlertDialogProps {
  visible: boolean;
  title: string;
  message: string;
  variant?: AlertVariant;
  buttonText?: string;
  icon?: string;
  onClose: () => void;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
  visible,
  title,
  message,
  variant = "info",
  buttonText = "OK",
  icon,
  onClose,
}) => {
  const getDefaultIcon = () => {
    switch (variant) {
      case "suspended":
        return "🚫";
      case "error":
        return "⚠️";
      case "warning":
        return "⏳";
      case "success":
        return "✓";
      default:
        return "ℹ️";
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "suspended":
        return {
          headerBg: "#ef4444",
          btnVariant: "danger" as const,
        };
      case "error":
        return {
          headerBg: "#dc2626",
          btnVariant: "danger" as const,
        };
      case "warning":
        return {
          headerBg: "#f59e0b",
          btnVariant: "primary" as const,
        };
      case "success":
        return {
          headerBg: "#10b981",
          btnVariant: "primary" as const,
        };
      default:
        return {
          headerBg: "#2563eb",
          btnVariant: "primary" as const,
        };
    }
  };

  const currentStyles = getVariantStyles();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={[styles.iconCircle, { backgroundColor: currentStyles.headerBg }]}>
            <Text style={styles.iconText}>{icon || getDefaultIcon()}</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <Button
            title={buttonText}
            variant={currentStyles.btnVariant}
            onPress={onClose}
            style={styles.button}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 10,
  },
  message: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  button: {
    width: "100%",
  },
});

export default AlertDialog;
