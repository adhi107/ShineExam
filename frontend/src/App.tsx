import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import AnswererDashboard from './components/AnswererDashboard';
import './App.css';
import './CardMotion.css';

type UserRole = 'admin' | 'answerer';

function App() {
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [currentUser, setCurrentUser] = useState<string>('');
  const navigate = useNavigate();

  // Restore the Shine Exam session after a page refresh.
  useEffect(() => {
    const savedRole = sessionStorage.getItem('role') as UserRole | null;
    const savedUser = sessionStorage.getItem('userId');
    if (savedRole && savedUser) {
      setCurrentRole(savedRole);
      setCurrentUser(savedUser);
    }
  }, []);

  const handleLogin = (role: UserRole, userId: string) => {
    sessionStorage.setItem('role', role);
    sessionStorage.setItem('userId', userId);
    setCurrentRole(role);
    setCurrentUser(userId);
    navigate(role === 'admin' ? '/admin' : '/dashboard');
  };

  const handleLogout = () => {
    sessionStorage.clear();
    setCurrentRole(null);
    setCurrentUser('');
    navigate('/login');
  };

  const isLoggedIn = !!currentRole && !!currentUser;

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isLoggedIn
            ? <Navigate to={currentRole === 'admin' ? '/admin' : '/dashboard'} replace />
            : <Login onLogin={handleLogin} />
        }
      />
      <Route
        path="/admin/*"
        element={
          isLoggedIn && currentRole === 'admin'
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
          <Navigate to={isLoggedIn ? (currentRole === 'admin' ? '/admin' : '/dashboard') : '/login'} replace />
        }
      />
    </Routes>
  );
}

export default App;
