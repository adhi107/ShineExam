import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login, { UserRole } from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import AnswererDashboard from './components/AnswererDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import { useSecurityContext } from './security';
import { useInactivityLogout } from './hooks/useInactivityLogout';
import { TenantProvider, useTenant } from './context/TenantContext';
import { buildUrl, apiGet } from './services/api';
import './App.css';
import './CardMotion.css';

function AccountSuspendedPage({ onLogout }: { onLogout: () => void }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100vh',
      background: '#07070d',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2147483647,
      color: '#fff',
      padding: '20px',
      fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
    }}>
      <div style={{
        maxWidth: '520px',
        width: '100%',
        background: 'linear-gradient(180deg, #18111e 0%, #0d0914 100%)',
        border: '2px solid #ef4444',
        borderRadius: '20px',
        padding: '3rem 2.5rem',
        textAlign: 'center',
        boxShadow: '0 25px 80px rgba(0,0,0,0.95), 0 0 50px rgba(239, 68, 68, 0.35)',
      }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🚫</div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ef4444', margin: '0 0 1rem 0' }}>
          ACCOUNT SUSPENDED
        </h2>
        <div style={{
          fontSize: '1.15rem',
          fontWeight: 700,
          color: '#fff',
          background: 'rgba(239, 68, 68, 0.2)',
          border: '1px solid rgba(239, 68, 68, 0.6)',
          borderRadius: '12px',
          padding: '16px 20px',
          margin: '1.25rem 0',
        }}>
          Your account is suspended. Contact the admin for unblock.
        </div>
        <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, margin: '1rem 0 1.5rem 0' }}>
          A critical security policy violation (unauthorized screenshot or screen capture) was recorded. Your exam access has been terminated and your account is permanently blocked.
        </p>
        <button
          type="button"
          onClick={onLogout}
          style={{
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: '#fff',
            border: 'none',
            padding: '12px 28px',
            fontSize: '1rem',
            fontWeight: 700,
            borderRadius: '10px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
          }}
        >
          Exit to Login
        </button>
      </div>
    </div>
  );
}

function MainAppRoutes() {
  const [currentRole, setCurrentRole] = useState<UserRole | null>(() => {
    return sessionStorage.getItem('role') as UserRole | null;
  });
  const [currentUser, setCurrentUser] = useState<string>(() => {
    return sessionStorage.getItem('userId') || '';
  });
  const [isSuspended, setIsSuspended] = useState<boolean>(() => {
    return sessionStorage.getItem('account_permanently_blocked') === 'true';
  });
  const navigate = useNavigate();
  const { initSession, clearSession } = useSecurityContext();
  const { loadTenantBranding } = useTenant();

  // Restore session and verify candidate account status on load/refresh.
  useEffect(() => {
    const isBlockedFlag = sessionStorage.getItem('account_permanently_blocked') === 'true';
    if (isBlockedFlag) {
      setIsSuspended(true);
      return;
    }

    const savedRole = sessionStorage.getItem('role') as UserRole | null;
    const savedUser = sessionStorage.getItem('userId');

    if (savedRole === 'answerer' && savedUser) {
      apiGet<{ tests?: any[] }>(`/answerer/tests?userId=${encodeURIComponent(savedUser)}`)
        .catch((err: any) => {
          if (err?.message && (err.message.includes('suspended') || err.message.includes('blocked'))) {
            sessionStorage.setItem('account_permanently_blocked', 'true');
            setIsSuspended(true);
          }
        });
    }
  }, []);

  const handleLogin = async (role: UserRole, userId: string, sessionId?: string) => {
    sessionStorage.removeItem('account_permanently_blocked');
    setIsSuspended(false);
    sessionStorage.setItem('role', role);
    sessionStorage.setItem('userId', userId);
    if (sessionId) {
      sessionStorage.setItem('securitySessionId', sessionId);
    }
    setCurrentRole(role);
    setCurrentUser(userId);
    await initSession(userId);

    if (role === 'super_admin') {
      navigate('/super-admin');
    } else if (role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/dashboard');
    }
  };

  const handleLogout = () => {
    clearSession();
    sessionStorage.clear();
    setIsSuspended(false);
    setCurrentRole(null);
    setCurrentUser('');
    navigate('/login');
  };

  const handleEnterTenantAdmin = (tenantId: string) => {
    sessionStorage.setItem("activeTenantId", tenantId);
    navigate('/admin');
  };

  const isLoggedIn = !!currentRole && !!currentUser;

  // Global inactivity auto-logout tracker
  useInactivityLogout({ onLogout: handleLogout, isLoggedIn });

  if (isSuspended) {
    return <AccountSuspendedPage onLogout={handleLogout} />;
  }

  const getDefaultRoute = () => {
    if (!isLoggedIn) return '/login';
    if (currentRole === 'super_admin') return '/super-admin';
    if (currentRole === 'admin') return '/admin';
    return '/dashboard';
  };

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isLoggedIn
            ? <Navigate to={getDefaultRoute()} replace />
            : <Login onLogin={handleLogin} />
        }
      />
      <Route
        path="/super-admin/*"
        element={
          isLoggedIn && currentRole === 'super_admin'
            ? <SuperAdminDashboard onLogout={handleLogout} onEnterTenantAdmin={handleEnterTenantAdmin} />
            : <Navigate to="/login" replace />
        }
      />
      <Route
        path="/admin/*"
        element={
          isLoggedIn && (currentRole === 'admin' || currentRole === 'super_admin')
            ? <AdminDashboard adminName={currentUser} onLogout={handleLogout} />
            : <Navigate to="/login" replace />
        }
      />
      <Route
        path="/dashboard/*"
        element={
          isLoggedIn && currentRole === 'answerer'
            ? <AnswererDashboard userName={currentUser} onLogout={handleLogout} />
            : <Navigate to="/login" replace />
        }
      />
      <Route
        path="*"
        element={
          <Navigate to={getDefaultRoute()} replace />
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <TenantProvider>
      <MainAppRoutes />
    </TenantProvider>
  );
}

export default App;
