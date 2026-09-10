export interface TenantFeatures {
  examCategories?: boolean;
  aiQuestionGenerator?: boolean;
  bilingualQuestions?: boolean;
  codingSandbox?: boolean;
  automatedStudentFeedback?: boolean;
  videoClasses?: boolean;
  learningDocuments?: boolean;
  certificateGeneration?: boolean;
  leaderboardGamification?: boolean;
  screenProtection?: boolean;
  auditLogs?: boolean;
  customWatermark?: boolean;
  aiProctoring?: boolean;
  strictDeviceLock?: boolean;
  offlineExamSync?: boolean;
  [key: string]: boolean | undefined;
}

export interface TenantInfo {
  tenantId: string;
  name: string;
  brandTitle: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  status?: string;
  features?: TenantFeatures;
  permissions?: Record<string, any>;
  securityPolicy?: Record<string, any>;
  customModuleFlags?: Record<string, boolean>;
}

export interface BrandTheme {
  primaryColor: string;
  primaryDark: string;
  accentColor: string;
  headerBg: string;
  surface: string;
  background: string;
  text: string;
  textMuted: string;
}

export interface StaticBrandConfig {
  brandId: string;
  appName: string;
  applicationId: string;
  versionName: string;
  versionCode: number;
  tenantId: string;
  isWhiteLabel: boolean;
  brandTitle: string;
  tagline: string;
  theme: BrandTheme;
  features: TenantFeatures;
}
