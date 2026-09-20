import React, { useState } from 'react';
import { Shield, Lock, Mail, ArrowRight, Smartphone, Globe, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import MfaModal from '../components/MfaModal';

export default function Login() {
  const { handleLoginSuccess } = useAuth();
  const [email, setEmail] = useState('customer@securebank.com');
  const [password, setPassword] = useState('Password123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [blockedAlert, setBlockedAlert] = useState(null);

  // Simulated telemetry test controls
  const [showAdvancedTelemetry, setShowAdvancedTelemetry] = useState(false);
  const [simDevice, setSimDevice] = useState('');
  const [simIp, setSimIp] = useState('');
  const [simCity, setSimCity] = useState('');
  const [simCountry, setSimCountry] = useState('');
  const [simIsVpn, setSimIsVpn] = useState(false);

  // Medium-risk MFA challenge state
  const [mfaData, setMfaData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBlockedAlert(null);
    setLoading(true);

    try {
      const payload = {
        email,
        password,
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
          // Medium risk step-up MFA
          setMfaData(res.data);
        } else {
          handleLoginSuccess(res.data);
        }
      }
    } catch (err) {
      const resp = err.response?.data;
      if (resp?.code === 'HIGH_RISK_BLOCKED' || resp?.code === 'ACCESS_QUARANTINED') {
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
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {mfaData && (
        <MfaModal
          mfaData={mfaData}
          onClose={() => setMfaData(null)}
          onSuccess={() => setMfaData(null)}
        />
      )}

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center p-3 bg-slate-900 rounded-2xl shadow-xl shadow-blue-900/10 mb-4">
          <Shield className="w-8 h-8 text-blue-500" />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900">
          SECUREBANK ONLINE
        </h2>
        <p className="mt-1 text-xs text-slate-500 font-medium">
          Protected by Real-Time Session Firewall & Behavioral Risk Scoring
        </p>
      </div>

      {/* Login Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-xl rounded-3xl border border-slate-200/80">
          {/* Persona Quick Select */}
          <div className="mb-6 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-2">
              Select Demo Persona
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

          {/* Blocked Alert Banner if Session Firewall blocked the session */}
          {blockedAlert && (
            <div className="mb-5 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 space-y-2 animate-fade-in">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-red-900">
                    Session Blocked By Firewall
                  </h4>
                  <p className="text-xs text-red-700 mt-1">
                    {blockedAlert.message}
                  </p>
                </div>
              </div>

              {blockedAlert.riskReasons && (
                <div className="bg-white/80 p-2.5 rounded-xl border border-red-200 text-[11px] space-y-1">
                  <p className="font-semibold text-red-950">Identified Risk Factors:</p>
                  {blockedAlert.riskReasons.map((r, i) => (
                    <p key={i} className="text-red-700">• {r}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
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
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            {/* Advanced Telemetry Injection (for custom test scenarios) */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvancedTelemetry(!showAdvancedTelemetry)}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {showAdvancedTelemetry ? 'Hide Custom Telemetry Tester' : 'Custom Telemetry Tester (Test Attack)'}
              </button>

              {showAdvancedTelemetry && (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs animate-fade-in">
                  <p className="text-[11px] text-slate-500 font-medium">
                    Override request metadata to test how Session Firewall scores foreign or suspicious logins:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Device (e.g. Firefox on Mac)"
                      value={simDevice}
                      onChange={(e) => setSimDevice(e.target.value)}
                      className="p-1.5 border rounded-lg text-xs"
                    />
                    <input
                      type="text"
                      placeholder="IP (e.g. 198.51.100.42)"
                      value={simIp}
                      onChange={(e) => setSimIp(e.target.value)}
                      className="p-1.5 border rounded-lg text-xs"
                    />
                    <input
                      type="text"
                      placeholder="City (e.g. New York)"
                      value={simCity}
                      onChange={(e) => setSimCity(e.target.value)}
                      className="p-1.5 border rounded-lg text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Country (e.g. United States)"
                      value={simCountry}
                      onChange={(e) => setSimCountry(e.target.value)}
                      className="p-1.5 border rounded-lg text-xs"
                    />
                  </div>
                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simIsVpn}
                      onChange={(e) => setSimIsVpn(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span className="text-slate-700">Flag as VPN/Proxy (+15 pts)</span>
                  </label>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {loading ? 'Evaluating Session Telemetry...' : 'Authenticate & Enter'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
