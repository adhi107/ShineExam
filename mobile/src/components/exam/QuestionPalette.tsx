import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
} from "react-native";
import { Question, AnswerItem } from "../../types/exam";
import { useTenant } from "../../context/TenantContext";

export type QuestionStatus =
  | "answered"
  | "notAnswered"
  | "marked"
  | "answeredMarked"
  | "notVisited";

interface QuestionPaletteProps {
  visible: boolean;
  questions: Question[];
  currentIndex: number;
  answers: AnswerItem[];
  visitedIndices: Set<number>;
  sections: string[];
  activeSection: string;
  onSelectQuestion: (index: number) => void;
  onSelectSection: (section: string) => void;
  onClose: () => void;
  onSubmitExam: () => void;
}

export const QuestionPalette: React.FC<QuestionPaletteProps> = ({
  visible,
  questions,
  currentIndex,
  answers,
  visitedIndices,
  sections,
  activeSection,
  onSelectQuestion,
  onSelectSection,
  onClose,
  onSubmitExam,
}) => {
  const { theme } = useTenant();

  const getQuestionStatus = (index: number): QuestionStatus => {
    const q = questions[index];
    if (!q) return "notVisited";
    const a = answers.find((item) => item.questionId === q.id);
    const hasAnswer =
      a && (Array.isArray(a.answer) ? a.answer.length > 0 : Boolean(a.answer && a.answer !== ""));

    if (a?.marked && hasAnswer) return "answeredMarked";
    if (a?.marked) return "marked";
    if (hasAnswer) return "answered";
    if (visitedIndices.has(index)) return "notAnswered";
    return "notVisited";
  };

  const getStatusBgColor = (status: QuestionStatus): string => {
    switch (status) {
      case "answered":
        return "#16a34a"; // Green
      case "notAnswered":
        return "#ea580c"; // Orange
      case "marked":
        return "#9333ea"; // Purple
      case "answeredMarked":
        return "#4f46e5"; // Indigo / Blue-Purple
      case "notVisited":
        return "#e2e8f0"; // Slate gray
    }
  };

  const getStatusTextColor = (status: QuestionStatus): string => {
    if (status === "notVisited") return "#475569";
    return "#ffffff";
  };

  // Status counts across the entire exam
  let answeredCount = 0;
  let notAnsweredCount = 0;
  let markedCount = 0;
  let ansMarkedCount = 0;
  let notVisitedCount = 0;

  questions.forEach((_, idx) => {
    const st = getQuestionStatus(idx);
    if (st === "answered") answeredCount++;
    else if (st === "notAnswered") notAnsweredCount++;
    else if (st === "marked") markedCount++;
    else if (st === "answeredMarked") ansMarkedCount++;
    else notVisitedCount++;
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheetContainer}>
          {/* Top Sheet Drag Handle */}
          <View style={styles.dragHandleBar}>
            <View style={styles.dragHandlePill} />
          </View>

          {/* Sheet Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Question Palette</Text>
              <Text style={styles.subtitle}>
                Section: <Text style={{ fontWeight: "800", color: theme.colors.primary }}>{activeSection}</Text>
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Section Selector Tabs */}
          {sections.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.sectionTabRow}
              contentContainerStyle={styles.sectionTabContent}
            >
              {sections.map((sec) => {
                const isActive = sec === activeSection;
                return (
                  <TouchableOpacity
                    key={sec}
                    style={[
                      styles.sectionTab,
                      isActive && {
                        backgroundColor: theme.colors.primary,
                        borderColor: theme.colors.primary,
                      },
                    ]}
                    onPress={() => onSelectSection(sec)}
                  >
                    <Text
                      style={[
                        styles.sectionTabText,
                        isActive && { color: "#ffffff", fontWeight: "800" },
                      ]}
                    >
                      {sec}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Status Legend */}
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#16a34a" }]} />
              <Text style={styles.legendText}>Answered ({answeredCount})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#ea580c" }]} />
              <Text style={styles.legendText}>Not Answered ({notAnsweredCount})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#9333ea" }]} />
              <Text style={styles.legendText}>Marked ({markedCount})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#4f46e5" }]} />
              <Text style={styles.legendText}>Ans & Marked ({ansMarkedCount})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#e2e8f0" }]} />
              <Text style={styles.legendText}>Not Visited ({notVisitedCount})</Text>
            </View>
          </View>

          {/* Question Grid */}
          <ScrollView style={styles.gridScrollView} contentContainerStyle={styles.gridContent}>
            <View style={styles.grid}>
              {questions.map((q, idx) => {
                if (activeSection && q.section !== activeSection && sections.length > 1) {
                  return null;
                }
                const status = getQuestionStatus(idx);
                const isCurrent = idx === currentIndex;
                const bg = getStatusBgColor(status);
                const textColor = getStatusTextColor(status);

                return (
                  <TouchableOpacity
                    key={q.id || idx}
                    activeOpacity={0.8}
                    style={[
                      styles.gridButton,
                      { backgroundColor: bg },
                      isCurrent && styles.currentGridButton,
                    ]}
                    onPress={() => {
                      onSelectQuestion(idx);
                      onClose();
                    }}
                  >
                    <Text style={[styles.gridButtonText, { color: textColor }]}>
                      {idx + 1}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Bottom Action Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.submitExamBtn} onPress={onSubmitExam}>
              <Text style={styles.submitExamBtnText}>Review & Submit Exam →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: Dimensions.get("window").height * 0.8,
    paddingBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 20,
  },
  dragHandleBar: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  dragHandlePill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#475569",
  },
  sectionTabRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  sectionTabContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  sectionTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  legendContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  gridScrollView: {
    maxHeight: 280,
  },
  gridContent: {
    padding: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  gridButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  currentGridButton: {
    borderWidth: 2.5,
    borderColor: "#0f172a",
    transform: [{ scale: 1.05 }],
  },
  gridButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  submitExamBtn: {
    backgroundColor: "#0f172a",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  submitExamBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
  },
});

export default QuestionPalette;
