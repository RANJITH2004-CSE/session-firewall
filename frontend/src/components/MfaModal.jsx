import React, { useState, useEffect, useCallback } from 'react';
import { KeyRound, Mail, ShieldCheck, ArrowRight, X, RotateCcw, Clock, AlertTriangle, ShieldAlert } from 'lucide-react';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import RiskBadge from './RiskBadge';

const MAX_ATTEMPTS = 3;
const OTP_EXPIRY_SECONDS = 120;

export default function MfaModal({ mfaData, onClose, onSuccess }) {
  const { handleLoginSuccess } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(mfaData?.expiresInSeconds || OTP_EXPIRY_SECONDS);
  const [attemptsMade, setAttemptsMade] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [expired, setExpired] = useState(false);

  if (!mfaData) return null;

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) {
      setExpired(true);
      return;
    }
    const timer = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          setExpired(true);
          clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  // Resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const cd = setInterval(() => setResendCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(cd);
  }, [resendCooldown]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (expired) {
      setError('Verification code has expired. Please request a new one.');
      return;
    }
    if (attemptsMade >= MAX_ATTEMPTS) {
      setError('Maximum attempts reached. Please request a new OTP.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await authApi.verifyMfa({
        userId: mfaData.userId,
        sessionId: mfaData.sessionId,
        code,
        trustDevice
      });

      if (res.data.success) {
        handleLoginSuccess(res.data);
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        const newAttempts = attemptsMade + 1;
        setAttemptsMade(newAttempts);
        setError(res.data.message || 'Invalid code. Please try again.');
        setCode('');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Verification failed.';
      const code_err = err.response?.data?.code;
      const newAttempts = attemptsMade + 1;
      setAttemptsMade(newAttempts);
      setError(msg);
      setCode('');
      if (code_err === 'OTP_EXPIRED') setExpired(true);
      if (code_err === 'OTP_MAX_ATTEMPTS') setAttemptsMade(MAX_ATTEMPTS);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResendLoading(true);
    setError('');
    try {
      await authApi.resendOtp({ userId: mfaData.userId, sessionId: mfaData.sessionId });
      setSecondsLeft(OTP_EXPIRY_SECONDS);
      setExpired(false);
      setAttemptsMade(0);
      setCode('');
      setResendCooldown(30);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP.');
    } finally {
      setResendLoading(false);
    }
  };

  const remainingAttempts = MAX_ATTEMPTS - attemptsMade;
  const isMaxed = attemptsMade >= MAX_ATTEMPTS;
  const timerDanger = secondsLeft <= 30 && !expired;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 border border-blue-400/30 rounded-xl">
              <KeyRound className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Email Verification Required</h3>
              <p className="text-xs text-slate-300">Session Firewall — Step-Up Authentication</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Risk context banner */}
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 p-3 rounded-xl">
            <div className="text-xs text-amber-900">
              <p className="font-semibold">Medium Risk Activity Detected</p>
              <p className="text-[11px] text-amber-700">A new device or IP triggered step-up authentication.</p>
            </div>
            <RiskBadge score={mfaData.riskScore || 35} level="medium" />
          </div>

          {/* Email sent info — NO OTP CODE EVER DISPLAYED */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900">OTP sent to your registered email.</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Please check your inbox{mfaData.maskedEmail ? ` (${mfaData.maskedEmail})` : ''}.
              </p>
              <p className="text-[11px] text-blue-600 mt-1">
                ℹ️ Check your spam folder if you don't see it within 30 seconds.
              </p>
            </div>
          </div>

          {/* 2-minute countdown timer */}
          <div className={`flex items-center justify-between rounded-xl p-3 border ${
            expired
              ? 'bg-red-50 border-red-200'
              : timerDanger
                ? 'bg-orange-50 border-orange-200'
                : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <Clock className={`w-4 h-4 ${expired ? 'text-red-500' : timerDanger ? 'text-orange-500' : 'text-slate-500'}`} />
              <span className={`text-xs font-semibold ${expired ? 'text-red-700' : timerDanger ? 'text-orange-700' : 'text-slate-700'}`}>
                {expired ? 'Code Expired' : 'Code expires in'}
              </span>
            </div>
            <span className={`font-mono font-bold text-lg ${
              expired ? 'text-red-600' : timerDanger ? 'text-orange-600' : 'text-slate-800'
            }`}>
              {expired ? '00:00' : formatTime(secondsLeft)}
            </span>
          </div>

          {/* Attempts tracker */}
          {attemptsMade > 0 && (
            <div className={`flex items-center gap-2 text-xs rounded-lg p-2.5 border ${
              isMaxed ? 'bg-red-50 border-red-200 text-red-700' : 'bg-orange-50 border-orange-200 text-orange-700'
            }`}>
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                {isMaxed
                  ? 'Maximum attempts reached. Request a new OTP below.'
                  : `${remainingAttempts} attempt(s) remaining before code is invalidated.`}
              </span>
            </div>
          )}

          {/* OTP Input Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Enter 6-Digit Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                value={code}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val.length <= 6) setCode(val);
                }}
                placeholder="• • • • • •"
                maxLength={6}
                required
                disabled={isMaxed || expired}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono text-center text-2xl tracking-[0.6em] disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>

            {/* Trust device checkbox */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={trustDevice}
                onChange={(e) => setTrustDevice(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-700">
                <span className="font-semibold">Trust this device</span> — skip verification next time on this device
              </span>
            </label>

            {error && (
              <div className="flex items-start gap-2 text-xs text-red-700 font-medium bg-red-50 p-2.5 rounded-lg border border-red-200">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || code.length < 6 || isMaxed || expired}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold text-sm shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verifying...
                </span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Verify & Authorize Session
                </>
              )}
            </button>
          </form>

          {/* Resend OTP */}
          <div className="text-center border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || resendLoading}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold mx-auto disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${resendLoading ? 'animate-spin' : ''}`} />
              {resendLoading
                ? 'Sending new code...'
                : resendCooldown > 0
                  ? `Resend available in ${resendCooldown}s`
                  : 'Resend verification code'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
