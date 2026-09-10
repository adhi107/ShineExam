import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
} from "react-native";
import { useTenant } from "../context/TenantContext";

export type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  iconPosition = "left",
  style,
  textStyle,
  ...props
}) => {
  const { theme } = useTenant();

  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case "primary":
        return {
          container: {
            backgroundColor: disabled ? "#94a3b8" : theme.colors.primary,
            borderWidth: 0,
          },
          text: {
            color: "#ffffff",
          },
        };
      case "secondary":
        return {
          container: {
            backgroundColor: "#f1f5f9",
            borderWidth: 1,
            borderColor: "#e2e8f0",
          },
          text: {
            color: "#0f172a",
          },
        };
      case "outline":
        return {
          container: {
            backgroundColor: "transparent",
            borderWidth: 1.5,
            borderColor: disabled ? "#cbd5e1" : theme.colors.primary,
          },
          text: {
            color: disabled ? "#94a3b8" : theme.colors.primary,
          },
        };
      case "danger":
        return {
          container: {
            backgroundColor: disabled ? "#fca5a5" : theme.colors.danger,
            borderWidth: 0,
          },
          text: {
            color: "#ffffff",
          },
        };
      case "ghost":
        return {
          container: {
            backgroundColor: "transparent",
            borderWidth: 0,
          },
          text: {
            color: disabled ? "#94a3b8" : theme.colors.textSecondary,
          },
        };
    }
  };

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case "sm":
        return {
          container: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
          text: { fontSize: 13, fontWeight: "600" },
        };
      case "md":
        return {
          container: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10 },
          text: { fontSize: 15, fontWeight: "700" },
        };
      case "lg":
        return {
          container: { paddingVertical: 15, paddingHorizontal: 24, borderRadius: 12 },
          text: { fontSize: 16, fontWeight: "700" },
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled || loading}
      style={[
        styles.base,
        variantStyles.container,
        sizeStyles.container,
        disabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "outline" || variant === "ghost" ? theme.colors.primary : "#ffffff"}
        />
      ) : (
        <>
          {icon && iconPosition === "left" && <>{icon}</>}
          <Text
            style={[
              styles.textBase,
              variantStyles.text,
              sizeStyles.text,
              icon && iconPosition === "left" && { marginLeft: 8 },
              icon && iconPosition === "right" && { marginRight: 8 },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === "right" && <>{icon}</>}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  textBase: {
    textAlign: "center",
  },
  disabled: {
    opacity: 0.65,
  },
});

export default Button;
