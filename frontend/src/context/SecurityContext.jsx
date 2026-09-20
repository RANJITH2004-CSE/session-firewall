import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { bankApi, sessionApi } from '../services/api';
import { useAuth } from './AuthContext';

const SecurityContext = createContext();

export const useSecurity = () => useContext(SecurityContext);

export const SecurityProvider = ({ children }) => {
  const { user, token, refreshUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingChallenge, setPendingChallenge] = useState(null); // Suspicious login requiring "Was this you?"
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [activeMfaData, setActiveMfaData] = useState(null); // If MFA prompt is active
  const [bannerAlert, setBannerAlert] = useState(null);

  const fetchNotifications = useCallback(async () => {
    if (!token || user?.role !== 'customer') return;
    try {
      const res = await bankApi.getNotifications();
      if (res.data.success) {
        setNotifications(res.data.notifications);
        const unread = res.data.notifications.filter(n => !n.isRead).length;
        setUnreadCount(unread);

        // Check for latest critical security alert requiring action
        const activeAlert = res.data.notifications.find(
          n => n.type === 'SECURITY_ALERT' && n.metadata?.actionRequired && !n.isRead
        );

        if (activeAlert) {
          setPendingChallenge(activeAlert);
        }
      }
    } catch (err) {
      console.warn('[SecurityContext] Fetch notifications failed:', err.message);
    }
  }, [token, user?.role]);

  // Periodic poll for real-time security events
  useEffect(() => {
    if (!token) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [token, fetchNotifications]);

  // Handle "Yes, it was me"
  const handleConfirmWasMe = async (sessionId) => {
    try {
      const res = await sessionApi.confirmWasMe(sessionId);
      if (res.data.success) {
        setPendingChallenge(null);
        await bankApi.markNotificationsRead();
        await refreshUser();
        fetchNotifications();
        setBannerAlert({
          type: 'success',
          message: 'Device verified and marked as trusted. Session access confirmed.'
        });
      }
    } catch (err) {
      console.error('[Security] Confirm was me failed:', err);
    }
  };

  // Handle "No, secure my account"
  const handleMarkNotMe = async (sessionId) => {
    try {
      const res = await sessionApi.markNotMe(sessionId);
      if (res.data.success) {
        setPendingChallenge(null);
        await bankApi.markNotificationsRead();
        await refreshUser();
        fetchNotifications();
        setBannerAlert({
          type: 'critical',
          message: 'Account locked down: Suspicious session terminated, unauthorized IP/device blocked, and transfers restricted.',
          instructions: res.data.instructions
        });
      }
    } catch (err) {
      console.error('[Security] Mark not me failed:', err);
    }
  };

  return (
    <SecurityContext.Provider
      value={{
        notifications,
        unreadCount,
        pendingChallenge,
        setPendingChallenge,
        isEmailModalOpen,
        setIsEmailModalOpen,
        activeMfaData,
        setActiveMfaData,
        bannerAlert,
        setBannerAlert,
        fetchNotifications,
        handleConfirmWasMe,
        handleMarkNotMe
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
};
