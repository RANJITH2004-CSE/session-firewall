import React from 'react';
import { Shield, Fingerprint, Activity, AlertTriangle, ShieldAlert, CheckCircle2, Lock } from 'lucide-react';

export default function IntentMonitorWidget({
  integrity = 100,
  consistency = 96,
  riskScore = 2,
  action = 'ALLOW',
  reasons = []
}) {
  const getActionBadge = (act) => {
    switch (act) {
      case 'TERMINATE':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-red-600" /> FORCED TERMINATION
          </span>
        );
      case 'RESTRICT_ACCESS':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-amber-600" /> SENSITIVE OPS RESTRICTED
          </span>
        );
      case 'STEP_UP_REAUTH':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-blue-600" /> STEP-UP RE-AUTH REQUIRED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> SILENT CONTINUATION (ALLOW)
          </span>
        );
    }
  };

  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-600/10 rounded-xl text-blue-600">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Continuous Authentication Firewall Telemetry
            </h3>
            <p className="text-[11px] text-slate-500">
              Multi-signal dynamic fusion: Fingerprint Integrity + Behavioral Intent Consistency
            </p>
          </div>
        </div>

        <div>{getActionBadge(action)}</div>
      </div>

      {/* 3 Metric Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Fingerprint Integrity */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="flex items-center gap-1 font-semibold">
              <Fingerprint className="w-3.5 h-3.5 text-blue-600" /> Fingerprint Integrity
            </span>
            <span className="font-mono font-bold text-slate-800">{integrity}%</span>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              style={{ width: `${Math.min(100, integrity)}%` }}
              className={`h-full rounded-full transition-all ${
                integrity > 70 ? 'bg-blue-600' : integrity > 40 ? 'bg-amber-500' : 'bg-red-500'
              }`}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Device, OS, browser & canvas continuity</p>
        </div>

        {/* Behavioral Consistency */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="flex items-center gap-1 font-semibold">
              <Activity className="w-3.5 h-3.5 text-indigo-600" /> Intent Consistency
            </span>
            <span className="font-mono font-bold text-slate-800">{consistency}%</span>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              style={{ width: `${Math.min(100, consistency)}%` }}
              className={`h-full rounded-full transition-all ${
                consistency > 70 ? 'bg-indigo-600' : consistency > 40 ? 'bg-amber-500' : 'bg-red-500'
              }`}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Sequence flow, dwell timing & feature rate</p>
        </div>

        {/* Fused Risk Score */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="flex items-center gap-1 font-semibold">
              <Shield className="w-3.5 h-3.5 text-red-600" /> Fused Session Risk
            </span>
            <span className="font-mono font-bold text-slate-900">{riskScore} / 100</span>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              style={{ width: `${Math.min(100, riskScore)}%` }}
              className={`h-full rounded-full transition-all ${
                riskScore < 30 ? 'bg-emerald-500' : riskScore < 60 ? 'bg-blue-500' : riskScore < 75 ? 'bg-amber-500' : 'bg-red-600'
              }`}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Weighted fusion: 50% FP + 50% Intent</p>
        </div>
      </div>

      {/* Explanatory Reasons if elevated */}
      {reasons && reasons.length > 0 && (
        <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-0.5">
          <p className="font-bold text-[11px]">Firewall Anomaly Correlation Signals:</p>
          {reasons.map((r, i) => (
            <p key={i} className="text-[10px]">• {r}</p>
          ))}
        </div>
      )}
    </div>
  );
}
