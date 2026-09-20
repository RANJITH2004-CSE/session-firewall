import React from 'react';
import { Laptop, Smartphone, Monitor, Globe, ShieldAlert, CheckCircle, Ban, AlertTriangle, Clock } from 'lucide-react';
import RiskBadge from './RiskBadge';

export default function SessionCard({ session, isCurrent, onMarkNotMe, onTerminate, processing }) {
  const getDeviceIcon = (deviceType) => {
    if (deviceType === 'mobile') return <Smartphone className="w-5 h-5 text-blue-600" />;
    if (deviceType === 'tablet') return <Smartphone className="w-5 h-5 text-blue-600" />;
    return <Laptop className="w-5 h-5 text-blue-600" />;
  };

  const getStatusBadge = (status, isActive) => {
    if (status === 'Confirmed Fraud') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
          Confirmed Fraud
        </span>
      );
    }
    if (status === 'Blocked' || !isActive) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
          Revoked / Blocked
        </span>
      );
    }
    if (status === 'MFA Required') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          MFA Required
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
        Active Session
      </span>
    );
  };

  const formattedTime = session.createdAt
    ? new Date(session.createdAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Unknown time';

  return (
    <div className={`p-5 rounded-2xl border transition-all ${
      isCurrent 
        ? 'bg-blue-50/40 border-blue-300 shadow-sm ring-1 ring-blue-400' 
        : session.riskScore >= 60 || session.status === 'Confirmed Fraud'
          ? 'bg-red-50/30 border-red-200 shadow-sm'
          : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
    }`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Telemetry Details */}
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs mt-0.5">
            {getDeviceIcon(session.deviceType)}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900">
                {session.device || `${session.browser} on ${session.os}`}
              </h4>

              {isCurrent && (
                <span className="px-2 py-0.5 bg-blue-700 text-white font-semibold text-[10px] rounded-full uppercase tracking-wider">
                  Current Session
                </span>
              )}

              {getStatusBadge(session.status, session.isActive)}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-0.5">
              <span className="flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                {session.location?.city ? `${session.location.city}, ${session.location.country}` : 'Unknown Location'}
                {session.isVpn && <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 rounded ml-1 font-semibold">VPN</span>}
              </span>

              <span className="font-mono text-slate-600">
                IP: {session.ipAddress}
              </span>

              <span className="flex items-center gap-1 text-slate-500">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {formattedTime}
              </span>

              <span className="text-[11px] font-mono text-slate-400">
                ID: {session.sessionId}
              </span>
            </div>

            {/* Risk Reasons if any */}
            {session.riskReasons && session.riskReasons.length > 0 && (
              <div className="pt-2 flex flex-wrap gap-1.5">
                {session.riskReasons.map((reason, i) => (
                  <span key={i} className="text-[11px] bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-md">
                    {reason}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Action & Risk Badges */}
        <div className="flex items-center gap-3 self-end md:self-center">
          <RiskBadge score={session.riskScore} level={session.riskLevel} />

          {/* "This was not me" button */}
          {session.status !== 'Confirmed Fraud' && (
            <button
              onClick={() => onMarkNotMe(session.sessionId)}
              disabled={processing}
              className="px-3.5 py-2 text-xs font-semibold text-red-600 hover:text-white hover:bg-red-600 border border-red-200 hover:border-red-600 rounded-xl transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              title="Flag as unauthorized session and secure account"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              This was not me
            </button>
          )}

          {/* Terminate button for active non-current sessions */}
          {session.isActive && !isCurrent && onTerminate && (
            <button
              onClick={() => onTerminate(session.sessionId)}
              disabled={processing}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors disabled:opacity-50"
            >
              Terminate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
