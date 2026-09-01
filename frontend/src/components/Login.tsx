import React, { useState } from 'react';
import './Login.css';
import { apiPost } from "../services/api";
import AppIcon from './AppIcons';
import ShineLogo from './ShineLogo';
import AlertDialog, { AlertVariant } from './AlertDialog';
import { useTenant } from '../context/TenantContext';

export type UserRole = 'admin' | 'answerer' | 'super_admin';

interface LoginProps {
  onLogin: (role: UserRole, userId: string, sessionId?: string, tenant?: any) => void;
  defaultRole?: UserRole;
}

interface AlertState {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  variant: AlertVariant;
  buttonText?: string;
  icon?: string;
}

const Login: React.FC<LoginProps> = ({ onLogin, defaultRole = 'answerer' }) => {
  const { tenant, setTenant } = useTenant();
  const isSuperAdmin = defaultRole === 'super_admin';
  const [selectedRole, setSelectedRole] = useState<UserRole>(defaultRole);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [alertState, setAlertState] = useState<AlertState | null>(null);

  React.useEffect(() => {
    const isSuspended = sessionStorage.getItem("account_permanently_blocked") === "true";
    if (isSuspended) {
      sessionStorage.removeItem("account_permanently_blocked");
      setAlertState({
        isOpen: true,
        title: "Account Suspended",
        message: (
          <>
            Your account has been suspended due to an exam security violation.
            <br /><br />
            Please contact your system administrator to unblock your account.
          </>
        ),
        variant: "suspended",
        icon: "🚫",
        buttonText: "Acknowledge",
      });
      return;
    }

    const idleMins = sessionStorage.getItem("inactivity_logout_alert");
    if (idleMins) {
      sessionStorage.removeItem("inactivity_logout_alert");
      setAlertState({
        isOpen: true,
        title: "Session Expired",
        message: `You were automatically logged out due to ${idleMins} minutes of inactivity. Please log in again to continue.`,
        variant: "warning",
        icon: "⏳",
        buttonText: "Sign In",
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !password) return;
    setIsLoading(true);
    try {
      const res = await apiPost<{ user: any }>("/auth/login", {
        userId,
        password,
        role: isSuperAdmin ? 'super_admin' : selectedRole,
      });

      if (res.user.tenant) {
        setTenant(res.user.tenant);
      }
      if (res.user.tenantId) {
        sessionStorage.setItem("tenantId", res.user.tenantId);
        sessionStorage.setItem("activeTenantId", res.user.tenantId);
      }

      onLogin(res.user.role, res.user.userId, res.user.sessionId, res.user.tenant);
    } catch (err: any) {
      const msg: string = err?.message || err?.error || "";
      if (msg.toLowerCase().includes("mismatch") || msg.toLowerCase().includes("registered as") || msg.toLowerCase().includes("access denied")) {
        setAlertState({
          isOpen: true,
          title: "Role Mismatch",
          message: msg,
          variant: "warning",
          icon: "🔄",
          buttonText: "Switch Role",
        });
      } else if (msg.toLowerCase().includes("expired")) {
        setAlertState({
          isOpen: true,
          title: "Account Validity Expired",
          message: (
            <>
              Your portal access validity has expired.
              <br />
              Please contact your administrator to extend your examination eligibility.
            </>
          ),
          variant: "warning",
          icon: "⏳",
          buttonText: "Understood",
        });
      } else if (
        msg.toLowerCase().includes("suspended") ||
        msg.toLowerCase().includes("screenshot") ||
        msg.toLowerCase().includes("violation") ||
        msg.toLowerCase().includes("blocked") ||
        msg.toLowerCase().includes("inactive")
      ) {
        setAlertState({
          isOpen: true,
          title: "Account Inactive or Suspended",
          message: (
            <>
              {msg || "Your account or organization is currently inactive. Please contact the administrator."}
            </>
          ),
          variant: "suspended",
          icon: "🚫",
          buttonText: "Acknowledge",
        });
      } else {
        setAlertState({
          isOpen: true,
          title: "Invalid Credentials",
          message: msg || "Please check your User ID and password and try again. Ensure the correct role (Test Taker vs Admin) is selected.",
          variant: "warning",
          icon: "⚠️",
          buttonText: "Try Again",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setAlertState({
      isOpen: true,
      title: "Password Recovery",
      message: (
        <>
          {isSuperAdmin
            ? "Super Administrator credentials and recovery keys are managed through server infrastructure environment settings."
            : "For candidate security and identity verification, password resets are handled directly by your Organization Administration."}
          <br /><br />
          {isSuperAdmin
            ? "Please verify your master database environment or contact your infrastructure administrator."
            : <>Please contact your administrator with your <strong>User ID</strong> to receive a temporary login password.</>}
        </>
      ),
      variant: "info",
      icon: "🔑",
      buttonText: "Got it",
    });
  };

  const isCustomTheme = !isSuperAdmin && tenant?.primaryColor && !tenant.name?.toLowerCase().includes("shine") && tenant.name !== "Examination Portal";
  const displayBrandTitle = isSuperAdmin
    ? "GLOBAL PLATFORM GOVERNANCE"
    : (tenant?.brandTitle && !tenant.brandTitle.toLowerCase().includes("shine") && tenant.brandTitle !== "Examination Portal"
        ? tenant.brandTitle
        : (tenant?.name && !tenant.name.toLowerCase().includes("shine") && tenant.name !== "Examination Portal" ? tenant.name : "EXAMINATION PORTAL"));

  return (
    <div className="login-container">
      <section
        className="login-brand-panel"
        style={
          isSuperAdmin
            ? { background: "linear-gradient(145deg, #090e1a 0%, #1e1b4b 55%, #312e81 100%)" }
            : isCustomTheme
            ? { background: `linear-gradient(145deg, #061631 0%, ${tenant?.primaryColor} 100%)` }
            : undefined
        }
      >
        <div className="login-brand-content">
          <ShineLogo inverse />
          <div className="login-brand-message">
            <span className="login-eyebrow" style={isSuperAdmin ? { color: "#a5b4fc" } : undefined}>
              {displayBrandTitle}
            </span>
            {isSuperAdmin ? (
              <>
                <h2>Enterprise Control.<br />Global Governance.</h2>
                <p>
                  Master control suite for multi-tenant administration, organization provisioning, license governance, and enterprise security auditing.
                </p>
              </>
            ) : (
              <>
                <h2>Prepare with purpose.<br />Perform with confidence.</h2>
                <p>
                  One focused platform for practice tests, timed assessments and meaningful performance insights.
                </p>
              </>
            )}
          </div>
        </div>
      </section>
      <div className="login-card">
        <div className="login-logo-container">
          <ShineLogo />
        </div>

        <div className="login-header">
          <span className="login-eyebrow dark" style={isSuperAdmin ? { color: "#4f46e5" } : undefined}>
            {isSuperAdmin
              ? "SUPER ADMINISTRATOR CONSOLE"
              : tenant?.name && !tenant.name.toLowerCase().includes("shine") && tenant.name !== "Examination Portal"
              ? tenant.name.toUpperCase()
              : "WELCOME BACK"}
          </span>
          <h1 className="login-title">
            {isSuperAdmin
              ? "Super Admin Portal"
              : selectedRole === "admin"
              ? "Admin Portal"
              : "Candidate Login"}
          </h1>
          <p className="login-subtitle">
            {isSuperAdmin
              ? "Global multi-tenant governance, organization management & system controls"
              : selectedRole === "admin"
              ? "Sign in to manage tests, users, and examination operations"
              : "Sign in to access your examination workspace"}
          </p>
        </div>

        {!isSuperAdmin && (
          <div className="role-selector">
            <button
              className={`role-btn ${selectedRole === "answerer" ? "active" : ""}`}
              onClick={() => setSelectedRole("answerer")}
              type="button"
            >
              <span className="role-label">Test Taker</span>
            </button>
            <button
              className={`role-btn ${selectedRole === "admin" ? "active" : ""}`}
              onClick={() => setSelectedRole("admin")}
              type="button"
            >
              <span className="role-label">Admin</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="userId">Email or User ID</label>
            <input
              id="userId"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder={isSuperAdmin ? "Enter super admin ID (e.g. superadmin)" : "Enter your email or user ID"}
              required
              autoComplete="username"
            />
          </div>
          <div className="form-group password-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label="Show password"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <button
              type="button"
              className="forgot-link"
              onClick={handleForgotPassword}
            >
              Forgot password?
            </button>
          </div>
          <button
            type="submit"
            className="submit-btn"
            disabled={isLoading}
            style={
              isSuperAdmin
                ? { background: "linear-gradient(90deg, #312e81, #4f46e5)", boxShadow: "0 8px 20px rgba(79, 70, 229, 0.28)" }
                : isCustomTheme
                ? { background: `linear-gradient(90deg, ${tenant?.primaryColor}, #2f6fed)` }
                : undefined
            }
          >
            {isLoading
              ? "Signing in..."
              : isSuperAdmin
              ? "Access Super Admin Console"
              : tenant?.name && !tenant.name.toLowerCase().includes("shine") && tenant.name !== "Examination Portal"
              ? `Sign in to ${tenant.name}`
              : selectedRole === "admin"
              ? "Sign In as Admin"
              : "Login to Shine"}
          </button>
        </form>

        <div className="security-badge">
          <AppIcon name="security" className="security-icon" />
          <span>Your session is protected with secure authentication</span>
        </div>

        <div className="login-footer">
          {isSuperAdmin ? (
            <a
              href="/login"
              style={{
                color: "var(--shine-accent)",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: "12.5px",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              ← Return to Candidate / Admin Login
            </a>
          ) : (
            <p>Need help signing in? Contact your administrator.</p>
          )}
        </div>
      </div>

      {/* Screen Center Alert Popup */}
      {alertState && (
        <AlertDialog
          isOpen={alertState.isOpen}
          title={alertState.title}
          message={alertState.message}
          variant={alertState.variant}
          icon={alertState.icon}
          buttonText={alertState.buttonText}
          onClose={() => setAlertState(null)}
        />
      )}
    </div>
  );
};

export default Login;
