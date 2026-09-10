export type QuestionType = "mcq" | "msq" | "multiple" | "ordering" | "text";

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  correctAnswer?: string | string[];
  section: string;
  marks: number;
  negativeMarks?: number;
  context?: string;
  contextType?: "table" | "passage" | "graph" | "";
  chartData?: any;
  tableData?: any;
  imageReference?: string;
  visualReferences?: any[];
  sharedContent?: string;
  questionRange?: string;
}

export interface AnswerItem {
  questionId: string;
  answer: string | string[];
  marked: boolean;
}

export interface SectionConfigItem {
  name: string;
  duration: number;
  questionCount: number;
  marks: number;
}

export interface AssignedTest {
  id: string;
  name: string;
  duration: number;
  questions: number;
  status: "active" | "draft" | "completed" | "upcoming" | "expired";
  totalMarks?: number;
  passingPercentage?: number;
  attempted?: boolean;
  availableFrom?: string;
  validUntil?: string;
  categoryId?: string;
  categoryName?: string;
  subcategoryId?: string;
  subcategoryName?: string;
  stage?: string;
  attemptStatus?: "not_started" | "in_progress" | "submitted";
  attemptId?: string;
  answeredCount?: number;
  totalQuestions?: number;
  timeSpentSec?: number;
  currentQuestionIndex?: number;
  currentSection?: string;
  lastSavedAt?: string;
}

export interface ExamForTaking {
  id: string;
  testName: string;
  duration: number;
  sections: string[];
  sectionConfig?: SectionConfigItem[];
  timerMode?: "overall" | "sectional";
  questions: Question[];
  totalMarks?: number;
  passingPercentage?: number;
  questionTypes?: string;
}

export interface QuestionReviewItem {
  questionId: string;
  question?: string;
  context?: string;
  contextType?: string;
  type?: string;
  options?: string[];
  isCorrect: boolean;
  userAnswer: string | string[];
  correctAnswer?: string | string[];
  marks: number;
  negativeMarks?: number;
  section: string;
  timeSpentSec?: number;
  avgTimeSec?: number;
  topperTimeSec?: number;
  topperUserId?: string;
}

export interface ResultDetail {
  id?: string;
  attemptId: string;
  examId: string;
  userId?: string;
  testName?: string;
  totalMarks: number;
  scoredMarks: number;
  percentage: number;
  passed: boolean;
  percentile?: number;
  sectionWise?: Record<string, { total: number; scored: number }>;
  questionReview?: QuestionReviewItem[];
  submittedAt?: string;
  timeSpentSec?: number;
}

export interface TestHistoryItem {
  attemptId: string;
  examId: string;
  testName: string;
  submittedAt: string;
  scoredMarks: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  timeSpentSec: number;
}
