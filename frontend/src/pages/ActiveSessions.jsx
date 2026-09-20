import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, AlertTriangle, RefreshCw, Smartphone, Laptop, CheckCircle, Lock, Info } from 'lucide-react';
import { sessionApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSecurity } from '../context/SecurityContext';
import SessionCard from '../components/SessionCard';

export default function ActiveSessions() {
  const { user, refreshUser } = useAuth();
  const { handleMarkNotMe } = useSecurity();
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [successBanner, setSuccessBanner] = useState('');

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await sessionApi.getSessions();
      if (res.data.success) {
        setSessions(res.data.sessions);
        setCurrentSessionId(res.data.currentSessionId);
      }
    } catch (err) {
      console.warn('Failed to load active sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const onMarkNotMe = async (sessionId) => {
    setProcessingId(sessionId);
    try {
      await handleMarkNotMe(sessionId);
      setSuccessBanner('Session quarantined! All other sessions terminated, transfers locked, and incident sent to Bank Administrator.');
      await fetchSessions();
      await refreshUser();
    } catch (err) {
      console.error('Error marking not me:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const onTerminate = async (sessionId) => {
    setProcessingId(sessionId);
    try {
      const res = await sessionApi.terminateSession(sessionId);
      if (res.data.success) {
        await fetchSessions();
      }
    } catch (err) {
      console.error('Error terminating session:', err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Active Sessions & Device Management
          </h1>
          <p className="text-xs text-slate-500">
            View every device authenticated into your account. If you do not recognize an activity, click "This was not me" to initiate instant lockdown.
          </p>
        </div>

        <button
          onClick={fetchSessions}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition-colors shadow-xs self-start sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="bg-red-50 border-l-4 border-l-red-600 p-4 rounded-xl text-xs text-red-900 flex items-start gap-3 animate-fade-in">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">{successBanner}</p>
            <p className="text-red-700 text-[11px] mt-1">
              Instructions: Please contact bank security or reset your online banking password.
            </p>
          </div>
          <button onClick={() => setSuccessBanner('')} className="text-red-600 hover:text-red-800 font-bold">✕</button>
        </div>
      )}

      {/* Guidance Note */}
      <div className="bg-blue-50/70 border border-blue-200 p-4 rounded-2xl flex items-start gap-3 text-xs text-blue-950">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p>
          <strong>Session Firewall Protocol:</strong> Our zero-trust engine tracks device user-agent fingerprints, IP geolocations, and travel velocities. If you see a session from another city or device you didn't authorize, marking it as <strong>"This was not me"</strong> will block the attacker's IP, revoke their tokens, and safeguard your account balance.
        </p>
      </div>

      {/* Sessions List */}
      <div className="space-y-3">
        {loading && sessions.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Loading active sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            No active sessions found.
          </div>
        ) : (
          sessions.map((sess) => (
            <SessionCard
              key={sess._id}
              session={sess}
              isCurrent={sess.sessionId === currentSessionId}
              onMarkNotMe={onMarkNotMe}
              onTerminate={onTerminate}
              processing={processingId === sess.sessionId}
            />
          ))
        )}
      </div>
    </div>
  );
}
