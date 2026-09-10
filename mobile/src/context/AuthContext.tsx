import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { User, UserRole, AuthState } from "../types/user";
import { Storage, StorageKeys } from "../utils/storage";
import { authApi } from "../api/authApi";
import { setSecurityCallbacks } from "../api/client";
import { useTenant } from "./TenantContext";

interface AuthContextValue extends AuthState {
  login: (credentials: { userId: string; password: string; role: UserRole }) => Promise<void>;
  logout: () => Promise<void>;
  switchActiveTenant: (tenantId: string) => Promise<void>;
  acknowledgeSuspension: () => Promise<void>;
}

const initialAuthState: AuthState = {
  user: null,
  role: null,
  userId: "",
  sessionId: "",
  activeTenantId: "default",
  isLoggedIn: false,
  isSuspended: false,
  suspensionReason: undefined,
  isLoading: true,
};

const AuthContext = createContext<AuthContextValue>({
  ...initialAuthState,
  login: async () => {},
  logout: async () => {},
  switchActiveTenant: async () => {},
  acknowledgeSuspension: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(initialAuthState);
  const { loadTenantBranding, setTenantState } = useTenant();

  const restoreSession = useCallback(async () => {
    try {
      const [savedUser, isSuspendedFlag] = await Promise.all([
        Storage.getItem<User>(StorageKeys.AUTH_USER),
        Storage.getItem<string>(StorageKeys.SUSPENDED_FLAG),
      ]);

      if (isSuspendedFlag === "true") {
        setAuthState((prev) => ({
          ...prev,
          isSuspended: true,
          suspensionReason: "Account suspended due to exam security violation.",
          isLoading: false,
        }));
        return;
      }

      if (savedUser && savedUser.userId && savedUser.role) {
        setAuthState({
          user: savedUser,
          role: savedUser.role,
          userId: savedUser.userId,
          sessionId: savedUser.sessionId || "",
          activeTenantId: savedUser.tenantId || "default",
          isLoggedIn: true,
          isSuspended: false,
          isLoading: false,
        });

        if (savedUser.tenant) {
          setTenantState(savedUser.tenant);
        } else {
          loadTenantBranding(savedUser.tenantId);
        }
      } else {
        setAuthState((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (e) {
      console.warn("Session restore failed:", e);
      setAuthState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [loadTenantBranding, setTenantState]);

  useEffect(() => {
    // Setup central API interceptor hooks
    setSecurityCallbacks({
      onSuspended: (reason: string) => {
        setAuthState((prev) => ({
          ...prev,
          isSuspended: true,
          suspensionReason: reason,
        }));
      },
      onUnauthorized: () => {
        logout();
      },
    });

    restoreSession();
  }, [restoreSession]);

  const login = async (credentials: { userId: string; password: string; role: UserRole }) => {
    setAuthState((prev) => ({ ...prev, isLoading: true }));
    try {
      const res = await authApi.login(credentials);
      const user = res.user;

      await Storage.setItem(StorageKeys.AUTH_USER, user);
      await Storage.setItem(StorageKeys.USER_ID, user.userId);
      await Storage.setItem(StorageKeys.USER_ROLE, user.role);
      await Storage.setItem(StorageKeys.TENANT_ID, user.tenantId || "default");
      await Storage.setItem(StorageKeys.ACTIVE_TENANT_ID, user.tenantId || "default");
      if (user.sessionId) {
        await Storage.setItem(StorageKeys.SESSION_ID, user.sessionId);
      }
      await Storage.removeItem(StorageKeys.SUSPENDED_FLAG);

      if (user.tenant) {
        setTenantState(user.tenant);
      } else {
        await loadTenantBranding(user.tenantId);
      }

      setAuthState({
        user,
        role: user.role,
        userId: user.userId,
        sessionId: user.sessionId || "",
        activeTenantId: user.tenantId || "default",
        isLoggedIn: true,
        isSuspended: false,
        isLoading: false,
      });
    } catch (error) {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const logout = async () => {
    await Storage.clearUserSession();
    setAuthState({
      ...initialAuthState,
      isLoading: false,
    });
  };

  const switchActiveTenant = async (tenantId: string) => {
    await Storage.setItem(StorageKeys.ACTIVE_TENANT_ID, tenantId);
    setAuthState((prev) => ({
      ...prev,
      activeTenantId: tenantId,
    }));
    await loadTenantBranding(tenantId);
  };

  const acknowledgeSuspension = async () => {
    await Storage.removeItem(StorageKeys.SUSPENDED_FLAG);
    setAuthState((prev) => ({
      ...prev,
      isSuspended: false,
      suspensionReason: undefined,
    }));
    await logout();
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        logout,
        switchActiveTenant,
        acknowledgeSuspension,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
