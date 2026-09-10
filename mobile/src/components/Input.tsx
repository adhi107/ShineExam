import React, { useState } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
  ViewStyle,
} from "react-native";
import { useTenant } from "../context/TenantContext";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  isPassword?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  isPassword = false,
  leftIcon,
  rightIcon,
  containerStyle,
  style,
  ...props
}) => {
  const { theme } = useTenant();
  const [isFocused, setIsFocused] = useState(false);
  const [hidePassword, setHidePassword] = useState(isPassword);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          isFocused && { borderColor: theme.colors.primary, borderWidth: 1.5 },
          Boolean(error) && { borderColor: theme.colors.danger },
        ]}
      >
        {leftIcon && <View style={styles.iconContainer}>{leftIcon}</View>}
        <TextInput
          placeholderTextColor="#94a3b8"
          secureTextEntry={hidePassword}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[styles.input, style]}
          {...props}
        />
        {isPassword ? (
          <TouchableOpacity
            style={styles.iconContainer}
            onPress={() => setHidePassword((v) => !v)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.passwordToggleText}>{hidePassword ? "Show" : "Hide"}</Text>
          </TouchableOpacity>
        ) : (
          rightIcon && <View style={styles.iconContainer}>{rightIcon}</View>
        )}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#0f172a",
    paddingVertical: 10,
  },
  iconContainer: {
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  passwordToggleText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563eb",
  },
  errorText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ef4444",
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
  },
});

export default Input;
