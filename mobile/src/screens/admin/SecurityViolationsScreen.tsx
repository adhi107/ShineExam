import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { adminApi } from "../../api/adminApi";
import Card from "../../components/Card";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import ConfirmDialog from "../../components/ConfirmDialog";

interface SecurityViolationsScreenProps {
  onBack: () => void;
}

export const SecurityViolationsScreen: React.FC<SecurityViolationsScreenProps> = ({ onBack }) => {
  const [violations, setViolations] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUserToUnblock, setSelectedUserToUnblock] = useState<string | null>(null);
  const [unblocking, setUnblocking] = useState(false);

  const loadViolations = useCallback(async () => {
    try {
      const res = await adminApi.getViolations();
      setViolations(res.violations || []);
    } catch (e) {
      console.warn("Failed to load violations:", e);
    }
  }, []);

  useEffect(() => {
    loadViolations();
  }, [loadViolations]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadViolations();
    setRefreshing(false);
  };

  const handleUnblock = async () => {
    if (!selectedUserToUnblock) return;
    setUnblocking(true);
    try {
      await adminApi.unblockUser(selectedUserToUnblock);
      setSelectedUserToUnblock(null);
      await loadViolations();
    } catch (e: any) {
      alert(e?.message || "Failed to unblock user.");
    } finally {
      setUnblocking(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Security Violations</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {violations.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🛡️</Text>
            <Text style={styles.emptyTitle}>Zero Security Incidents</Text>
            <Text style={styles.emptySubtitle}>
              No screenshot or screen recording policy violations have been recorded for your organization.
            </Text>
          </Card>
        ) : (
          violations.map((item, idx) => {
            const isSuspended = !item.isActive;
            return (
              <Card key={item.userId || idx} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Badge
                    label={isSuspended ? "PERMANENTLY BLOCKED" : "ACTIVE / WARNED"}
                    variant={isSuspended ? "danger" : "warning"}
                    size="sm"
                  />
                  <Text style={styles.attemptText}>
                    Attempts: {item.violationCount || item.timesViolated || 1}
                  </Text>
                </View>

                <Text style={styles.userName}>{item.name || item.userId}</Text>
                <Text style={styles.userIdText}>User ID: {item.userId}</Text>

                {item.statusReason || item.blockedDueTo ? (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>Reason:</Text>
                    <Text style={styles.reasonText}>
                      {item.blockedDueTo || item.statusReason}
                    </Text>
                  </View>
                ) : null}

                {isSuspended ? (
                  <Button
                    title="Unblock Candidate Account 🔓"
                    variant="outline"
                    size="sm"
                    onPress={() => setSelectedUserToUnblock(item.userId)}
                    style={styles.unblockBtn}
                  />
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Unblock Confirm Modal */}
      <ConfirmDialog
        visible={Boolean(selectedUserToUnblock)}
        title="Unblock Candidate?"
        message={`Are you sure you want to unblock student account "${selectedUserToUnblock}" and restore assessment examination permissions?`}
        confirmText="Confirm Unblock"
        cancelText="Cancel"
        loading={unblocking}
        onConfirm={handleUnblock}
        onCancel={() => setSelectedUserToUnblock(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  content: {
    padding: 20,
  },
  card: {
    padding: 18,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  attemptText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#dc2626",
  },
  userName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 2,
  },
  userIdText: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 12,
  },
  reasonBox: {
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#fee2e2",
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#991b1b",
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 12,
    color: "#7f1d1d",
    lineHeight: 16,
  },
  unblockBtn: {
    alignSelf: "flex-end",
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: 36,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
  },
});

export default SecurityViolationsScreen;
