import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, AlertOctagon, Lock, Globe, Smartphone, Clock, X } from 'lucide-react';
import { useSecurity } from '../context/SecurityContext';

export default function WasThisYouModal() {
  const { pendingChallenge, setPendingChallenge, handleConfirmWasMe, handleMarkNotMe } = useSecurity();
  const [submitting, setSubmitting] = useState(false);

  if (!pendingChallenge) return null;

  const metadata = pendingChallenge.metadata || {};
  const sessionId = metadata.sessionId;
  const timeFormatted = metadata.timestamp 
    ? new Date(metadata.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : 'Recently';

  const onConfirm = async () => {
    setSubmitting(true);
    await handleConfirmWasMe(sessionId);
    setSubmitting(false);
  };

  const onDeny = async () => {
    setSubmitting(true);
    await handleMarkNotMe(sessionId);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 p-5 text-white flex items-start gap-4">
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
            <ShieldAlert className="w-7 h-7 text-white animate-pulse" />
          </div>
          <div className="flex-1">
            <span className="text-xs uppercase tracking-wider font-semibold text-rose-100 bg-rose-900/40 px-2 py-0.5 rounded-full inline-block mb-1">
              Session Firewall Security Alert
            </span>
            <h3 className="text-xl font-bold leading-tight">
              Suspicious Login Detected
            </h3>
            <p className="text-sm text-rose-100 mt-1">
              An unrecognized session attempt was flagged by our automated risk engine.
            </p>
          </div>
          <button 
            onClick={() => setPendingChallenge(null)}
            className="text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          <div className="bg-rose-50/80 border border-rose-100 rounded-xl p-4">
            <p className="text-base font-semibold text-rose-950">
              {pendingChallenge.message || `Suspicious login detected from ${metadata.device || 'Chrome on Windows'} in ${metadata.location || 'New York'} at ${timeFormatted}. Was this you?`}
            </p>
          </div>

          {/* Telemetry Breakdown */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 text-slate-700">
              <Smartphone className="w-4 h-4 text-slate-500" />
              <div>
                <p className="text-slate-400 font-medium">Device / OS</p>
                <p className="font-semibold text-slate-800">{metadata.device || 'Unknown Device'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-700">
              <Globe className="w-4 h-4 text-slate-500" />
              <div>
                <p className="text-slate-400 font-medium">Location</p>
                <p className="font-semibold text-slate-800">{metadata.location || 'Unknown Location'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-700">
              <Lock className="w-4 h-4 text-slate-500" />
              <div>
                <p className="text-slate-400 font-medium">IP Address</p>
                <p className="font-mono font-semibold text-slate-800">{metadata.ipAddress || '198.51.100.42'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-700">
              <Clock className="w-4 h-4 text-slate-500" />
              <div>
                <p className="text-slate-400 font-medium">Detected Time</p>
                <p className="font-semibold text-slate-800">{timeFormatted}</p>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500 bg-amber-50 p-3 rounded-lg border border-amber-200 flex items-start gap-2">
            <AlertOctagon className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p>
              <strong>Security Protocol:</strong> Clicking "No, secure my account" immediately logs out all other sessions, blocks the unrecognized IP and device signature, locks outgoing transfers, and dispatches an incident report to Bank Security Operations.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 pt-0 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onDeny}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl font-semibold shadow-md shadow-red-200 transition-all text-sm disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            {submitting ? 'Securing Account...' : 'No, secure my account'}
          </button>

          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-semibold border border-slate-300 transition-all text-sm disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {submitting ? 'Verifying...' : 'Yes, it was me'}
          </button>
        </div>
      </div>
    </div>
  );
}
