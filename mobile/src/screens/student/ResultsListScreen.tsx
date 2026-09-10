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
import { examApi } from "../../api/examApi";
import { TestHistoryItem } from "../../types/exam";
import Card from "../../components/Card";
import Badge from "../../components/Badge";

interface ResultsListScreenProps {
  onSelectResult: (attemptId: string) => void;
}

export const ResultsListScreen: React.FC<ResultsListScreenProps> = ({ onSelectResult }) => {
  const { userId } = useAuth();
  const [history, setHistory] = useState<TestHistoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const res = await examApi.getTestHistory(userId);
      setHistory(res.history || []);
    } catch (e) {
      console.warn("Failed to load test history:", e);
    }
  }, [userId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Assessment Reports</Text>
        <Text style={styles.headerSubtitle}>
          Complete examination scorecards, section breakdowns, and answer key reviews.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {history.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No Assessment Results</Text>
            <Text style={styles.emptySubtitle}>
              You haven't completed any examinations yet. Completed tests will show here.
            </Text>
          </Card>
        ) : (
          history.map((item) => (
            <Card
              key={item.attemptId}
              style={styles.card}
              onPress={() => onSelectResult(item.attemptId)}
            >
              <View style={styles.cardHeader}>
                <Badge
                  label={item.passed ? "PASSED" : "NOT PASSED"}
                  variant={item.passed ? "success" : "danger"}
                  size="sm"
                />
                <Text style={styles.dateText}>
                  {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : ""}
                </Text>
              </View>

              <Text style={styles.testTitle}>{item.testName}</Text>

              <View style={styles.scoreRow}>
                <View style={styles.scoreItem}>
                  <Text style={styles.scoreVal}>{item.scoredMarks}</Text>
                  <Text style={styles.scoreLbl}>Scored</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.scoreItem}>
                  <Text style={styles.scoreVal}>{item.totalMarks}</Text>
                  <Text style={styles.scoreLbl}>Total</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.scoreItem}>
                  <Text
                    style={[
                      styles.scoreVal,
                      { color: item.passed ? "#16a34a" : "#dc2626" },
                    ]}
                  >
                    {item.percentage}%
                  </Text>
                  <Text style={styles.scoreLbl}>Percentage</Text>
                </View>
              </View>

              <View style={styles.footerRow}>
                <Text style={styles.viewSolutionsText}>View Detailed Solutions & Analysis →</Text>
              </View>
            </Card>
          ))
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
  listContent: {
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
    marginBottom: 8,
  },
  dateText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  testTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 14,
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 14,
  },
  scoreItem: {
    alignItems: "center",
  },
  scoreVal: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 2,
  },
  scoreLbl: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: "#e2e8f0",
  },
  footerRow: {
    alignItems: "flex-end",
  },
  viewSolutionsText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563eb",
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

export default ResultsListScreen;
