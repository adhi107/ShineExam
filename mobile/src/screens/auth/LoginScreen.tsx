import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { UserRole } from "../../types/user";
import Button from "../../components/Button";
import Input from "../../components/Input";
import ShineLogo from "../../components/ShineLogo";
import AlertDialog, { AlertVariant } from "../../components/AlertDialog";

export const LoginScreen: React.FC = () => {
  const { login, isSuspended, suspensionReason, acknowledgeSuspension } = useAuth();
  const { tenant, isWhiteLabel } = useTenant();

  const [selectedRole, setSelectedRole] = useState<UserRole>("answerer");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [alertState, setAlertState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    variant: AlertVariant;
    buttonText?: string;
  } | null>(null);

  const isSuperAdmin = selectedRole === "super_admin";

  const handleLogin = async () => {
    if (!userId.trim() || !password.trim()) {
      setAlertState({
        visible: true,
        title: "Missing Credentials",
        message: "Please enter your User ID and password to proceed.",
        variant: "warning",
      });
      return;
    }

    setIsLoading(true);
    try {
      await login({
        userId: userId.trim(),
        password: password.trim(),
        role: selectedRole,
      });
    } catch (err: any) {
      const msg: string = err?.message || "Login failed";
      if (msg.toLowerCase().includes("mismatch") || msg.toLowerCase().includes("registered as")) {
        setAlertState({
          visible: true,
          title: "Role Mismatch",
          message: msg,
          variant: "warning",
          buttonText: "Switch Role",
        });
      } else if (msg.toLowerCase().includes("expired")) {
        setAlertState({
          visible: true,
          title: "Account Validity Expired",
          message:
            "Your examination eligibility period has expired. Please contact your administrator to renew your account.",
          variant: "warning",
        });
      } else if (
        msg.toLowerCase().includes("suspended") ||
        msg.toLowerCase().includes("screenshot") ||
        msg.toLowerCase().includes("blocked")
      ) {
        setAlertState({
          visible: true,
          title: "Account Suspended",
          message:
            msg ||
            "Your account is suspended due to security policy violations. Contact your administrator to unblock your account.",
          variant: "suspended",
        });
      } else {
        setAlertState({
          visible: true,
          title: "Invalid Credentials",
          message: msg || "Please check your User ID and password and try again.",
          variant: "error",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setAlertState({
      visible: true,
      title: "Password Recovery",
      message:
        "For security and verification, candidate password resets are managed directly by your Organization Administration. Please contact your exam coordinator with your User ID.",
      variant: "info",
      buttonText: "Understood",
    });
  };

  const brandDisplayName =
    tenant?.brandTitle || tenant?.name || (isWhiteLabel ? "EXAM PORTAL" : "VICTORY STUDY CIRCLE");

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Header Card */}
        <View style={styles.brandHero}>
          <ShineLogo inverse size="lg" />
          <Text style={styles.brandEyebrow}>{brandDisplayName.toUpperCase()}</Text>
          <Text style={styles.brandTitle}>
            {isSuperAdmin
              ? "Global Platform Governance"
              : "Prepare with Purpose.\nPerform with Confidence."}
          </Text>
          <Text style={styles.brandSubtitle}>
            {isSuperAdmin
              ? "Master control suite for multi-tenant administration and licensing."
              : "Secure timed assessments, practice tests, and detailed score analytics."}
          </Text>
        </View>

        {/* Login Form Sheet */}
        <View style={styles.formCard}>
          <Text style={styles.formHeaderTitle}>
            {isSuperAdmin
              ? "Super Admin Console"
              : selectedRole === "admin"
              ? "Admin Portal"
              : "Candidate Login"}
          </Text>
          <Text style={styles.formHeaderSubtitle}>
            Sign in with your registered credentials to access your assessment workspace.
          </Text>

          {/* Role Toggle */}
          <View style={styles.roleToggleContainer}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.roleButton,
                selectedRole === "answerer" && styles.roleButtonActive,
              ]}
              onPress={() => setSelectedRole("answerer")}
            >
              <Text
                style={[
                  styles.roleButtonText,
                  selectedRole === "answerer" && styles.roleButtonTextActive,
                ]}
              >
                Test Taker
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.roleButton,
                selectedRole === "admin" && styles.roleButtonActive,
              ]}
              onPress={() => setSelectedRole("admin")}
            >
              <Text
                style={[
                  styles.roleButtonText,
                  selectedRole === "admin" && styles.roleButtonTextActive,
                ]}
              >
                Admin
              </Text>
            </TouchableOpacity>
          </View>

          {/* Credentials Inputs */}
          <Input
            label="User ID or Email"
            placeholder={isSuperAdmin ? "superadmin" : "Enter your user ID or email"}
            value={userId}
            onChangeText={setUserId}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            isPassword
          />

          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={handleForgotPassword}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <Button
            title={isLoading ? "Signing in..." : "Sign In to Exam Portal"}
            loading={isLoading}
            onPress={handleLogin}
            size="lg"
            style={styles.submitBtn}
          />

          <View style={styles.securityBadge}>
            <Text style={styles.securityText}>
              🔒 Protected by Hardware Screen Capture & Session Security
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Account Suspended Persistent Screen / Alert */}
      {isSuspended && (
        <AlertDialog
          visible={isSuspended}
          title="Account Suspended"
          message={
            suspensionReason ||
            "Your account has been suspended due to an unauthorized screen capture or security violation. Please contact your system administrator to unblock your account."
          }
          variant="suspended"
          buttonText="Acknowledge & Exit"
          onClose={acknowledgeSuspension}
        />
      )}

      {/* General Alert Dialog */}
      {alertState && (
        <AlertDialog
          visible={alertState.visible}
          title={alertState.title}
          message={alertState.message}
          variant={alertState.variant}
          buttonText={alertState.buttonText || "OK"}
          onClose={() => setAlertState(null)}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#090e1a",
  },
  scrollContent: {
    flexGrow: 1,
  },
  brandHero: {
    paddingTop: 48,
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    backgroundColor: "#090e1a",
  },
  brandEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#38bdf8",
    letterSpacing: 1.5,
    marginTop: 14,
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#ffffff",
    textAlign: "center",
    lineHeight: 28,
    marginBottom: 8,
  },
  brandSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 320,
  },
  formCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36,
  },
  formHeaderTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  formHeaderSubtitle: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
    marginBottom: 20,
  },
  roleToggleContainer: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  roleButtonActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  roleButtonTextActive: {
    fontWeight: "800",
    color: "#2563eb",
  },
  forgotBtn: {
    alignSelf: "flex-end",
    marginBottom: 20,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563eb",
  },
  submitBtn: {
    marginBottom: 20,
  },
  securityBadge: {
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  securityText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    textAlign: "center",
  },
});

export default LoginScreen;
