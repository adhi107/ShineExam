import { apiClient } from "./client";
import { AssignedTest, ExamForTaking, ResultDetail, TestHistoryItem, AnswerItem } from "../types/exam";

export const examApi = {
  async getAssignedTests(userId: string): Promise<{ tests: AssignedTest[] }> {
    return apiClient.get<{ tests: AssignedTest[] }>("/answerer/tests", {
      params: { userId },
    });
  },

  async getTestForTaker(examId: string, userId: string): Promise<{ test: ExamForTaking }> {
    return apiClient.get<{ test: ExamForTaking }>(`/answerer/tests/${examId}`, {
      params: { userId },
    });
  },

  async startAttempt(payload: {
    userId: string;
    examId: string;
  }): Promise<{
    attemptId: string;
    isResume: boolean;
    answers?: AnswerItem[];
    timeSpentSec?: number;
    currentQuestionIndex?: number;
    currentSection?: string;
    questionTimes?: Record<string, number>;
  }> {
    return apiClient.post("/answerer/attempts/start", payload);
  },

  async saveAttemptProgress(
    attemptId: string,
    payload: {
      answers: AnswerItem[];
      timeSpentSec: number;
      currentQuestionIndex: number;
      currentSection: string;
      questionTimes?: Record<string, number>;
    }
  ): Promise<{ message: string }> {
    return apiClient.put(`/answerer/attempts/${attemptId}/save`, payload);
  },

  async submitAttempt(
    attemptId: string,
    payload: {
      answers: AnswerItem[];
      timeSpentSec: number;
      userId: string;
      questionTimes?: Record<string, number>;
    }
  ): Promise<{ result: ResultDetail }> {
    return apiClient.post(`/answerer/attempts/${attemptId}/submit`, payload);
  },

  async getResult(attemptId: string): Promise<{ result: ResultDetail }> {
    return apiClient.get<{ result: ResultDetail }>(`/answerer/results/${attemptId}`);
  },

  async getTestHistory(userId: string): Promise<{ history: TestHistoryItem[] }> {
    return apiClient.get<{ history: TestHistoryItem[] }>("/answerer/history", {
      params: { userId },
    });
  },
};
