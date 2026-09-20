import React, { useState } from 'react';
import { KeyRound, ShieldCheck, ArrowRight, X } from 'lucide-react';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import RiskBadge from './RiskBadge';

export default function MfaModal({ mfaData, onClose, onSuccess }) {
  const { handleLoginSuccess } = useAuth();
  const [code, setCode] = useState(mfaData?.demoMfaCode || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!mfaData) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await authApi.verifyMfa({
        userId: mfaData.userId,
        sessionId: mfaData.sessionId,
        code
      });

      if (res.data.success) {
        handleLoginSuccess(res.data);
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        setError(res.data.message || 'Invalid passcode.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
        <div className="bg-gradient-to-r from-blue-900 to-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 border border-blue-400/30 rounded-xl">
              <KeyRound className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Two-Factor Authentication</h3>
              <p className="text-xs text-slate-300">Session Firewall Security Verification</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 p-3 rounded-xl">
            <div className="text-xs text-amber-900">
              <p className="font-semibold">Medium Risk Verification Required</p>
              <p className="text-[11px] text-amber-700">A new device or IP triggered automated step-up auth.</p>
            </div>
            <RiskBadge score={mfaData.riskScore || 30} level="medium" />
          </div>

          <p className="text-sm text-slate-600">
            For your security, we generated a simulated verification passcode to confirm this session.
          </p>

          {mfaData.demoMfaCode && (
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 text-center">
              <p className="text-xs text-slate-500 font-medium">Demo Simulated OTP Passcode</p>
              <p className="text-2xl font-mono font-bold tracking-widest text-blue-900 mt-1">
                {mfaData.demoMfaCode}
              </p>
              <button
                type="button"
                onClick={() => setCode(mfaData.demoMfaCode)}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-medium mt-1 underline"
              >
                Autofill Code
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Enter 6-Digit Verification Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono text-center text-lg tracking-widest"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 font-medium bg-red-50 p-2.5 rounded-lg border border-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-semibold shadow-md transition-all text-sm disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Authorize Session'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
