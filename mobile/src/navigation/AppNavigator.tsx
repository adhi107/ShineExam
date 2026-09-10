import React, { useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { useInactivityLogout } from "../hooks/useInactivityLogout";
import AuthNavigator from "./AuthNavigator";
import StudentNavigator from "./StudentNavigator";
import AdminNavigator from "./AdminNavigator";
import { examApi } from "../api/examApi";
import { ExamForTaking, ResultDetail } from "../types/exam";
import TestDetailsScreen from "../screens/exam/TestDetailsScreen";
import TestInstructionsScreen from "../screens/exam/TestInstructionsScreen";
import LiveExamScreen from "../screens/exam/LiveExamScreen";
import ExamSubmittedScreen from "../screens/exam/ExamSubmittedScreen";
import ResultDetailScreen from "../screens/student/ResultDetailScreen";

export const AppNavigator: React.FC = () => {
  const { isLoggedIn, role, userId, isLoading, logout } = useAuth();

  // Active Exam Lifecycle State
  const [activeExamState, setActiveExamState] = useState<{
    step: "details" | "instructions" | "live" | "submitted";
    test: ExamForTaking | null;
    attemptId: string;
    submittedResult: ResultDetail | null;
    initialAnswers?: any[];
    initialTimeSpentSec?: number;
    initialQuestionIndex?: number;
    initialSection?: string;
  } | null>(null);

  // Active Report Modal
  const [viewingReportAttemptId, setViewingReportAttemptId] = useState<string | null>(null);

  // Inactivity auto-logout hook
  useInactivityLogout({
    isLoggedIn,
    onLogout: logout,
    isExamActive: Boolean(activeExamState && activeExamState.step === "live"),
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // Handle launching an exam
  const handleStartExam = async (examId: string) => {
    try {
      const [testRes, attemptRes] = await Promise.all([
        examApi.getTestForTaker(examId, userId),
        examApi.startAttempt({ userId, examId }),
      ]);

      const testData = testRes.test;
      const attemptId = attemptRes.attemptId;

      if (attemptRes.isResume) {
        setActiveExamState({
          step: "live",
          test: testData,
          attemptId,
          submittedResult: null,
          initialAnswers: attemptRes.answers,
          initialTimeSpentSec: attemptRes.timeSpentSec,
          initialQuestionIndex: attemptRes.currentQuestionIndex,
          initialSection: attemptRes.currentSection,
        });
      } else {
        setActiveExamState({
          step: "details",
          test: testData,
          attemptId,
          submittedResult: null,
        });
      }
    } catch (e: any) {
      alert(e?.message || "Unable to start assessment.");
    }
  };

  // If candidate is inside the Exam flow, render the dedicated secure exam screens
  if (activeExamState && activeExamState.test) {
    if (activeExamState.step === "details") {
      return (
        <TestDetailsScreen
          test={activeExamState.test}
          onProceedToInstructions={() =>
            setActiveExamState((prev) => (prev ? { ...prev, step: "instructions" } : null))
          }
          onCancel={() => setActiveExamState(null)}
        />
      );
    }

    if (activeExamState.step === "instructions") {
      return (
        <TestInstructionsScreen
          test={activeExamState.test}
          userId={userId}
          onStartExam={() =>
            setActiveExamState((prev) => (prev ? { ...prev, step: "live" } : null))
          }
          onBack={() =>
            setActiveExamState((prev) => (prev ? { ...prev, step: "details" } : null))
          }
        />
      );
    }

    if (activeExamState.step === "live") {
      return (
        <LiveExamScreen
          test={activeExamState.test}
          attemptId={activeExamState.attemptId}
          userId={userId}
          initialAnswers={activeExamState.initialAnswers}
          initialTimeSpentSec={activeExamState.initialTimeSpentSec}
          initialQuestionIndex={activeExamState.initialQuestionIndex}
          initialSection={activeExamState.initialSection}
          onExamSubmitted={(result) =>
            setActiveExamState((prev) => (prev ? { ...prev, step: "submitted", submittedResult: result } : null))
          }
          onExitExam={() => setActiveExamState(null)}
        />
      );
    }

    if (activeExamState.step === "submitted" && activeExamState.submittedResult) {
      return (
        <ExamSubmittedScreen
          result={activeExamState.submittedResult}
          testName={activeExamState.test.testName}
          onViewReport={() => {
            const attId = activeExamState.attemptId;
            setActiveExamState(null);
            setViewingReportAttemptId(attId);
          }}
          onReturnDashboard={() => setActiveExamState(null)}
        />
      );
    }
  }

  // If candidate is viewing a specific result report
  if (viewingReportAttemptId) {
    return (
      <ResultDetailScreen
        attemptId={viewingReportAttemptId}
        onBack={() => setViewingReportAttemptId(null)}
      />
    );
  }

  return (
    <NavigationContainer>
      {!isLoggedIn ? (
        <AuthNavigator />
      ) : role === "admin" || role === "super_admin" ? (
        <AdminNavigator />
      ) : (
        <StudentNavigator
          onStartExam={handleStartExam}
          onOpenReport={(attemptId) => setViewingReportAttemptId(attemptId)}
        />
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#090e1a",
  },
});

export default AppNavigator;
