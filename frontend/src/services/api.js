import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach JWT token to requests if present in localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('session_firewall_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Intercept 401/403 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Don't auto-redirect if checking auth or testing scenario
      if (!window.location.pathname.includes('/login')) {
        // Option to trigger logout if session expired
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  verifyMfa: (data) => api.post('/auth/verify-mfa', data),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout')
};

export const sessionApi = {
  getSessions: () => api.get('/sessions'),
  markNotMe: (targetSessionId) => api.post('/sessions/mark-not-me', { targetSessionId }),
  confirmWasMe: (targetSessionId) => api.post('/sessions/confirm-was-me', { targetSessionId }),
  terminateSession: (sessionId) => api.delete(`/sessions/${sessionId}`)
};

export const bankApi = {
  getDashboard: () => api.get('/bank/dashboard'),
  transferMoney: (data) => api.post('/bank/transfer', data),
  getNotifications: () => api.get('/bank/notifications'),
  markNotificationsRead: () => api.post('/bank/notifications/read')
};

export const adminApi = {
  getSessions: (params) => api.get('/admin/sessions', { params }),
  getMetrics: () => api.get('/admin/metrics'),
  getBlocklist: () => api.get('/admin/blocklist'),
  toggleBlocklist: (data) => api.post('/admin/blocklist/toggle', data),
  updateSessionStatus: (sessionId, data) => api.patch(`/admin/sessions/${sessionId}/status`, data),
  toggleUserTransfers: (userId, data) => api.patch(`/admin/users/${userId}/transfers`, data)
};

export const demoApi = {
  resetDemoData: () => api.post('/demo/reset'),
  runScenarioSafeLogin: () => api.post('/demo/scenario-safe'),
  runScenarioSuspiciousLogin: () => api.post('/demo/scenario-suspicious')
};

export default api;
