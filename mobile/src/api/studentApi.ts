import { apiClient } from "./client";

export interface StudentDashboardInsights {
  testsTaken: number;
  testsPassed: number;
  avgScore: number;
  bestScore: number;
  streak: number;
}

export interface StudentVideoClass {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  sourceType: "file" | "link";
  provider?: "youtube" | "vimeo" | "direct" | "local";
  videoUrl?: string;
  embedUrl?: string;
  originalUrl?: string;
  viewCount: number;
  createdAt: string;
}

export interface StudentDocument {
  id: string;
  title: string;
  description: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface StudentAnnouncement {
  id: string;
  title: string;
  message: string;
  linkUrl?: string;
  imageUrl?: string;
  publishAt?: string;
  createdAt: string;
}

export interface StudentNotification {
  id: string;
  type: "test" | "result" | "document" | "announcement";
  title: string;
  message: string;
  target: string;
  createdAt: string;
  read: boolean;
}

export interface StudentBookmark {
  id: string;
  type: "test" | "question";
  testId: string;
  questionId?: string;
  title: string;
  question?: string;
  createdAt: string;
}

export const studentApi = {
  async getDashboardInsights(userId: string): Promise<{ insights: StudentDashboardInsights }> {
    return apiClient.get<{ insights: StudentDashboardInsights }>("/answerer/dashboard", {
      params: { userId },
    });
  },

  async getClasses(
    userId: string,
    params?: { search?: string; category?: string }
  ): Promise<{ classes: StudentVideoClass[]; categories: string[]; totalCount: number }> {
    return apiClient.get("/answerer/classes", {
      params: { userId, ...params },
    });
  },

  async trackVideoView(videoId: string, userId: string): Promise<{ message: string }> {
    return apiClient.post("/answerer/classes/track", { videoId, userId });
  },

  async getDocuments(userId: string): Promise<{ documents: StudentDocument[] }> {
    return apiClient.get("/answerer/documents", {
      params: { userId },
    });
  },

  async getAnnouncements(userId: string): Promise<{ announcements: StudentAnnouncement[] }> {
    return apiClient.get("/answerer/announcements", {
      params: { userId },
    });
  },

  async getNotifications(
    userId: string
  ): Promise<{ notifications: StudentNotification[]; unreadCount: number }> {
    return apiClient.get("/answerer/notifications", {
      params: { userId },
    });
  },

  async markNotificationRead(userId: string, notificationId: string): Promise<{ message: string }> {
    return apiClient.post("/answerer/notifications/read", { userId, notificationId });
  },

  async getBookmarks(userId: string): Promise<{ bookmarks: StudentBookmark[] }> {
    return apiClient.get("/answerer/bookmarks", {
      params: { userId },
    });
  },

  async toggleBookmark(payload: {
    userId: string;
    type: "test" | "question";
    testId: string;
    questionId?: string;
    title?: string;
    question?: string;
  }): Promise<{ bookmarked: boolean }> {
    return apiClient.post("/answerer/bookmarks/toggle", payload);
  },

  async getCategories(userId: string): Promise<{ categories: any[] }> {
    return apiClient.get("/answerer/exam-categories", {
      params: { userId },
    });
  },
};
