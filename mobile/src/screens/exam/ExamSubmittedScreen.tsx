import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { ResultDetail } from "../../types/exam";
import Button from "../../components/Button";
import Card from "../../components/Card";
import ShineLogo from "../../components/ShineLogo";
import Badge from "../../components/Badge";

interface ExamSubmittedScreenProps {
  result: ResultDetail;
  testName: string;
  onViewReport: () => void;
  onReturnDashboard: () => void;
}

export const ExamSubmittedScreen: React.FC<ExamSubmittedScreenProps> = ({
  result,
  testName,
  onViewReport,
  onReturnDashboard,
}) => {
  const isPassed = Boolean(result.passed);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ShineLogo size="sm" />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Success Icon */}
        <View style={styles.iconCircle}>
          <Text style={styles.iconChar}>✓</Text>
        </View>

        <Text style={styles.title}>🎉 Congratulations!</Text>
        <Text style={styles.subtitle}>Exam Submitted Successfully</Text>
        <Text style={styles.testNameText}>{testName}</Text>

        {/* Score Summary Card */}
        <Card style={styles.scoreCard}>
          <View style={styles.scoreHeader}>
            <Text style={styles.scoreTitle}>Assessment Scorecard</Text>
            <Badge
              label={isPassed ? "PASSED" : "NEEDS IMPROVEMENT"}
              variant={isPassed ? "success" : "danger"}
            />
          </View>

          <View style={styles.scoreRow}>
            <View style={styles.scoreCol}>
              <Text style={styles.scoreVal}>{result.scoredMarks}</Text>
              <Text style={styles.scoreLbl}>Marks Scored</Text>
            </View>

            <View style={styles.scoreDivider} />

            <View style={styles.scoreCol}>
              <Text style={styles.scoreVal}>{result.totalMarks}</Text>
              <Text style={styles.scoreLbl}>Total Marks</Text>
            </View>

            <View style={styles.scoreDivider} />

            <View style={styles.scoreCol}>
              <Text style={[styles.scoreVal, { color: isPassed ? "#16a34a" : "#dc2626" }]}>
                {result.percentage}%
              </Text>
              <Text style={styles.scoreLbl}>Percentage</Text>
            </View>
          </View>
        </Card>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Detailed Solution & Breakdown</Text>
            <Text style={styles.infoDesc}>
              A comprehensive question-by-question answer key, topper time comparison, and subject analytics are ready in your Reports.
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <Button
          title="View Detailed Solutions & Reports →"
          size="lg"
          onPress={onViewReport}
          style={styles.primaryActionBtn}
        />

        <Button
          title="Return to Candidate Dashboard"
          variant="outline"
          size="lg"
          onPress={onReturnDashboard}
        />
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
    alignItems: "center",
  },
  content: {
    padding: 24,
    alignItems: "center",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 16,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  iconChar: {
    fontSize: 36,
    fontWeight: "900",
    color: "#ffffff",
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2563eb",
    marginBottom: 6,
  },
  testNameText: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 24,
    textAlign: "center",
  },
  scoreCard: {
    width: "100%",
    padding: 20,
    marginBottom: 20,
  },
  scoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 12,
    marginBottom: 16,
  },
  scoreTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  scoreCol: {
    alignItems: "center",
  },
  scoreVal: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 4,
  },
  scoreLbl: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  scoreDivider: {
    width: 1,
    height: 36,
    backgroundColor: "#e2e8f0",
  },
  infoBanner: {
    flexDirection: "row",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    alignItems: "flex-start",
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 10,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1e40af",
    marginBottom: 2,
  },
  infoDesc: {
    fontSize: 12,
    color: "#1e3a8a",
    lineHeight: 17,
  },
  primaryActionBtn: {
    width: "100%",
    marginBottom: 12,
  },
});

export default ExamSubmittedScreen;
