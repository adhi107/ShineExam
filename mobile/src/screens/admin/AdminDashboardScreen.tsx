import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { adminApi } from "../../api/adminApi";
import Card from "../../components/Card";
import ShineLogo from "../../components/ShineLogo";
import Button from "../../components/Button";

interface AdminDashboardScreenProps {
  onNavigateToViolations: () => void;
}

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({
  onNavigateToViolations,
}) => {
  const { user, userId, logout } = useAuth();
  const { tenant } = useTenant();

  const [stats, setStats] = useState({
    totalStudents: 0,
    activeExams: 0,
    totalAttempts: 0,
    activeViolations: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const res = await adminApi.getDashboardStats().catch(() => ({}));
      setStats({
        totalStudents: res.totalStudents || 0,
        activeExams: res.activeExams || 0,
        totalAttempts: res.totalAttempts || 0,
        activeViolations: res.activeViolations || 0,
      });
    } catch (e) {
      console.warn("Failed to load admin stats:", e);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ShineLogo size="sm" />
        <Button title="Sign Out" variant="ghost" size="sm" onPress={logout} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Org Banner */}
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>ADMINISTRATOR CONSOLE</Text>
          <Text style={styles.heroTitle}>{tenant?.name || "Main Organization"}</Text>
          <Text style={styles.heroSubtitle}>Logged in as Administrator: {userId}</Text>
        </View>

        {/* Stats Grid */}
        <Text style={styles.sectionTitle}>Overview Analytics</Text>
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={styles.statIcon}>👥</Text>
            <Text style={styles.statVal}>{stats.totalStudents}</Text>
            <Text style={styles.statLbl}>Registered Students</Text>
          </Card>

          <Card style={styles.statCard}>
            <Text style={styles.statIcon}>📝</Text>
            <Text style={styles.statVal}>{stats.activeExams}</Text>
            <Text style={styles.statLbl}>Active Exams</Text>
          </Card>

          <Card style={styles.statCard}>
            <Text style={styles.statIcon}>📊</Text>
            <Text style={styles.statVal}>{stats.totalAttempts}</Text>
            <Text style={styles.statLbl}>Submitted Attempts</Text>
          </Card>

          <Card style={[styles.statCard, { borderColor: "#fca5a5", backgroundColor: "#fff5f5" }]}>
            <Text style={styles.statIcon}>🚫</Text>
            <Text style={[styles.statVal, { color: "#dc2626" }]}>{stats.activeViolations}</Text>
            <Text style={[styles.statLbl, { color: "#991b1b" }]}>Security Incidents</Text>
          </Card>
        </View>

        {/* Quick Management Actions */}
        <Text style={styles.sectionTitle}>Security & Management</Text>

        <Card
          style={styles.actionCard}
          onPress={onNavigateToViolations}
        >
          <View style={styles.actionIconCircle}>
            <Text style={styles.actionIcon}>🛡️</Text>
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Security Violations Dashboard</Text>
            <Text style={styles.actionSubtitle}>
              Review screenshot attempts, screen recording alerts, and unblock candidate accounts.
            </Text>
          </View>
          <Text style={styles.actionChevron}>→</Text>
        </Card>
      </ScrollView>
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
  content: {
    padding: 20,
  },
  heroCard: {
    backgroundColor: "#090e1a",
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#38bdf8",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: "48%",
    alignItems: "center",
    paddingVertical: 16,
    marginBottom: 0,
  },
  statIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  statVal: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 2,
  },
  statLbl: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    textAlign: "center",
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 12,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  actionIcon: {
    fontSize: 22,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 3,
  },
  actionSubtitle: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 16,
  },
  actionChevron: {
    fontSize: 18,
    fontWeight: "800",
    color: "#94a3b8",
    marginLeft: 8,
  },
});

export default AdminDashboardScreen;
