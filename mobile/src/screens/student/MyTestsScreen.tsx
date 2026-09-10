import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { examApi } from "../../api/examApi";
import { AssignedTest } from "../../types/exam";
import Card from "../../components/Card";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import Input from "../../components/Input";
import { useTenant } from "../../context/TenantContext";

type TestTab = "active" | "upcoming" | "missed" | "completed";

interface MyTestsScreenProps {
  onStartTest: (testId: string) => void;
  onViewResult: (attemptId: string) => void;
}

export const MyTestsScreen: React.FC<MyTestsScreenProps> = ({
  onStartTest,
  onViewResult,
}) => {
  const { userId } = useAuth();
  const { theme } = useTenant();

  const [tests, setTests] = useState<AssignedTest[]>([]);
  const [activeTab, setActiveTab] = useState<TestTab>("active");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadTests = useCallback(async () => {
    try {
      const res = await examApi.getAssignedTests(userId);
      setTests(res.tests || []);
    } catch (e) {
      console.warn("Failed to load assigned tests:", e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTests();
    setRefreshing(false);
  };

  const filteredTests = useMemo(() => {
    return tests.filter((t) => {
      // 1. Tab filter
      const matchesTab =
        (activeTab === "active" && t.status === "active" && !t.attempted) ||
        (activeTab === "upcoming" && t.status === "upcoming") ||
        (activeTab === "missed" && t.status === "expired" && !t.attempted) ||
        (activeTab === "completed" && (t.attempted || t.attemptStatus === "submitted"));

      // 2. Search filter
      const matchesSearch =
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.categoryName && t.categoryName.toLowerCase().includes(search.toLowerCase()));

      return matchesTab && matchesSearch;
    });
  }, [tests, activeTab, search]);

  const getTabCount = (tab: TestTab): number => {
    return tests.filter((t) => {
      if (tab === "active") return t.status === "active" && !t.attempted;
      if (tab === "upcoming") return t.status === "upcoming";
      if (tab === "missed") return t.status === "expired" && !t.attempted;
      return t.attempted || t.attemptStatus === "submitted";
    }).length;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Examinations</Text>
        <Text style={styles.headerSubtitle}>
          Practice tests and scheduled timed assessments assigned to your profile.
        </Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Input
          placeholder="Search tests by title or category..."
          value={search}
          onChangeText={setSearch}
          containerStyle={{ marginBottom: 0 }}
        />
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {(["active", "upcoming", "completed", "missed"] as TestTab[]).map((tab) => {
          const isActive = activeTab === tab;
          const count = getTabCount(tab);
          const tabLabels = {
            active: "Active",
            upcoming: "Upcoming",
            completed: "Completed",
            missed: "Expired",
          };

          return (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabButton,
                isActive && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2.5 },
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  isActive && { color: theme.colors.primary, fontWeight: "800" },
                ]}
              >
                {tabLabels[tab]} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Test List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredTests.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No Tests Found</Text>
            <Text style={styles.emptySubtitle}>
              {search
                ? "No examinations match your current search query."
                : `You currently have no ${activeTab} assessments.`}
            </Text>
          </Card>
        ) : (
          filteredTests.map((test) => {
            const isResume = test.attemptStatus === "in_progress";
            const isCompleted = test.attempted || test.attemptStatus === "submitted";

            return (
              <Card key={test.id} style={styles.testCard}>
                <View style={styles.cardHeader}>
                  <Badge
                    label={
                      isCompleted
                        ? "COMPLETED"
                        : isResume
                        ? "IN PROGRESS"
                        : test.status.toUpperCase()
                    }
                    variant={isCompleted ? "info" : isResume ? "warning" : "success"}
                    size="sm"
                  />
                  <Text style={styles.durationText}>⏱️ {test.duration} Mins</Text>
                </View>

                <Text style={styles.testName}>{test.name}</Text>

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>
                    📝 {test.questions} Questions • 🎯 {test.totalMarks || test.questions} Marks
                  </Text>
                  {test.categoryName ? (
                    <Text style={styles.categoryText}>📂 {test.categoryName}</Text>
                  ) : null}
                </View>

                {isCompleted ? (
                  <Button
                    title="View Result Report →"
                    variant="outline"
                    size="md"
                    onPress={() => {
                      if (test.attemptId) onViewResult(test.attemptId);
                    }}
                  />
                ) : activeTab === "upcoming" ? (
                  <Button
                    title="Available Soon"
                    variant="secondary"
                    size="md"
                    disabled
                  />
                ) : activeTab === "missed" ? (
                  <Button
                    title="Examination Expired"
                    variant="danger"
                    size="md"
                    disabled
                  />
                ) : (
                  <Button
                    title={isResume ? "Resume Assessment →" : "Start Assessment →"}
                    variant={isResume ? "warning" : "primary"}
                    size="md"
                    onPress={() => onStartTest(test.id)}
                  />
                )}
              </Card>
            );
          })
        )}
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
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
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
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  tabsRow: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  listContent: {
    padding: 20,
  },
  testCard: {
    marginBottom: 14,
    padding: 18,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  durationText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
  },
  testName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  metaRow: {
    marginBottom: 16,
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },
  categoryText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
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

export default MyTestsScreen;
