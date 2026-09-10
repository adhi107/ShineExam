import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import Button from "../../components/Button";
import Card from "../../components/Card";
import ShineLogo from "../../components/ShineLogo";
import { ExamForTaking } from "../../types/exam";
import { useTenant } from "../../context/TenantContext";

interface TestInstructionsScreenProps {
  test: ExamForTaking;
  userId: string;
  onStartExam: () => void;
  onBack: () => void;
}

export const TestInstructionsScreen: React.FC<TestInstructionsScreenProps> = ({
  test,
  userId,
  onStartExam,
  onBack,
}) => {
  const { theme } = useTenant();
  const [hasAgreed, setHasAgreed] = useState(false);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ShineLogo size="sm" />
        <Button title="← Back" variant="ghost" size="sm" onPress={onBack} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>General Instructions</Text>
        <Text style={styles.subtitle}>
          Please read the following instructions carefully before starting the test.
        </Text>

        {/* 1. General Rules Card */}
        <Card style={styles.instructionCard}>
          <Text style={styles.cardHeader}>1. Navigation & Question Palette</Text>
          <Text style={styles.bulletPoint}>
            • The total duration of the examination is <Text style={{ fontWeight: "700" }}>{test.duration} minutes</Text>.
          </Text>
          <Text style={styles.bulletPoint}>
            • The clock will be displayed in the top bar. When the timer reaches zero, the examination will end automatically.
          </Text>
          <Text style={styles.bulletPoint}>
            • Tap the <Text style={{ fontWeight: "700" }}>Grid Icon</Text> on the top right at any time to open the Question Palette and jump to any question.
          </Text>
        </Card>

        {/* 2. Palette Color Code Card */}
        <Card style={styles.instructionCard}>
          <Text style={styles.cardHeader}>2. Question Palette Symbols</Text>
          <View style={styles.symbolRow}>
            <View style={[styles.symbolBadge, { backgroundColor: "#16a34a" }]} />
            <Text style={styles.symbolText}>
              <Text style={{ fontWeight: "700", color: "#16a34a" }}>Green</Text>: You have answered the question.
            </Text>
          </View>
          <View style={styles.symbolRow}>
            <View style={[styles.symbolBadge, { backgroundColor: "#ea580c" }]} />
            <Text style={styles.symbolText}>
              <Text style={{ fontWeight: "700", color: "#ea580c" }}>Orange</Text>: You have visited but not answered.
            </Text>
          </View>
          <View style={styles.symbolRow}>
            <View style={[styles.symbolBadge, { backgroundColor: "#9333ea" }]} />
            <Text style={styles.symbolText}>
              <Text style={{ fontWeight: "700", color: "#9333ea" }}>Purple</Text>: Marked for review (not answered).
            </Text>
          </View>
          <View style={styles.symbolRow}>
            <View style={[styles.symbolBadge, { backgroundColor: "#4f46e5" }]} />
            <Text style={styles.symbolText}>
              <Text style={{ fontWeight: "700", color: "#4f46e5" }}>Indigo</Text>: Answered & Marked for review (will be evaluated).
            </Text>
          </View>
          <View style={styles.symbolRow}>
            <View style={[styles.symbolBadge, { backgroundColor: "#e2e8f0" }]} />
            <Text style={styles.symbolText}>
              <Text style={{ fontWeight: "700", color: "#475569" }}>Gray</Text>: You have not visited the question yet.
            </Text>
          </View>
        </Card>

        {/* 3. Security Warning */}
        <Card style={[styles.instructionCard, { borderColor: "#fca5a5", backgroundColor: "#fff5f5" }]}>
          <Text style={[styles.cardHeader, { color: "#dc2626" }]}>3. Security & Anti-Cheat Policy</Text>
          <Text style={[styles.bulletPoint, { color: "#7f1d1d" }]}>
            • Attempting screenshots or screen sharing is prohibited and will trigger an instant account suspension.
          </Text>
          <Text style={[styles.bulletPoint, { color: "#7f1d1d" }]}>
            • Do NOT minimize or switch apps during the test. Your activity is logged.
          </Text>
        </Card>

        {/* Candidate Declaration Checkbox */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.declarationRow}
          onPress={() => setHasAgreed((v) => !v)}
        >
          <View
            style={[
              styles.checkbox,
              hasAgreed && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
            ]}
          >
            {hasAgreed && <Text style={styles.checkChar}>✓</Text>}
          </View>
          <Text style={styles.declarationText}>
            I have read and understood all the instructions. I declare that I am candidate <Text style={{ fontWeight: "800" }}>{userId}</Text> and will adhere to all examination integrity guidelines.
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Footer Start Button */}
      <View style={styles.footer}>
        <Button
          title="I am Ready to Begin →"
          size="lg"
          disabled={!hasAgreed}
          onPress={onStartExam}
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
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
    marginBottom: 20,
  },
  instructionCard: {
    marginBottom: 16,
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 20,
    marginBottom: 8,
  },
  symbolRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  symbolBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  symbolText: {
    fontSize: 13,
    color: "#334155",
    flex: 1,
    lineHeight: 18,
  },
  declarationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkChar: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  declarationText: {
    fontSize: 13,
    color: "#1e293b",
    flex: 1,
    lineHeight: 19,
  },
  footer: {
    padding: 20,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
});

export default TestInstructionsScreen;
