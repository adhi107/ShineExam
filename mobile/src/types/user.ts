export type UserRole = "answerer" | "admin" | "super_admin";

export interface User {
  id: string;
  userId: string;
  name: string;
  email?: string;
  role: UserRole;
  tenantId: string;
  tenant?: any;
  sessionId?: string;
  isActive?: boolean;
  validUntil?: string;
  lastLoginAt?: string;
}

export interface AuthState {
  user: User | null;
  role: UserRole | null;
  userId: string;
  sessionId: string;
  activeTenantId: string;
  isLoggedIn: boolean;
  isSuspended: boolean;
  suspensionReason?: string;
  isLoading: boolean;
}
