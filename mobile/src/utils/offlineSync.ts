import { Storage, StorageKeys } from "./storage";
import { examApi } from "../api/examApi";
import { AnswerItem } from "../types/exam";

export interface QueuedAnswerMutation {
  attemptId: string;
  answers: AnswerItem[];
  timeSpentSec: number;
  currentQuestionIndex: number;
  currentSection: string;
  questionTimes?: Record<string, number>;
  timestamp: number;
}

export const OfflineSync = {
  async enqueueAttemptSave(mutation: QueuedAnswerMutation): Promise<void> {
    try {
      const queue = (await Storage.getItem<QueuedAnswerMutation[]>(StorageKeys.OFFLINE_QUEUE)) || [];
      // Overwrite previous pending mutation for the same attempt with the latest snapshot
      const filtered = queue.filter((item) => item.attemptId !== mutation.attemptId);
      filtered.push(mutation);
      await Storage.setItem(StorageKeys.OFFLINE_QUEUE, filtered);
    } catch (e) {
      console.warn("Failed to enqueue offline mutation:", e);
    }
  },

  async flushQueue(): Promise<{ flushedCount: number; errors: any[] }> {
    const queue = (await Storage.getItem<QueuedAnswerMutation[]>(StorageKeys.OFFLINE_QUEUE)) || [];
    if (queue.length === 0) return { flushedCount: 0, errors: [] };

    const remaining: QueuedAnswerMutation[] = [];
    const errors: any[] = [];
    let flushedCount = 0;

    for (const item of queue) {
      try {
        await examApi.saveAttemptProgress(item.attemptId, {
          answers: item.answers,
          timeSpentSec: item.timeSpentSec,
          currentQuestionIndex: item.currentQuestionIndex,
          currentSection: item.currentSection,
          questionTimes: item.questionTimes,
        });
        flushedCount++;
      } catch (err) {
        errors.push(err);
        remaining.push(item);
      }
    }

    await Storage.setItem(StorageKeys.OFFLINE_QUEUE, remaining);
    return { flushedCount, errors };
  },
};
