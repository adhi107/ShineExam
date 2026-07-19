export type RelativeDateFilter = "all" | "today" | "last7" | "last30" | "older";
export type PortalStatusFilter = "" | "active" | "inactive";
export type AssignableStatusFilter = "active" | "inactive" | "all";
export type TestDurationBand = "all" | "short" | "medium" | "long";
export type TestQuestionBand = "all" | "short" | "medium" | "large";
export type TestCutoffBand = "all" | "easy" | "standard" | "strict";
export type SectionCountBand = "all" | "single" | "few" | "many";
export type AssignmentLoadBand = "all" | "unassigned" | "light" | "heavy";
export type ResultStatusFilter = "all" | "passed" | "failed";
export type PassRateBand = "all" | "excellent" | "good" | "watch" | "poor";
export type DurationBand = "all" | "short" | "medium" | "long";
export type ScoreBand = "all" | "topper" | "strong" | "average" | "at-risk";
export type TimeSpentBand = "all" | "quick" | "balanced" | "slow";
export type DateFilter = "all" | "today" | "last7" | "last30";
export type UserSort = "score-high" | "score-low" | "name" | "date" | "time-fast" | "time-slow";
export type TestAttemptsFilter = "all" | "with-attempts" | "without-attempts";
export type TestResultsSort = "recent" | "name" | "attempts" | "avg-score" | "pass-rate";
export type PortalSortDir = "asc" | "desc";

export interface PortalUserLike {
  name?: string;
  email?: string;
  userId?: string;
  naxUnid?: string;
  mobile?: string;
  collegeEmail?: string;
  collegeRollNumber?: string;
  studentId?: string;
  collegeName?: string;
  courseStream?: string;
  gender?: string;
  sapCertification?: string;
  isActive?: boolean;
  cgpa?: number | null;
  createdAt: string;
}

export interface AssignableStudentLike {
  name?: string;
  userId?: string;
  email?: string;
  courseStream?: string;
  collegeName?: string;
  gender?: string;
  isActive?: boolean;
}

export interface AdminTestLike {
  name: string;
  duration: number;
  questions: number;
  sections?: Array<string | { name: string }>;
  createdAt: string;
  updatedAt?: string;
  status: "active" | "draft" | "completed" | "upcoming" | "expired";
  passingPercentage?: number;
  assignmentCount?: number;
  assignedColleges?: string[];
  categoryName?: string;
  subcategoryName?: string;
  stage?: string;
}

export interface UserResultLike {
  userId: string;
  userName: string;
  collegeName?: string;
  percentage: number;
  scoredMarks: number;
  totalMarks: number;
  passed: boolean;
  submittedAt: string;
  timeSpentSec: number;
}

export interface MasterItemLike {
  label: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const normalizeSearchText = (value: unknown) => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

const startOfLocalDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const endOfLocalDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);

const parseDateValue = (value: string | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const compareValues = (left: unknown, right: unknown) => {
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() - right.getTime();
  }
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right);
  }
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

export const parseNumericInput = (value: string) => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const matchesRelativeDateRange = (
  value: string | undefined,
  range: RelativeDateFilter,
  now: Date = new Date()
) => {
  if (range === "all") return true;
  const date = parseDateValue(value);
  if (!date) return false;
  if (date.getTime() > now.getTime()) return false;

  const todayStart = startOfLocalDay(now);
  const dateStart = startOfLocalDay(date);
  const diffInDays = Math.floor((todayStart.getTime() - dateStart.getTime()) / DAY_MS);

  if (range === "today") return diffInDays === 0;
  if (range === "last7") return diffInDays >= 0 && diffInDays <= 6;
  if (range === "last30") return diffInDays >= 0 && diffInDays <= 29;
  return diffInDays >= 30;
};

export const formatDurationBand = (minutes: number): DurationBand => {
  if (minutes <= 30) return "short";
  if (minutes <= 60) return "medium";
  return "long";
};

export const formatPassRateBand = (passRate: number): PassRateBand => {
  if (passRate >= 80) return "excellent";
  if (passRate >= 60) return "good";
  if (passRate >= 40) return "watch";
  return "poor";
};

export const formatScoreBand = (percentage: number): ScoreBand => {
  if (percentage >= 85) return "topper";
  if (percentage >= 70) return "strong";
  if (percentage >= 50) return "average";
  return "at-risk";
};

export const formatTimeSpentBand = (seconds: number): TimeSpentBand => {
  if (seconds < 15 * 60) return "quick";
  if (seconds <= 45 * 60) return "balanced";
  return "slow";
};

export const matchesTestDurationBand = (minutes: number, band: TestDurationBand) =>
  band === "all" || formatDurationBand(minutes) === band;

export const matchesTestQuestionBand = (questions: number, band: TestQuestionBand) => {
  if (band === "all") return true;
  if (band === "short") return questions <= 25;
  if (band === "medium") return questions >= 26 && questions <= 50;
  return questions > 50;
};

export const matchesCutoffBand = (cutoff: number, band: TestCutoffBand) => {
  if (band === "all") return true;
  if (band === "easy") return cutoff <= 50;
  if (band === "standard") return cutoff >= 51 && cutoff <= 70;
  return cutoff > 70;
};

export const matchesSectionCountBand = (sectionCount: number, band: SectionCountBand) => {
  if (band === "all") return true;
  if (band === "single") return sectionCount <= 1;
  if (band === "few") return sectionCount >= 2 && sectionCount <= 3;
  return sectionCount >= 4;
};

export const matchesAssignmentLoadBand = (assignmentCount: number, band: AssignmentLoadBand) => {
  if (band === "all") return true;
  if (band === "unassigned") return assignmentCount === 0;
  if (band === "light") return assignmentCount >= 1 && assignmentCount <= 25;
  return assignmentCount >= 26;
};

export const filterPortalUsers = <T extends PortalUserLike>(
  users: T[],
  filters: {
    search: string;
    college: string;
    stream: string;
    gender: string;
    status: PortalStatusFilter;
    certification: string;
    cgpaMin: string;
    cgpaMax: string;
    dateFrom: string;
    dateTo: string;
    sortKey: keyof T;
    sortDir: PortalSortDir;
  }
) => {
  const minCgpa = parseNumericInput(filters.cgpaMin);
  const maxCgpa = parseNumericInput(filters.cgpaMax);
  const fromDate = filters.dateFrom ? startOfLocalDay(new Date(filters.dateFrom)) : null;
  const toDate = filters.dateTo ? endOfLocalDay(new Date(filters.dateTo)) : null;

  const next = users.filter((user) => {
    if (filters.search.trim()) {
      const q = normalizeSearchText(filters.search);
      const matches = [
        user.name,
        user.email,
        user.userId,
        user.naxUnid,
        user.mobile,
        user.collegeEmail,
        user.collegeRollNumber,
        user.studentId,
      ]
        .filter(Boolean)
        .some((value) => normalizeSearchText(value).includes(q));
      if (!matches) return false;
    }

    if (filters.college && user.collegeName !== filters.college) return false;
    if (filters.stream && user.courseStream !== filters.stream) return false;
    if (filters.gender && user.gender !== filters.gender) return false;
    if (filters.certification && user.sapCertification !== filters.certification) return false;
    if (filters.status === "active" && !user.isActive) return false;
    if (filters.status === "inactive" && user.isActive) return false;
    if (minCgpa !== null && (user.cgpa ?? 0) < minCgpa) return false;
    if (maxCgpa !== null && (user.cgpa ?? 0) > maxCgpa) return false;

    const createdAt = parseDateValue(user.createdAt);
    if (fromDate && (!createdAt || createdAt < fromDate)) return false;
    if (toDate && (!createdAt || createdAt > toDate)) return false;

    return true;
  });

  next.sort((left, right) => {
    const leftValue = filters.sortKey === "createdAt" ? parseDateValue(left.createdAt) ?? new Date(0) : left[filters.sortKey];
    const rightValue = filters.sortKey === "createdAt" ? parseDateValue(right.createdAt) ?? new Date(0) : right[filters.sortKey];
    const comparison = compareValues(leftValue, rightValue);
    return filters.sortDir === "asc" ? comparison : -comparison;
  });

  return next;
};

export const filterAssignableStudents = <T extends AssignableStudentLike>(
  students: T[],
  filters: {
    search: string;
    stream: string;
    college: string;
    status: AssignableStatusFilter;
  }
) =>
  students.filter((student) => {
    const matchesStatus =
      filters.status === "all" ? true : filters.status === "active" ? Boolean(student.isActive) : !student.isActive;
    if (!matchesStatus) return false;
    if (filters.stream && student.courseStream !== filters.stream) return false;
    if (filters.college && student.collegeName !== filters.college) return false;

    const haystack = [student.name, student.userId, student.email, student.courseStream, student.collegeName, student.gender]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return !filters.search.trim() || haystack.includes(filters.search.trim().toLowerCase());
  });

export const filterMasterItems = <T extends MasterItemLike>(items: T[], query: string) => {
  const normalized = query.trim().toLowerCase();
  return normalized ? items.filter((item) => item.label.toLowerCase().includes(normalized)) : items;
};

export const filterAdminTests = <T extends AdminTestLike>(
  tests: T[],
  filters: {
    search: string;
    status: "" | "active" | "draft" | "completed" | "upcoming" | "expired";
    durationBand: TestDurationBand;
    section: string;
    questionBand: TestQuestionBand;
    cutoffBand: TestCutoffBand;
    sectionCountBand: SectionCountBand;
    assignmentLoad: AssignmentLoadBand;
    college: string;
    createdRange: RelativeDateFilter;
    updatedRange: RelativeDateFilter;
    minCutoff: string;
    maxCutoff: string;
    minDuration: string;
    maxDuration: string;
    minQuestions: string;
    maxQuestions: string;
    minAssignments: string;
    maxAssignments: string;
    createdFrom: string;
    createdTo: string;
    sortBy:
      | "newest"
      | "oldest"
      | "updated"
      | "name"
      | "duration-high"
      | "duration-low"
      | "questions-high"
      | "questions-low"
      | "cutoff-high"
      | "cutoff-low"
      | "assignments-high"
      | "assignments-low";
  },
  now: Date = new Date()
) => {
  const term = normalizeSearchText(filters.search);
  const minCutoffValue = parseNumericInput(filters.minCutoff);
  const maxCutoffValue = parseNumericInput(filters.maxCutoff);
  const minDurationValue = parseNumericInput(filters.minDuration);
  const maxDurationValue = parseNumericInput(filters.maxDuration);
  const minQuestionsValue = parseNumericInput(filters.minQuestions);
  const maxQuestionsValue = parseNumericInput(filters.maxQuestions);
  const minAssignmentsValue = parseNumericInput(filters.minAssignments);
  const maxAssignmentsValue = parseNumericInput(filters.maxAssignments);
  const createdFrom = filters.createdFrom ? startOfLocalDay(new Date(filters.createdFrom)) : null;
  const createdTo = filters.createdTo ? endOfLocalDay(new Date(filters.createdTo)) : null;

  const next = tests.filter((test) => {
    const sectionNames = (test.sections || []).map((section) => (typeof section === "string" ? section : section.name));
    const sectionCount = sectionNames.length;
    const assignmentCount = test.assignmentCount || 0;
    const cutoff = test.passingPercentage || 0;
    const createdAt = parseDateValue(test.createdAt);

    if (filters.status && test.status !== filters.status) return false;
    if (!matchesTestDurationBand(test.duration, filters.durationBand)) return false;
    if (filters.section !== "all" && !sectionNames.includes(filters.section)) return false;
    if (!matchesTestQuestionBand(test.questions, filters.questionBand)) return false;
    if (!matchesCutoffBand(cutoff, filters.cutoffBand)) return false;
    if (!matchesSectionCountBand(sectionCount, filters.sectionCountBand)) return false;
    if (!matchesAssignmentLoadBand(assignmentCount, filters.assignmentLoad)) return false;
    if (filters.college !== "all" && !(test.assignedColleges || []).includes(filters.college)) return false;
    if (!matchesRelativeDateRange(test.createdAt, filters.createdRange, now)) return false;
    if (!matchesRelativeDateRange(test.updatedAt || test.createdAt, filters.updatedRange, now)) return false;
    if (minCutoffValue !== null && cutoff < minCutoffValue) return false;
    if (maxCutoffValue !== null && cutoff > maxCutoffValue) return false;
    if (minDurationValue !== null && test.duration < minDurationValue) return false;
    if (maxDurationValue !== null && test.duration > maxDurationValue) return false;
    if (minQuestionsValue !== null && test.questions < minQuestionsValue) return false;
    if (maxQuestionsValue !== null && test.questions > maxQuestionsValue) return false;
    if (minAssignmentsValue !== null && assignmentCount < minAssignmentsValue) return false;
    if (maxAssignmentsValue !== null && assignmentCount > maxAssignmentsValue) return false;
    if (createdFrom && (!createdAt || createdAt < createdFrom)) return false;
    if (createdTo && (!createdAt || createdAt > createdTo)) return false;

    if (term) {
      const haystack = normalizeSearchText([
        test.name,
        `${test.duration} min`,
        `${test.questions}`,
        `${cutoff}%`,
        `${assignmentCount}`,
        test.status,
        test.categoryName,
        test.subcategoryName,
        test.stage,
        ...(test.assignedColleges || []),
        ...sectionNames,
      ].join(" "));
      if (!haystack.includes(term)) return false;
    }

    return true;
  });

  next.sort((left, right) => {
    switch (filters.sortBy) {
      case "oldest":
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      case "updated":
        return new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime();
      case "name":
        return left.name.localeCompare(right.name);
      case "duration-high":
        return right.duration - left.duration;
      case "duration-low":
        return left.duration - right.duration;
      case "questions-high":
        return right.questions - left.questions;
      case "questions-low":
        return left.questions - right.questions;
      case "cutoff-high":
        return (right.passingPercentage || 0) - (left.passingPercentage || 0);
      case "cutoff-low":
        return (left.passingPercentage || 0) - (right.passingPercentage || 0);
      case "assignments-high":
        return (right.assignmentCount || 0) - (left.assignmentCount || 0);
      case "assignments-low":
        return (left.assignmentCount || 0) - (right.assignmentCount || 0);
      case "newest":
      default:
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }
  });

  return next;
};

export const filterTestResults = <T extends UserResultLike>(
  results: T[],
  filters: {
    search: string;
    status: ResultStatusFilter;
    college: string;
    sortBy: UserSort;
    minPercent: number;
    maxPercent: number;
    scoreBand: ScoreBand;
    timeSpentBand: TimeSpentBand;
    dateFilter: DateFilter;
    minScore: number;
    minTimeSpentMinutes: number;
    maxTimeSpentMinutes: number;
  },
  now: Date = new Date()
) => {
  const normalizedSearch = filters.search.trim().toLowerCase();
  const filtered = results.filter((result) => {
    if (normalizedSearch) {
      const haystack = [
        result.userId,
        result.userName,
        result.collegeName,
        result.passed ? "passed" : "failed",
        `${result.scoredMarks}`,
        `${result.totalMarks}`,
        `${result.percentage.toFixed(1)}%`,
        formatScoreBand(result.percentage),
        formatTimeSpentBand(result.timeSpentSec),
        result.submittedAt,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(normalizedSearch)) return false;
    }

    if (result.percentage < filters.minPercent || result.percentage > filters.maxPercent) return false;
    if (filters.status === "passed" && !result.passed) return false;
    if (filters.status === "failed" && result.passed) return false;
    if (filters.college !== "all" && (result.collegeName || "") !== filters.college) return false;
    if (filters.scoreBand !== "all" && formatScoreBand(result.percentage) !== filters.scoreBand) return false;
    if (filters.timeSpentBand !== "all" && formatTimeSpentBand(result.timeSpentSec) !== filters.timeSpentBand) return false;
    if (filters.dateFilter !== "all" && !matchesRelativeDateRange(result.submittedAt, filters.dateFilter, now)) return false;
    if (filters.minScore > 0 && result.scoredMarks < filters.minScore) return false;
    if (filters.minTimeSpentMinutes > 0 && result.timeSpentSec < filters.minTimeSpentMinutes * 60) return false;
    if (filters.maxTimeSpentMinutes > 0 && result.timeSpentSec > filters.maxTimeSpentMinutes * 60) return false;
    return true;
  });

  filtered.sort((left, right) => {
    switch (filters.sortBy) {
      case "score-high":
        return right.percentage - left.percentage;
      case "score-low":
        return left.percentage - right.percentage;
      case "name":
        return left.userName.localeCompare(right.userName);
      case "date":
        return new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime();
      case "time-fast":
        return left.timeSpentSec - right.timeSpentSec;
      case "time-slow":
        return right.timeSpentSec - left.timeSpentSec;
      default:
        return 0;
    }
  });

  return filtered;
};

export const filterResultTests = <
  T extends {
    name: string;
    questions: number;
    duration: number;
    totalAttempts: number;
    avgScore: number;
    passRate: number;
  }
>(
  tests: T[],
  filters: {
    search: string;
    attempts: TestAttemptsFilter;
    passRateBand: PassRateBand;
    durationBand: DurationBand;
    sortBy: TestResultsSort;
  }
) => {
  const normalized = filters.search.trim().toLowerCase();
  const next = tests.filter((test) => {
    const matchesSearch =
      !normalized ||
      [
        test.name,
        `${test.questions} questions`,
        `${test.duration} minutes`,
        `${test.totalAttempts} attempts`,
        `${test.avgScore.toFixed(1)}%`,
        `${test.passRate.toFixed(1)}%`,
        formatDurationBand(test.duration),
        formatPassRateBand(test.passRate),
        test.totalAttempts > 0 ? "with attempts" : "without attempts",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);

    const matchesAttempts =
      filters.attempts === "all" ||
      (filters.attempts === "with-attempts" ? test.totalAttempts > 0 : test.totalAttempts === 0);

    return (
      matchesSearch &&
      matchesAttempts &&
      (filters.passRateBand === "all" || formatPassRateBand(test.passRate) === filters.passRateBand) &&
      (filters.durationBand === "all" || formatDurationBand(test.duration) === filters.durationBand)
    );
  });

  next.sort((left, right) => {
    switch (filters.sortBy) {
      case "name":
        return left.name.localeCompare(right.name);
      case "attempts":
      case "recent":
        return right.totalAttempts - left.totalAttempts;
      case "avg-score":
        return right.avgScore - left.avgScore;
      case "pass-rate":
        return right.passRate - left.passRate;
      default:
        return 0;
    }
  });

  return next;
};
