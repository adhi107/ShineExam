import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { examApi } from "../../api/examApi";
import { ResultDetail } from "../../types/exam";
import SensitiveContent from "../../security/SensitiveContent";
import Card from "../../components/Card";
import Badge from "../../components/Badge";
import Button from "../../components/Button";

interface ResultDetailScreenProps {
  attemptId: string;
  onBack: () => void;
}

export const ResultDetailScreen: React.FC<ResultDetailScreenProps> = ({ attemptId, onBack }) => {
  const { userId } = useAuth();
  const [result, setResult] = useState<ResultDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"summary" | "solutions">("summary");
  const [filterType, setFilterType] = useState<"all" | "correct" | "incorrect" | "unattempted">("all");

  const loadResult = useCallback(async () => {
    try {
      const res = await examApi.getResult(attemptId);
      setResult(res.result);
    } catch (e) {
      console.warn("Failed to load result detail:", e);
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    loadResult();
  }, [loadResult]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Generating Performance Analysis...</Text>
      </View>
    );
  }

  if (!result) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Unable to load test report.</Text>
        <Button title="← Return to Reports" variant="outline" onPress={onBack} />
      </View>
    );
  }

  const isPassed = Boolean(result.passed);
  const reviews = result.questionReview || [];

  const filteredReviews = reviews.filter((r) => {
    const isAttempted =
      r.userAnswer !== null &&
      r.userAnswer !== undefined &&
      r.userAnswer !== "" &&
      (Array.isArray(r.userAnswer) ? r.userAnswer.length > 0 : true);

    if (filterType === "correct") return r.isCorrect;
    if (filterType === "incorrect") return isAttempted && !r.isCorrect;
    if (filterType === "unattempted") return !isAttempted;
    return true;
  });

  return (
    <SensitiveContent module="results" userId={userId}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scorecard Analysis</Text>
          <View style={{ width: 48 }} />
        </View>

        {/* View Switcher Tabs */}
        <View style={styles.tabSwitchRow}>
          <TouchableOpacity
            style={[styles.switchTab, activeTab === "summary" && styles.switchTabActive]}
            onPress={() => setActiveTab("summary")}
          >
            <Text
              style={[
                styles.switchTabText,
                activeTab === "summary" && styles.switchTabTextActive,
              ]}
            >
              Summary & Sections
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.switchTab, activeTab === "solutions" && styles.switchTabActive]}
            onPress={() => setActiveTab("solutions")}
          >
            <Text
              style={[
                styles.switchTabText,
                activeTab === "solutions" && styles.switchTabTextActive,
              ]}
            >
              Question Solutions ({reviews.length})
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {activeTab === "summary" ? (
            <>
              {/* Overall Score Card */}
              <Card style={styles.summaryScoreCard}>
                <View style={styles.summaryHeader}>
                  <Text style={styles.summaryTitle}>Overall Performance</Text>
                  <Badge
                    label={isPassed ? "PASSED" : "FAILED"}
                    variant={isPassed ? "success" : "danger"}
                  />
                </View>

                <View style={styles.summaryRow}>
                  <View style={styles.summaryCol}>
                    <Text style={styles.summaryVal}>{result.scoredMarks}</Text>
                    <Text style={styles.summaryLbl}>Marks Scored</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryCol}>
                    <Text style={styles.summaryVal}>{result.totalMarks}</Text>
                    <Text style={styles.summaryLbl}>Total Marks</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryCol}>
                    <Text
                      style={[
                        styles.summaryVal,
                        { color: isPassed ? "#16a34a" : "#dc2626" },
                      ]}
                    >
                      {result.percentage}%
                    </Text>
                    <Text style={styles.summaryLbl}>Percentage</Text>
                  </View>
                </View>
              </Card>

              {/* Section Breakdown Card */}
              {result.sectionWise && Object.keys(result.sectionWise).length > 0 && (
                <Card style={styles.sectionCard}>
                  <Text style={styles.cardHeaderTitle}>Section-wise Performance</Text>
                  {Object.entries(result.sectionWise).map(([sectionName, stats]) => {
                    const secPct =
                      stats.total > 0
                        ? Math.round((stats.scored / stats.total) * 100)
                        : 0;
                    return (
                      <View key={sectionName} style={styles.sectionRow}>
                        <View style={styles.sectionNameCol}>
                          <Text style={styles.sectionNameText}>{sectionName}</Text>
                          <Text style={styles.sectionMarksText}>
                            Scored {stats.scored} of {stats.total} marks
                          </Text>
                        </View>
                        <Badge
                          label={`${secPct}%`}
                          variant={secPct >= 40 ? "success" : "warning"}
                          size="sm"
                        />
                      </View>
                    );
                  })}
                </Card>
              )}
            </>
          ) : (
            <>
              {/* Question Solution Filters */}
              <View style={styles.filterPillsRow}>
                {(["all", "correct", "incorrect", "unattempted"] as const).map((filter) => {
                  const isActive = filterType === filter;
                  const labels = {
                    all: "All",
                    correct: "Correct ✓",
                    incorrect: "Incorrect ✕",
                    unattempted: "Skipped",
                  };
                  return (
                    <TouchableOpacity
                      key={filter}
                      style={[styles.filterPill, isActive && styles.filterPillActive]}
                      onPress={() => setFilterType(filter)}
                    >
                      <Text
                        style={[
                          styles.filterPillText,
                          isActive && styles.filterPillTextActive,
                        ]}
                      >
                        {labels[filter]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Question Solution Cards */}
              {filteredReviews.map((item, idx) => (
                <Card key={item.questionId || idx} style={styles.solutionCard}>
                  <View style={styles.solutionHeader}>
                    <Badge
                      label={`Q${idx + 1} • ${item.section || "General"}`}
                      variant="neutral"
                      size="sm"
                    />
                    <Badge
                      label={
                        item.isCorrect
                          ? `+${item.marks} (Correct)`
                          : item.userAnswer
                          ? `${item.marks || 0} (Incorrect)`
                          : "0 (Unattempted)"
                      }
                      variant={
                        item.isCorrect
                          ? "success"
                          : item.userAnswer
                          ? "danger"
                          : "neutral"
                      }
                      size="sm"
                    />
                  </View>

                  <Text style={styles.questionText}>{item.question}</Text>

                  {/* Options Comparison */}
                  <View style={styles.optionsReviewBox}>
                    {item.options?.map((opt, optIdx) => {
                      const optKey = String(optIdx);
                      const isCorrectAnswer =
                        Array.isArray(item.correctAnswer)
                          ? item.correctAnswer.includes(optKey) || item.correctAnswer.includes(opt)
                          : item.correctAnswer === optKey || item.correctAnswer === opt;

                      const isUserChoice =
                        Array.isArray(item.userAnswer)
                          ? item.userAnswer.includes(optKey) || item.userAnswer.includes(opt)
                          : item.userAnswer === optKey || item.userAnswer === opt;

                      return (
                        <View
                          key={optIdx}
                          style={[
                            styles.optionReviewRow,
                            isCorrectAnswer && styles.optionCorrect,
                            isUserChoice && !isCorrectAnswer && styles.optionWrong,
                          ]}
                        >
                          <Text style={styles.optionLetter}>
                            {String.fromCharCode(65 + optIdx)}.
                          </Text>
                          <Text style={styles.optionReviewText}>{opt}</Text>
                          {isCorrectAnswer && <Text style={styles.correctCheck}>✓ Correct</Text>}
                          {isUserChoice && !isCorrectAnswer && (
                            <Text style={styles.wrongCross}>✕ Your Choice</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>

                  {/* Time Benchmark Stats */}
                  {(item.timeSpentSec || item.avgTimeSec || item.topperTimeSec) ? (
                    <View style={styles.timeBenchmarkRow}>
                      <Text style={styles.timeBenchmarkItem}>
                        ⏱️ You: <Text style={{ fontWeight: "800" }}>{item.timeSpentSec || 0}s</Text>
                      </Text>
                      <Text style={styles.timeBenchmarkItem}>
                        👥 Avg: <Text style={{ fontWeight: "800" }}>{item.avgTimeSec || 0}s</Text>
                      </Text>
                      <Text style={styles.timeBenchmarkItem}>
                        🏆 Topper: <Text style={{ fontWeight: "800" }}>{item.topperTimeSec || 0}s</Text>
                      </Text>
                    </View>
                  ) : null}
                </Card>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </SensitiveContent>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: "#ef4444",
    marginBottom: 16,
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
  tabSwitchRow: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  switchTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  switchTabActive: {
    borderBottomWidth: 2.5,
    borderBottomColor: "#2563eb",
  },
  switchTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  switchTabTextActive: {
    color: "#2563eb",
    fontWeight: "800",
  },
  content: {
    padding: 20,
  },
  summaryScoreCard: {
    padding: 18,
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingVertical: 14,
  },
  summaryCol: {
    alignItems: "center",
  },
  summaryVal: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 2,
  },
  summaryLbl: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#e2e8f0",
  },
  sectionCard: {
    padding: 18,
    marginBottom: 16,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 12,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  sectionNameCol: {
    flex: 1,
  },
  sectionNameText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
  },
  sectionMarksText: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  filterPillsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  filterPillActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  filterPillTextActive: {
    color: "#ffffff",
  },
  solutionCard: {
    padding: 18,
    marginBottom: 14,
  },
  solutionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  questionText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: 22,
    marginBottom: 14,
  },
  optionsReviewBox: {
    gap: 8,
    marginBottom: 12,
  },
  optionReviewRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  optionCorrect: {
    backgroundColor: "#ecfdf5",
    borderColor: "#10b981",
  },
  optionWrong: {
    backgroundColor: "#fef2f2",
    borderColor: "#ef4444",
  },
  optionLetter: {
    fontSize: 13,
    fontWeight: "800",
    color: "#64748b",
    marginRight: 8,
  },
  optionReviewText: {
    fontSize: 13,
    color: "#1e293b",
    flex: 1,
  },
  correctCheck: {
    fontSize: 12,
    fontWeight: "800",
    color: "#16a34a",
  },
  wrongCross: {
    fontSize: 12,
    fontWeight: "800",
    color: "#ef4444",
  },
  timeBenchmarkRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingVertical: 8,
  },
  timeBenchmarkItem: {
    fontSize: 11,
    color: "#475569",
  },
});

export default ResultDetailScreen;
