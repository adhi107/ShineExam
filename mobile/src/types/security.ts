export interface SecurityConfig {
  autoLogoutEnabled: boolean;
  autoLogoutMinutes: number;
  strictScreenshotLock: boolean;
  screenshotAllowedAttempts: number;
  screenshotProtectedModules: string[];
  watermarkEnabled: boolean;
  watermarkIntervalSec: number;
  allowCandidateDocumentView: boolean;
  allowCandidateDocumentDownload: boolean;
  watermarkDocuments: boolean;
}

export interface SecurityViolation {
  id?: string;
  tenantId?: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  type: string;
  module: string;
  sessionId?: string;
  attemptNumber: number;
  status: "warned" | "blocked";
  recordedAt: string;
}
