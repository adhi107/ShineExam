import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { authApi } from "../../api/authApi";
import Card from "../../components/Card";
import Button from "../../components/Button";
import Input from "../../components/Input";
import AlertDialog from "../../components/AlertDialog";
import ConfirmDialog from "../../components/ConfirmDialog";

export const ProfileScreen: React.FC = () => {
  const { user, userId, role, logout } = useAuth();
  const { tenant } = useTenant();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [alertState, setAlertState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    variant: "info" | "success" | "error" | "warning";
  } | null>(null);

  const handleUpdatePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      setAlertState({
        visible: true,
        title: "Missing Fields",
        message: "Please fill all password fields.",
        variant: "warning",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setAlertState({
        visible: true,
        title: "Mismatch",
        message: "New password and confirmation password do not match.",
        variant: "warning",
      });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await authApi.changePassword({
        userId,
        oldPassword,
        newPassword,
        role: role || "answerer",
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordChange(false);
      setAlertState({
        visible: true,
        title: "Password Updated",
        message: "Your password has been changed successfully.",
        variant: "success",
      });
    } catch (e: any) {
      setAlertState({
        visible: true,
        title: "Error",
        message: e?.message || "Failed to update password. Verify your current password.",
        variant: "error",
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Candidate Profile</Text>
        <Text style={styles.headerSubtitle}>Account settings and examination identity</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* User Card */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarChar}>{(user?.name || userId).charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.userName}>{user?.name || "Candidate"}</Text>
          <Text style={styles.userIdText}>User ID: {userId}</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Role</Text>
            <Text style={styles.infoVal}>
              {role === "admin" ? "Administrator" : "Test Taker / Student"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Organization</Text>
            <Text style={styles.infoVal}>{tenant?.name || "Default Organization"}</Text>
          </View>

          {user?.email ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoVal}>{user.email}</Text>
            </View>
          ) : null}
        </Card>

        {/* Security & Password Card */}
        <Card style={styles.sectionCard}>
          <Text style={styles.cardHeaderTitle}>Account Security</Text>
          {!showPasswordChange ? (
            <Button
              title="Change Login Password"
              variant="outline"
              size="md"
              onPress={() => setShowPasswordChange(true)}
            />
          ) : (
            <View style={styles.passwordForm}>
              <Input
                label="Current Password"
                placeholder="Enter current password"
                value={oldPassword}
                onChangeText={setOldPassword}
                isPassword
              />

              <Input
                label="New Password"
                placeholder="Enter new password"
                value={newPassword}
                onChangeText={setNewPassword}
                isPassword
              />

              <Input
                label="Confirm New Password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                isPassword
              />

              <View style={styles.passwordActionRow}>
                <Button
                  title="Cancel"
                  variant="ghost"
                  size="md"
                  onPress={() => setShowPasswordChange(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Update"
                  variant="primary"
                  size="md"
                  loading={isUpdatingPassword}
                  onPress={handleUpdatePassword}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          )}
        </Card>

        {/* Logout Button */}
        <Button
          title="Sign Out of Portal"
          variant="danger"
          size="lg"
          onPress={() => setShowLogoutConfirm(true)}
          style={styles.logoutBtn}
        />
      </ScrollView>

      {/* Logout Confirmation */}
      <ConfirmDialog
        visible={showLogoutConfirm}
        title="Sign Out"
        message="Are you sure you want to sign out of your examination workspace?"
        confirmText="Yes, Sign Out"
        confirmVariant="danger"
        onConfirm={logout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      {/* Alert Dialog */}
      {alertState && (
        <AlertDialog
          visible={alertState.visible}
          title={alertState.title}
          message={alertState.message}
          variant={alertState.variant}
          onClose={() => setAlertState(null)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
  },
  content: {
    padding: 20,
  },
  profileCard: {
    alignItems: "center",
    paddingVertical: 24,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarChar: {
    fontSize: 26,
    fontWeight: "800",
    color: "#ffffff",
  },
  userName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 2,
  },
  userIdText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 18,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  infoLabel: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },
  infoVal: {
    fontSize: 13,
    color: "#0f172a",
    fontWeight: "700",
  },
  sectionCard: {
    padding: 18,
    marginBottom: 20,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 14,
  },
  passwordForm: {
    gap: 10,
  },
  passwordActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  logoutBtn: {
    width: "100%",
    marginBottom: 32,
  },
});

export default ProfileScreen;
