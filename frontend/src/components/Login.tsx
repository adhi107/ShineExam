import React, { useState } from 'react';
import './Login.css';
import { apiPost } from "../services/api";
import AppIcon from './AppIcons';
import ShineLogo from './ShineLogo';
import AlertDialog, { AlertVariant } from './AlertDialog';

type UserRole = 'admin' | 'answerer';

interface LoginProps {
  onLogin: (role: UserRole, userId: string, sessionId?: string) => void;
}

interface AlertState {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  variant: AlertVariant;
  buttonText?: string;
  icon?: string;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('answerer');
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
        role: selectedRole,
      });
      onLogin(res.user.role, res.user.userId, res.user.sessionId);
    } catch (err: any) {
      const msg: string = err?.message || err?.error || "";
      if (msg.toLowerCase().includes("expired")) {
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
          title: "Account Suspended",
          message: (
            <>
              Your account has been suspended due to an exam security policy violation.
              <br />
              Please contact your system administrator to request an account review and unblock.
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
          message: "Please check your User ID and password and try again. Ensure the correct role (Test Taker vs Administrator) is selected.",
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
          For candidate security and identity verification, password resets are handled directly by the Exam Administration.
          <br /><br />
          Please contact your administrator with your <strong>User ID</strong> to receive a temporary login password.
        </>
      ),
      variant: "info",
      icon: "🔑",
      buttonText: "Got it",
    });
  };

  return (
    <div className="login-container">
      <section className="login-brand-panel">
        <div className="login-brand-content">
          <ShineLogo inverse />
          <div className="login-brand-message">
            <span className="login-eyebrow">YOUR LEARNING JOURNEY</span>
            <h2>Prepare with purpose.<br />Perform with confidence.</h2>
            <p>One focused platform for practice tests, timed assessments and meaningful performance insights.</p>
          </div>
          <div className="login-brand-stats">
            <span><strong>10K+</strong> learners</span>
            <span><strong>500+</strong> assessments</span>
            <span><strong>24/7</strong> access</span>
          </div>
        </div>
      </section>
      <div className="login-card">
        <div className="login-logo-container">
          <ShineLogo />
        </div>

        <div className="login-header">
          <span className="login-eyebrow dark">WELCOME BACK</span>
          <h1 className="login-title">Candidate Login</h1>
          <p className="login-subtitle">Sign in to continue to your Shine learning space</p>
        </div>

        <div className="role-selector compact-role-selector">
          <button
            className={`role-btn ${selectedRole === 'answerer' ? 'active' : ''}`}
            onClick={() => setSelectedRole('answerer')}
            type="button"
          >
            <span className="role-label">Test Taker</span>
          </button>
          <button
            className={`role-btn ${selectedRole === 'admin' ? 'active' : ''}`}
            onClick={() => setSelectedRole('admin')}
            type="button"
          >
            <span className="role-label">Administrator</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="userId">Email or User ID</label>
            <input
              id="userId"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter your email or user ID"
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
                onClick={() => setShowPassword(v => !v)}
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
          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Login to Shine'}
          </button>
        </form>

        <div className="security-badge">
          <AppIcon name="security" className="security-icon" />
          <span>Your session is protected with secure authentication</span>
        </div>

        <div className="login-footer">
          <p>Need help signing in? Contact your administrator.</p>
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
