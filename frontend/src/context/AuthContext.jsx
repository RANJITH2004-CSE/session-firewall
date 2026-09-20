import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('session_firewall_token') || null);
  const [currentSession, setCurrentSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user profile on mount if token is stored
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('session_firewall_token');
      if (storedToken) {
        try {
          const res = await authApi.getMe();
          if (res.data.success) {
            setUser(res.data.user);
            setCurrentSession(res.data.currentSession);
          } else {
            handleLogout();
          }
        } catch (err) {
          console.warn('[Auth] Token validation failed:', err.message);
          handleLogout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const handleLoginSuccess = (data) => {
    if (data.token) {
      localStorage.setItem('session_firewall_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setCurrentSession(data.session);
    }
  };

  const handleLogout = async () => {
    try {
      if (token) {
        await authApi.logout();
      }
    } catch (err) {
      // Ignore errors on logout
    } finally {
      localStorage.removeItem('session_firewall_token');
      setToken(null);
      setUser(null);
      setCurrentSession(null);
    }
  };

  const refreshUser = async () => {
    try {
      const res = await authApi.getMe();
      if (res.data.success) {
        setUser(res.data.user);
        setCurrentSession(res.data.currentSession);
      }
    } catch (err) {
      console.error('[Auth] Refresh user error:', err);
    }
  };

  const loginWithDemo = async (role = 'customer') => {
    const creds = role === 'admin'
      ? { email: 'admin@securebank.com', password: 'AdminSecure123!' }
      : { email: 'customer@securebank.com', password: 'Password123!' };
    
    return authApi.login(creds);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        token,
        currentSession,
        setCurrentSession,
        loading,
        handleLoginSuccess,
        logout: handleLogout,
        refreshUser,
        loginWithDemo
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
