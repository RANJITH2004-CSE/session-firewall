import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Shield, Lock, Mail, ArrowRight, ShieldAlert, Sparkles, AlertTriangle } from 'lucide-react';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import MfaModal from '../components/MfaModal';

/**
 * Collects passive biometric telemetry (mouse movement, typing dynamics)
 * for behavioral intent analysis. Data is included in the login payload.
 */
function useBiometricCollector() {
  const mouseMovesRef = useRef([]);
  const keystrokesRef = useRef([]);
  const lastKeyDownRef = useRef({});

  useEffect(() => {
    const handleMouseMove = (e) => {
      mouseMovesRef.current.push({ x: e.clientX, y: e.clientY, t: Date.now() });
      if (mouseMovesRef.current.length > 60) mouseMovesRef.current.shift();
    };
    const handleKeyDown = (e) => {
      lastKeyDownRef.current[e.code] = Date.now();
    };
    const handleKeyUp = (e) => {
      const downTime = lastKeyDownRef.current[e.code];
      if (downTime) {
        const dwell = Date.now() - downTime;
        keystrokesRef.current.push(dwell);
        if (keystrokesRef.current.length > 50) keystrokesRef.current.shift();
        delete lastKeyDownRef.current[e.code];
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const getBiometrics = useCallback(() => {
    const moves = mouseMovesRef.current;
    let avgSpeed = 0;
    let jitterScore = 0;
    if (moves.length > 2) {
      let totalDist = 0;
      let totalTime = 0;
      let jitterSum = 0;
      for (let i = 1; i < moves.length; i++) {
        const dx = moves[i].x - moves[i - 1].x;
        const dy = moves[i].y - moves[i - 1].y;
        const dt = moves[i].t - moves[i - 1].t;
        const dist = Math.sqrt(dx * dx + dy * dy);
        totalDist += dist;
        totalTime += dt;
        jitterSum += Math.abs(dist - (totalDist / i));
      }
      avgSpeed = totalTime > 0 ? totalDist / totalTime : 0;
      jitterScore = moves.length > 0 ? jitterSum / moves.length : 0;
    }

    const dwells = keystrokesRef.current;
    const avgDwellMs = dwells.length > 0 ? Math.round(dwells.reduce((a, b) => a + b, 0) / dwells.length) : 0;
    // Calculate flight time: time between key releases (approximation from sequential dwells)
    let avgFlightMs = 0;
    if (dwells.length > 1) {
      let flightSum = 0;
      for (let i = 1; i < dwells.length; i++) {
        flightSum += Math.abs(dwells[i] - dwells[i - 1]);
      }
      avgFlightMs = Math.round(flightSum / (dwells.length - 1));
    }

    return {
      mouseDynamics: {
        movesCount: moves.length,
        avgSpeed: Math.round(avgSpeed * 100) / 100,
        jitterScore: Math.round(jitterScore),
        isHeadless: moves.length === 0
      },
      typingDynamics: {
        keystrokesCount: dwells.length,
        avgDwellMs,
        avgFlightMs
      }
    };
  }, []);

  return { getBiometrics };
}

export default function Login() {
  const { handleLoginSuccess } = useAuth();
  const { getBiometrics } = useBiometricCollector();

  const [email, setEmail] = useState('customer@securebank.com');
  const [password, setPassword] = useState('Password123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [blockedAlert, setBlockedAlert] = useState(null);
  const [restrictedAlert, setRestrictedAlert] = useState(null);
  const [mfaData, setMfaData] = useState(null);

  // Advanced telemetry override for testing
  const [showAdvancedTelemetry, setShowAdvancedTelemetry] = useState(false);
  const [simDevice, setSimDevice] = useState('');
  const [simIp, setSimIp] = useState('');
  const [simCity, setSimCity] = useState('');
  const [simCountry, setSimCountry] = useState('');
  const [simIsVpn, setSimIsVpn] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBlockedAlert(null);
    setRestrictedAlert(null);
    setLoading(true);

    try {
      const biometrics = getBiometrics();

      const payload = {
        email,
        password,
        biometrics,
        simulated: (simDevice || simIp || simCity || simIsVpn) ? {
          device: simDevice || undefined,
          ipAddress: simIp || undefined,
          location: simCity ? { city: simCity, country: simCountry || 'Unknown' } : undefined,
          isVpn: simIsVpn
        } : undefined
      };

      const res = await authApi.login(payload);

      if (res.data.success) {
        if (res.data.mfaRequired) {
          setMfaData(res.data);
        } else if (res.data.restricted) {
          // HIGH risk: restricted session
          setRestrictedAlert(res.data);
          handleLoginSuccess(res.data);
        } else {
          handleLoginSuccess(res.data);
        }
      }
    } catch (err) {
      const resp = err.response?.data;
      if (resp?.code === 'CRITICAL_RISK_TERMINATED' || resp?.code === 'HIGH_RISK_BLOCKED' || resp?.code === 'ACCESS_QUARANTINED') {
        setBlockedAlert(resp);
      } else {
        setError(resp?.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPersona = (role) => {
    if (role === 'customer') {
      setEmail('customer@securebank.com');
      setPassword('Password123!');
    } else {
      setEmail('admin@securebank.com');
      setPassword('AdminSecure123!');
    }
    setError('');
    setBlockedAlert(null);
    setRestrictedAlert(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {mfaData && (
        <MfaModal
          mfaData={mfaData}
          onClose={() => setMfaData(null)}
          onSuccess={() => setMfaData(null)}
        />
      )}

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center p-4 bg-blue-600/20 border border-blue-500/30 rounded-2xl shadow-xl shadow-blue-900/20 mb-5">
          <Shield className="w-9 h-9 text-blue-400" />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-white">
          SESSION FIREWALL
        </h2>
        <p className="mt-1.5 text-sm text-blue-300 font-medium">
          Intent-Aware Continuous Authentication Gateway
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Powered by Dynamic Session Fingerprinting + Behavioral Risk Engine
        </p>
      </div>

      {/* Login Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-200/80">
          
          {/* Persona Quick Select */}
          <div className="mb-6 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-2">
              Quick Demo Login
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectPersona('customer')}
                className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all text-left ${
                  email === 'customer@securebank.com'
                    ? 'bg-blue-50 text-blue-700 border-blue-300 ring-1 ring-blue-400'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="block font-bold">Alex Mercer</span>
                <span className="text-[10px] text-slate-500">Retail Customer</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPersona('admin')}
                className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all text-left ${
                  email === 'admin@securebank.com'
                    ? 'bg-blue-50 text-blue-700 border-blue-300 ring-1 ring-blue-400'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="block font-bold">Sarah Connor</span>
                <span className="text-[10px] text-slate-500">Security Admin (SOC)</span>
              </button>
            </div>
          </div>

          {/* Risk Tier Legend */}
          <div className="mb-4 grid grid-cols-4 gap-1 text-[10px] text-center font-semibold">
            <div className="bg-emerald-50 text-emerald-700 rounded-lg py-1 px-0.5 border border-emerald-200">
              LOW<br /><span className="font-normal opacity-70">Allow</span>
            </div>
            <div className="bg-amber-50 text-amber-700 rounded-lg py-1 px-0.5 border border-amber-200">
              MEDIUM<br /><span className="font-normal opacity-70">OTP</span>
            </div>
            <div className="bg-orange-50 text-orange-700 rounded-lg py-1 px-0.5 border border-orange-200">
              HIGH<br /><span className="font-normal opacity-70">Restrict</span>
            </div>
            <div className="bg-red-50 text-red-700 rounded-lg py-1 px-0.5 border border-red-200">
              CRITICAL<br /><span className="font-normal opacity-70">Terminate</span>
            </div>
          </div>

          {/* Blocked / Terminated Alert */}
          {blockedAlert && (
            <div className="mb-5 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 space-y-2">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-red-900">
                    Session {blockedAlert.code === 'CRITICAL_RISK_TERMINATED' ? 'Terminated' : 'Blocked'} by Firewall
                  </h4>
                  <p className="text-xs text-red-700 mt-1">{blockedAlert.message}</p>
                </div>
              </div>
              {blockedAlert.riskReasons && (
                <div className="bg-white/80 p-2.5 rounded-xl border border-red-200 text-[11px] space-y-1">
                  <p className="font-semibold text-red-950">Risk Factors Detected:</p>
                  {blockedAlert.riskReasons.map((r, i) => (
                    <p key={i} className="text-red-700">• {r}</p>
                  ))}
                </div>
              )}
              <div className="text-[11px] text-red-700 font-medium">
                Risk Score: <span className="font-bold">{blockedAlert.riskScore}/100</span> ({blockedAlert.riskLevel?.toUpperCase()})
              </div>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-700 font-medium">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Custom Telemetry Tester */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvancedTelemetry(!showAdvancedTelemetry)}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {showAdvancedTelemetry ? 'Hide Telemetry Tester' : 'Attack Scenario Tester (Override Telemetry)'}
              </button>

              {showAdvancedTelemetry && (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <p className="text-[11px] text-slate-500 font-medium">
                    Simulate foreign device / suspicious IP to test firewall risk scoring:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Device (e.g. Firefox on Mac)" value={simDevice}
                      onChange={(e) => setSimDevice(e.target.value)} className="p-1.5 border rounded-lg text-xs bg-white" />
                    <input type="text" placeholder="IP (e.g. 198.51.100.42)" value={simIp}
                      onChange={(e) => setSimIp(e.target.value)} className="p-1.5 border rounded-lg text-xs bg-white" />
                    <input type="text" placeholder="City (e.g. New York)" value={simCity}
                      onChange={(e) => setSimCity(e.target.value)} className="p-1.5 border rounded-lg text-xs bg-white" />
                    <input type="text" placeholder="Country (e.g. United States)" value={simCountry}
                      onChange={(e) => setSimCountry(e.target.value)} className="p-1.5 border rounded-lg text-xs bg-white" />
                  </div>
                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input type="checkbox" checked={simIsVpn} onChange={(e) => setSimIsVpn(e.target.checked)}
                      className="rounded text-blue-600" />
                    <span className="text-slate-700">Flag as VPN/Proxy (+15 risk pts)</span>
                  </label>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Evaluating Session Telemetry...
                </span>
              ) : (
                <>
                  Authenticate & Enter
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
