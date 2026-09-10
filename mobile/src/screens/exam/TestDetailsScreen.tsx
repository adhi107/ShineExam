import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import Button from "../../components/Button";
import Card from "../../components/Card";
import ShineLogo from "../../components/ShineLogo";
import { ExamForTaking } from "../../types/exam";
import { useTenant } from "../../context/TenantContext";

interface TestDetailsScreenProps {
  test: ExamForTaking;
  onProceedToInstructions: () => void;
  onCancel: () => void;
}

export const TestDetailsScreen: React.FC<TestDetailsScreenProps> = ({
  test,
  onProceedToInstructions,
  onCancel,
}) => {
  const { theme } = useTenant();

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <ShineLogo size="sm" />
        <Button title="Exit" variant="ghost" size="sm" onPress={onCancel} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.badgeRow}>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>ASSESSMENT SPECIFICATION</Text>
          </View>
        </View>

        <Text style={styles.title}>{test.testName}</Text>
        <Text style={styles.subtitle}>
          Please review the examination parameters and structure before proceeding to instructions.
        </Text>

        {/* Spec Grid */}
        <View style={styles.specGrid}>
          <Card style={styles.specCard}>
            <Text style={styles.specIcon}>⏱️</Text>
            <Text style={styles.specValue}>{test.duration} Mins</Text>
            <Text style={styles.specLabel}>Total Duration</Text>
          </Card>

          <Card style={styles.specCard}>
            <Text style={styles.specIcon}>📝</Text>
            <Text style={styles.specValue}>{test.questions.length}</Text>
            <Text style={styles.specLabel}>Total Questions</Text>
          </Card>

          <Card style={styles.specCard}>
            <Text style={styles.specIcon}>🎯</Text>
            <Text style={styles.specValue}>{test.totalMarks || test.questions.length}</Text>
            <Text style={styles.specLabel}>Total Marks</Text>
          </Card>

          <Card style={styles.specCard}>
            <Text style={styles.specIcon}>🏆</Text>
            <Text style={styles.specValue}>{test.passingPercentage || 40}%</Text>
            <Text style={styles.specLabel}>Pass Mark</Text>
          </Card>
        </View>

        {/* Section Structure Card */}
        {test.sections && test.sections.length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionCardTitle}>Section Breakdown</Text>
            {test.sections.map((sec, idx) => {
              const count = test.questions.filter((q) => q.section === sec).length;
              return (
                <View key={idx} style={styles.sectionRow}>
                  <Text style={styles.sectionName}>{sec}</Text>
                  <Text style={styles.sectionCount}>{count} Questions</Text>
                </View>
              );
            })}
          </Card>
        )}

        {/* Security Notice */}
        <View style={styles.securityBox}>
          <Text style={styles.securityIcon}>🔒</Text>
          <View style={styles.securityTextWrap}>
            <Text style={styles.securityTitle}>Secure Assessment Environment</Text>
            <Text style={styles.securityDesc}>
              This exam is protected by hardware screenshot prevention, session watermarking, and active attempt monitoring.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Footer */}
      <View style={styles.footer}>
        <Button
          title="Read Instructions →"
          size="lg"
          onPress={onProceedToInstructions}
        />
      </View>
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
  badgeRow: {
    marginBottom: 8,
  },
  liveBadge: {
    backgroundColor: "#dbeafe",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1e40af",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
    marginBottom: 20,
  },
  specGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  specCard: {
    width: "48%",
    alignItems: "center",
    paddingVertical: 18,
  },
  specIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  specValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 2,
  },
  specLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  sectionCard: {
    marginBottom: 16,
  },
  sectionCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 12,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  sectionName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563eb",
  },
  securityBox: {
    flexDirection: "row",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    alignItems: "flex-start",
  },
  securityIcon: {
    fontSize: 22,
    marginRight: 12,
    marginTop: 2,
  },
  securityTextWrap: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1e40af",
    marginBottom: 2,
  },
  securityDesc: {
    fontSize: 12,
    color: "#1e3a8a",
    lineHeight: 17,
  },
  footer: {
    padding: 20,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
});

export default TestDetailsScreen;
