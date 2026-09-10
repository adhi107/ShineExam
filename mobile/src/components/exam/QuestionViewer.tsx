import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { Question } from "../../types/exam";
import Badge from "../Badge";
import { useTenant } from "../../context/TenantContext";

interface QuestionViewerProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  selectedAnswer: string | string[];
  isMarked: boolean;
  fontSize?: "normal" | "large";
  onAnswerChange: (answer: string | string[]) => void;
  onToggleMarkForReview: () => void;
  onClearResponse: () => void;
}

export const QuestionViewer: React.FC<QuestionViewerProps> = ({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswer,
  isMarked,
  fontSize = "normal",
  onAnswerChange,
  onToggleMarkForReview,
  onClearResponse,
}) => {
  const { theme } = useTenant();
  const isLargeFont = fontSize === "large";

  const isMultiple =
    question.type === "msq" ||
    question.type === "multiple" ||
    Array.isArray(question.correctAnswer);

  const handleOptionPress = (optionValue: string, index: number) => {
    // Standardize answer storage as 0-indexed string index (e.g. "0", "1") or literal option value
    const key = String(index);

    if (isMultiple) {
      const currentList = Array.isArray(selectedAnswer) ? [...selectedAnswer] : [];
      const existsIndex = currentList.indexOf(key);
      if (existsIndex >= 0) {
        currentList.splice(existsIndex, 1);
      } else {
        currentList.push(key);
      }
      onAnswerChange(currentList);
    } else {
      onAnswerChange(key);
    }
  };

  const isOptionSelected = (index: number): boolean => {
    const key = String(index);
    if (Array.isArray(selectedAnswer)) {
      return selectedAnswer.includes(key);
    }
    return selectedAnswer === key;
  };

  const optionLabels = ["A", "B", "C", "D", "E", "F"];

  return (
    <View style={styles.container}>
      {/* Top Question Header & Status */}
      <View style={styles.headerRow}>
        <View style={styles.questionIndexBadge}>
          <Text style={styles.questionIndexText}>Q{questionNumber}</Text>
        </View>
        <Text style={styles.questionCounterText}>
          Question {questionNumber} of {totalQuestions}
        </Text>
        <View style={styles.headerRight}>
          <Badge
            label={isMultiple ? "MSQ (Multi)" : "MCQ"}
            variant="primary"
            size="sm"
          />
          <View style={styles.marksBadge}>
            <Text style={styles.marksPositive}>+{question.marks || 1}</Text>
            <Text style={styles.marksDivider}>|</Text>
            <Text style={styles.marksNegative}>
              {question.negativeMarks ? `-${question.negativeMarks}` : "0"}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Context / Shared Passage / Table if present */}
        {question.context ? (
          <View style={styles.contextBox}>
            <View style={styles.contextHeader}>
              <Text style={styles.contextHeaderText}>
                📖 {question.contextType ? question.contextType.toUpperCase() : "CONTEXT / PASSAGE"}
              </Text>
            </View>
            <Text
              style={[
                styles.contextText,
                isLargeFont && { fontSize: 16, lineHeight: 24 },
              ]}
            >
              {question.context}
            </Text>
          </View>
        ) : null}

        {/* Visual Asset / Image Reference if present */}
        {question.imageReference ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: question.imageReference }}
              style={styles.questionImage}
              resizeMode="contain"
            />
          </View>
        ) : null}

        {/* Question Text */}
        <View style={styles.questionTextBox}>
          <Text
            style={[
              styles.questionText,
              isLargeFont && { fontSize: 18, lineHeight: 26 },
            ]}
          >
            {question.question}
          </Text>
        </View>

        {/* Options List */}
        <View style={styles.optionsContainer}>
          {question.options?.map((option, idx) => {
            const selected = isOptionSelected(idx);
            return (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.8}
                style={[
                  styles.optionCard,
                  selected && {
                    borderColor: theme.colors.primary,
                    backgroundColor: "#eff6ff",
                    borderWidth: 2,
                  },
                ]}
                onPress={() => handleOptionPress(option, idx)}
              >
                <View
                  style={[
                    styles.optionLetterBadge,
                    selected && {
                      backgroundColor: theme.colors.primary,
                      borderColor: theme.colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionLetterText,
                      selected && { color: "#ffffff", fontWeight: "800" },
                    ]}
                  >
                    {optionLabels[idx] || String(idx + 1)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.optionText,
                    selected && { color: "#1e3a8a", fontWeight: "700" },
                    isLargeFont && { fontSize: 16, lineHeight: 22 },
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Sub-action Bar (Clear / Mark for Review) */}
      <View style={styles.subActionBar}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.subActionBtn, isMarked && styles.subActionBtnActive]}
          onPress={onToggleMarkForReview}
        >
          <Text
            style={[
              styles.subActionText,
              isMarked && { color: "#9333ea", fontWeight: "800" },
            ]}
          >
            {isMarked ? "✓ Marked for Review" : "🚩 Mark for Review"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.subActionBtn}
          onPress={onClearResponse}
        >
          <Text style={styles.clearText}>Clear Response</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#fafafa",
  },
  questionIndexBadge: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  questionIndexText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
  },
  questionCounterText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    flex: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  marksBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  marksPositive: {
    fontSize: 12,
    fontWeight: "800",
    color: "#16a34a",
  },
  marksDivider: {
    fontSize: 12,
    color: "#cbd5e1",
    marginHorizontal: 4,
  },
  marksNegative: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  contextBox: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  contextHeader: {
    marginBottom: 6,
  },
  contextHeaderText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.8,
  },
  contextText: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 21,
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  questionImage: {
    width: "100%",
    height: 180,
    borderRadius: 8,
  },
  questionTextBox: {
    marginBottom: 20,
  },
  questionText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: 24,
  },
  optionsContainer: {
    gap: 10,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 12,
  },
  optionLetterBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  optionLetterText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  optionText: {
    fontSize: 15,
    color: "#1e293b",
    flex: 1,
    lineHeight: 20,
  },
  subActionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    backgroundColor: "#ffffff",
  },
  subActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  subActionBtnActive: {
    backgroundColor: "#faf5ff",
  },
  subActionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
  },
  clearText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ef4444",
  },
});

export default QuestionViewer;
