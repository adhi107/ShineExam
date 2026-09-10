import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  BackHandler,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { ExamForTaking, AnswerItem, ResultDetail } from "../../types/exam";
import { examApi } from "../../api/examApi";
import { Storage, StorageKeys } from "../../utils/storage";
import { useExamTimer } from "../../hooks/useExamTimer";
import SensitiveContent from "../../security/SensitiveContent";
import QuestionViewer from "../../components/exam/QuestionViewer";
import QuestionPalette from "../../components/exam/QuestionPalette";
import ConfirmDialog from "../../components/ConfirmDialog";
import ShineLogo from "../../components/ShineLogo";
import { useTenant } from "../../context/TenantContext";

interface LiveExamScreenProps {
  test: ExamForTaking;
  attemptId: string;
  userId: string;
  initialAnswers?: AnswerItem[];
  initialTimeSpentSec?: number;
  initialQuestionIndex?: number;
  initialSection?: string;
  initialQuestionTimes?: Record<string, number>;
  onExamSubmitted: (result: ResultDetail) => void;
  onExitExam: () => void;
}

export const LiveExamScreen: React.FC<LiveExamScreenProps> = ({
  test,
  attemptId,
  userId,
  initialAnswers,
  initialTimeSpentSec = 0,
  initialQuestionIndex = 0,
  initialSection,
  initialQuestionTimes = {},
  onExamSubmitted,
  onExitExam,
}) => {
  const { theme } = useTenant();
  const STORAGE_KEY = `${StorageKeys.EXAM_PROGRESS_PREFIX}${test.id}_${userId}`;

  // Calculate remaining seconds
  const totalExamSeconds = (test.duration || 60) * 60;
  const initialRemainingSeconds = Math.max(10, totalExamSeconds - initialTimeSpentSec);

  const [currentIndex, setCurrentIndex] = useState<number>(initialQuestionIndex);
  const [currentSection, setCurrentSection] = useState<string>(
    initialSection || test.questions[0]?.section || ""
  );
  const [paletteVisible, setPaletteVisible] = useState(false);
  const [confirmExitVisible, setConfirmExitVisible] = useState(false);
  const [confirmSubmitVisible, setConfirmSubmitVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fontSize, setFontSize] = useState<"normal" | "large">("normal");

  // Track visited question indices
  const [visitedIndices, setVisitedIndices] = useState<Set<number>>(
    new Set([initialQuestionIndex])
  );

  // Initialize candidate answer records
  const [answers, setAnswers] = useState<AnswerItem[]>(() => {
    if (initialAnswers && initialAnswers.length === test.questions.length) {
      return initialAnswers;
    }
    return test.questions.map((q) => ({
      questionId: q.id,
      answer: q.type === "msq" || q.type === "multiple" ? [] : "",
      marked: false,
    }));
  });

  const [questionTimes, setQuestionTimes] = useState<Record<string, number>>(initialQuestionTimes);
  const questionStartTimeRef = useRef<number>(Date.now());

  // Submit Handler
  const handleFinalSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const activeQ = test.questions[currentIndex];
      const updatedTimes = { ...questionTimes };
      if (activeQ) {
        const spent = Math.floor((Date.now() - questionStartTimeRef.current) / 1000);
        updatedTimes[activeQ.id] = (updatedTimes[activeQ.id] || 0) + spent;
      }

      const res = await examApi.submitAttempt(attemptId, {
        answers,
        timeSpentSec: totalExamSeconds - timer.secondsLeft,
        userId,
        questionTimes: updatedTimes,
      });

      await Storage.removeItem(STORAGE_KEY);
      setConfirmSubmitVisible(false);
      onExamSubmitted(res.result);
    } catch (error: any) {
      console.warn("Submit attempt error:", error);
      // If attempt is already submitted on server, treat as submitted
      if (error?.message?.toLowerCase().includes("already submitted")) {
        await Storage.removeItem(STORAGE_KEY);
        onExamSubmitted({
          attemptId,
          examId: test.id,
          totalMarks: test.totalMarks || test.questions.length,
          scoredMarks: 0,
          percentage: 0,
          passed: false,
        });
      } else {
        alert(error?.message || "Failed to submit exam. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [answers, attemptId, currentIndex, onExamSubmitted, questionTimes, test, totalExamSeconds, userId]);

  // Exam Timer Hook
  const timer = useExamTimer({
    initialSeconds: initialRemainingSeconds,
    isActive: !submitting,
    onTimeExpired: () => {
      handleFinalSubmit();
    },
  });

  // Hardware Back Button Interceptor
  useEffect(() => {
    const backAction = () => {
      setConfirmExitVisible(true);
      return true; // Stop default back action
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, []);

  // Periodic Local Storage & Background API Autosave
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = setTimeout(() => {
      // 1. Sync local cache
      Storage.setItem(STORAGE_KEY, {
        answers,
        currentIndex,
        currentSection,
        secondsLeft: timer.secondsLeft,
        visited: Array.from(visitedIndices),
        questionTimes,
      });

      // 2. Dispatch background autosave to Flask backend
      examApi
        .saveAttemptProgress(attemptId, {
          answers,
          timeSpentSec: totalExamSeconds - timer.secondsLeft,
          currentQuestionIndex: currentIndex,
          currentSection,
          questionTimes,
        })
        .catch(() => {
          // Silent failure — local cache has answers
        });
    }, 1500);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [answers, attemptId, currentIndex, currentSection, questionTimes, timer.secondsLeft, totalExamSeconds, visitedIndices]);

  // Navigation between questions
  const goToQuestion = (index: number) => {
    const targetQ = test.questions[index];
    if (!targetQ) return;

    // Track time spent on current question before switching
    const currentQ = test.questions[currentIndex];
    if (currentQ) {
      const spent = Math.floor((Date.now() - questionStartTimeRef.current) / 1000);
      setQuestionTimes((prev) => ({
        ...prev,
        [currentQ.id]: (prev[currentQ.id] || 0) + spent,
      }));
    }
    questionStartTimeRef.current = Date.now();

    setCurrentIndex(index);
    if (targetQ.section) {
      setCurrentSection(targetQ.section);
    }
    setVisitedIndices((prev) => new Set([...Array.from(prev), index]));
  };

  const handleAnswerChange = (val: string | string[]) => {
    const q = test.questions[currentIndex];
    if (!q) return;
    setAnswers((prev) =>
      prev.map((a) => (a.questionId === q.id ? { ...a, answer: val } : a))
    );
  };

  const handleToggleMark = () => {
    const q = test.questions[currentIndex];
    if (!q) return;
    setAnswers((prev) =>
      prev.map((a) => (a.questionId === q.id ? { ...a, marked: !a.marked } : a))
    );
  };

  const handleClearResponse = () => {
    const q = test.questions[currentIndex];
    if (!q) return;
    setAnswers((prev) =>
      prev.map((a) =>
        a.questionId === q.id
          ? { ...a, answer: q.type === "msq" || q.type === "multiple" ? [] : "" }
          : a
      )
    );
  };

  const activeQuestion = test.questions[currentIndex];
  const activeAnswer = answers.find((a) => a.questionId === activeQuestion?.id);
  const isLastQuestion = currentIndex >= test.questions.length - 1;

  const sections = Array.from(new Set(test.questions.map((q) => q.section))).filter(Boolean);

  return (
    <SensitiveContent
      module="exam"
      userId={userId}
      showWatermark
      watermarkOpacity={0.14}
      shieldOnBackground
      shieldMessage={`Your assessment is paused on Question ${currentIndex + 1}. Tap Resume to continue.`}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#090e1a" />

        {/* 1. Top Bar */}
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <ShineLogo inverse size="sm" />
            <Text style={styles.examTitleText} numberOfLines={1}>
              {test.testName}
            </Text>
          </View>

          <View style={styles.topBarRight}>
            {/* Font Zoom Toggle */}
            <View style={styles.zoomGroup}>
              <TouchableOpacity
                style={[styles.zoomBtn, fontSize === "normal" && styles.zoomBtnActive]}
                onPress={() => setFontSize("normal")}
              >
                <Text style={styles.zoomBtnText}>A</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.zoomBtn, fontSize === "large" && styles.zoomBtnActive]}
                onPress={() => setFontSize("large")}
              >
                <Text style={[styles.zoomBtnText, { fontSize: 13 }]}>A+</Text>
              </TouchableOpacity>
            </View>

            {/* Timer Badge */}
            <View
              style={[
                styles.timerBadge,
                timer.isUrgent && styles.timerUrgent,
                timer.isWarning && !timer.isUrgent && styles.timerWarning,
              ]}
            >
              <Text style={styles.timerIcon}>⏱️</Text>
              <Text style={styles.timerText}>{timer.formattedTime}</Text>
            </View>

            {/* Palette Grid Button */}
            <TouchableOpacity
              style={styles.paletteTriggerBtn}
              onPress={() => setPaletteVisible(true)}
            >
              <Text style={styles.paletteTriggerText}>Grid ⛶</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Section Selector Bar */}
        {sections.length > 1 && (
          <View style={styles.sectionBar}>
            <Text style={styles.sectionBarLabel}>Section:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionList}>
              {sections.map((sec) => (
                <TouchableOpacity
                  key={sec}
                  style={[
                    styles.sectionPill,
                    sec === currentSection && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                  ]}
                  onPress={() => {
                    setCurrentSection(sec);
                    const firstSecIdx = test.questions.findIndex((q) => q.section === sec);
                    if (firstSecIdx >= 0) goToQuestion(firstSecIdx);
                  }}
                >
                  <Text
                    style={[
                      styles.sectionPillText,
                      sec === currentSection && { color: "#ffffff", fontWeight: "800" },
                    ]}
                  >
                    {sec}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 3. Question Viewer Body */}
        {activeQuestion && (
          <QuestionViewer
            question={activeQuestion}
            questionNumber={currentIndex + 1}
            totalQuestions={test.questions.length}
            selectedAnswer={activeAnswer?.answer || ""}
            isMarked={Boolean(activeAnswer?.marked)}
            fontSize={fontSize}
            onAnswerChange={handleAnswerChange}
            onToggleMarkForReview={handleToggleMark}
            onClearResponse={handleClearResponse}
          />
        )}

        {/* 4. Bottom Sticky Action Footer */}
        <View style={styles.bottomFooter}>
          {currentIndex > 0 ? (
            <TouchableOpacity
              style={styles.prevBtn}
              onPress={() => goToQuestion(currentIndex - 1)}
            >
              <Text style={styles.prevBtnText}>← Prev</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 80 }} />
          )}

          <TouchableOpacity
            style={[styles.saveNextBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => {
              if (isLastQuestion) {
                setConfirmSubmitVisible(true);
              } else {
                goToQuestion(currentIndex + 1);
              }
            }}
          >
            <Text style={styles.saveNextBtnText}>
              {isLastQuestion ? "Review & Submit →" : "Save & Next →"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Sheet Question Palette */}
        <QuestionPalette
          visible={paletteVisible}
          questions={test.questions}
          currentIndex={currentIndex}
          answers={answers}
          visitedIndices={visitedIndices}
          sections={sections}
          activeSection={currentSection}
          onSelectQuestion={goToQuestion}
          onSelectSection={(sec) => {
            setCurrentSection(sec);
            const firstIdx = test.questions.findIndex((q) => q.section === sec);
            if (firstIdx >= 0) goToQuestion(firstIdx);
          }}
          onClose={() => setPaletteVisible(false)}
          onSubmitExam={() => {
            setPaletteVisible(false);
            setConfirmSubmitVisible(true);
          }}
        />

        {/* Confirm Exit Modal */}
        <ConfirmDialog
          visible={confirmExitVisible}
          title="Exit Assessment?"
          message="You are currently in an active examination session. Exiting will forfeit your remaining attempt time. Are you sure you want to leave?"
          confirmText="Yes, Exit Exam"
          cancelText="Stay in Exam"
          confirmVariant="danger"
          onConfirm={() => {
            setConfirmExitVisible(false);
            onExitExam();
          }}
          onCancel={() => setConfirmExitVisible(false)}
        />

        {/* Confirm Submit Modal */}
        <ConfirmDialog
          visible={confirmSubmitVisible}
          title="Submit Examination?"
          message={`You have answered ${answers.filter((a) => (Array.isArray(a.answer) ? a.answer.length > 0 : Boolean(a.answer))).length} of ${test.questions.length} questions. Are you sure you want to submit your final examination paper?`}
          confirmText="Confirm & Submit"
          cancelText="Return to Exam"
          loading={submitting}
          onConfirm={handleFinalSubmit}
          onCancel={() => setConfirmSubmitVisible(false)}
        />
      </SafeAreaView>
    </SensitiveContent>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  topBar: {
    backgroundColor: "#090e1a",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  examTitleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94a3b8",
    marginLeft: 8,
    flex: 1,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  zoomGroup: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    borderRadius: 6,
    padding: 2,
  },
  zoomBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  zoomBtnActive: {
    backgroundColor: "#334155",
  },
  zoomBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#ffffff",
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  timerUrgent: {
    backgroundColor: "#7f1d1d",
    borderColor: "#ef4444",
  },
  timerWarning: {
    backgroundColor: "#78350f",
    borderColor: "#f59e0b",
  },
  timerIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  timerText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
    fontVariant: ["tabular-nums"],
  },
  paletteTriggerBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  paletteTriggerText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#ffffff",
  },
  sectionBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  sectionBarLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    marginRight: 8,
  },
  sectionList: {
    gap: 6,
  },
  sectionPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  sectionPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  bottomFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  prevBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  prevBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  saveNextBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: "center",
  },
  saveNextBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
  },
});

export default LiveExamScreen;
