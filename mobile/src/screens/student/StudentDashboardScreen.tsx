import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { studentApi, StudentDashboardInsights, StudentNotification } from "../../api/studentApi";
import { examApi } from "../../api/examApi";
import { AssignedTest } from "../../types/exam";
import ShineLogo from "../../components/ShineLogo";
import Card from "../../components/Card";
import Badge from "../../components/Badge";
import Button from "../../components/Button";

interface StudentDashboardScreenProps {
  onStartTest: (testId: string) => void;
  onNavigateToTab: (tab: string) => void;
  onOpenReport: (attemptId: string) => void;
}

export const StudentDashboardScreen: React.FC<StudentDashboardScreenProps> = ({
  onStartTest,
  onNavigateToTab,
  onOpenReport,
}) => {
  const { user, userId, logout } = useAuth();
  const { tenant, isFeatureEnabled } = useTenant();

  const [insights, setInsights] = useState<StudentDashboardInsights>({
    testsTaken: 0,
    testsPassed: 0,
    avgScore: 0,
    bestScore: 0,
    streak: 0,
  });
  const [activeTests, setActiveTests] = useState<AssignedTest[]>([]);
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [insRes, testRes, notifRes] = await Promise.all([
        studentApi.getDashboardInsights(userId).catch(() => ({
          insights: { testsTaken: 0, testsPassed: 0, avgScore: 0, bestScore: 0, streak: 0 },
        })),
        examApi.getAssignedTests(userId).catch(() => ({ tests: [] })),
        studentApi.getNotifications(userId).catch(() => ({ notifications: [], unreadCount: 0 })),
      ]);

      setInsights(insRes.insights);
      setActiveTests((testRes.tests || []).filter((t) => t.status === "active"));
      setNotifications(notifRes.notifications || []);
    } catch (e) {
      console.warn("Failed to load student dashboard data:", e);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const displayName = user?.name || userId || "Candidate";

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <ShineLogo size="sm" />
        <TouchableOpacity style={styles.profileBtn} onPress={() => onNavigateToTab("Profile")}>
          <Text style={styles.profileBtnText}>{displayName.charAt(0).toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Welcome Greeting Banner */}
        <View style={styles.greetingCard}>
          <Text style={styles.greetingEyebrow}>WELCOME BACK</Text>
          <Text style={styles.greetingTitle}>Hello, {displayName} 👋</Text>
          <Text style={styles.greetingSubtitle}>
            {tenant?.name || "Your examination workspace is ready."}
          </Text>
        </View>

        {/* Performance Insights Row */}
        <View style={styles.insightsRow}>
          <Card style={styles.insightCard}>
            <Text style={styles.insightIcon}>📝</Text>
            <Text style={styles.insightVal}>{insights.testsTaken}</Text>
            <Text style={styles.insightLbl}>Tests Taken</Text>
          </Card>

          <Card style={styles.insightCard}>
            <Text style={styles.insightIcon}>🎯</Text>
            <Text style={styles.insightVal}>{insights.avgScore}%</Text>
            <Text style={styles.insightLbl}>Average Score</Text>
          </Card>

          <Card style={styles.insightCard}>
            <Text style={styles.insightIcon}>🔥</Text>
            <Text style={styles.insightVal}>{insights.streak}</Text>
            <Text style={styles.insightLbl}>Pass Streak</Text>
          </Card>
        </View>

        {/* Ready to Attempt Tests Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Ready to Attempt</Text>
          <TouchableOpacity onPress={() => onNavigateToTab("Tests")}>
            <Text style={styles.viewAllText}>View All ({activeTests.length}) →</Text>
          </TouchableOpacity>
        </View>

        {activeTests.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyTitle}>All Caught Up!</Text>
            <Text style={styles.emptySubtitle}>
              You have no active pending tests scheduled right now.
            </Text>
          </Card>
        ) : (
          activeTests.slice(0, 3).map((test) => {
            const isResume = test.attemptStatus === "in_progress";
            return (
              <Card key={test.id} style={styles.testCard}>
                <View style={styles.testCardHeader}>
                  <Badge
                    label={isResume ? "IN PROGRESS" : "ACTIVE"}
                    variant={isResume ? "warning" : "success"}
                    size="sm"
                  />
                  <Text style={styles.testDuration}>⏱️ {test.duration} Mins</Text>
                </View>

                <Text style={styles.testName}>{test.name}</Text>

                <View style={styles.testMetaRow}>
                  <Text style={styles.testMetaText}>
                    {test.questions} Questions • {test.categoryName || "General"}
                  </Text>
                </View>

                <Button
                  title={isResume ? "Resume Examination →" : "Start Examination →"}
                  size="md"
                  variant={isResume ? "warning" : "primary"}
                  onPress={() => onStartTest(test.id)}
                  style={styles.startTestBtn}
                />
              </Card>
            );
          })
        )}

        {/* Quick Study Navigation Grid */}
        <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 12 }]}>
          Learning & Resources
        </Text>

        <View style={styles.quickNavGrid}>
          {isFeatureEnabled("videoClasses") && (
            <TouchableOpacity
              style={styles.quickNavCard}
              onPress={() => onNavigateToTab("Classes")}
            >
              <Text style={styles.quickNavIcon}>🎬</Text>
              <Text style={styles.quickNavTitle}>Video Classes</Text>
              <Text style={styles.quickNavDesc}>Recorded lectures</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.quickNavCard}
            onPress={() => onNavigateToTab("Reports")}
          >
            <Text style={styles.quickNavIcon}>📊</Text>
            <Text style={styles.quickNavTitle}>Score Reports</Text>
            <Text style={styles.quickNavDesc}>Performance analysis</Text>
          </TouchableOpacity>

          {isFeatureEnabled("learningDocuments") && (
            <TouchableOpacity
              style={styles.quickNavCard}
              onPress={() => onNavigateToTab("Documents")}
            >
              <Text style={styles.quickNavIcon}>📚</Text>
              <Text style={styles.quickNavTitle}>Documents</Text>
              <Text style={styles.quickNavDesc}>Study materials</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.quickNavCard}
            onPress={() => onNavigateToTab("Bookmarks")}
          >
            <Text style={styles.quickNavIcon}>⭐</Text>
            <Text style={styles.quickNavTitle}>Bookmarks</Text>
            <Text style={styles.quickNavDesc}>Saved questions</Text>
          </TouchableOpacity>
        </View>
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
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  profileBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  content: {
    padding: 20,
  },
  greetingCard: {
    backgroundColor: "#090e1a",
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
  },
  greetingEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#38bdf8",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 4,
  },
  greetingSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
  },
  insightsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  insightCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    marginBottom: 0,
  },
  insightIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  insightVal: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 2,
  },
  insightLbl: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    textAlign: "center",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563eb",
  },
  testCard: {
    padding: 16,
    marginBottom: 12,
  },
  testCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  testDuration: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  testName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 6,
  },
  testMetaRow: {
    marginBottom: 14,
  },
  testMetaText: {
    fontSize: 13,
    color: "#64748b",
  },
  startTestBtn: {
    width: "100%",
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: 28,
  },
  emptyIcon: {
    fontSize: 32,
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
  quickNavGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickNavCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 16,
  },
  quickNavIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  quickNavTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 2,
  },
  quickNavDesc: {
    fontSize: 11,
    color: "#64748b",
  },
});

export default StudentDashboardScreen;
