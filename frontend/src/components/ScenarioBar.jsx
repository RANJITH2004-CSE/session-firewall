import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, RotateCcw, AlertOctagon, Wifi, Sparkles, Sliders } from 'lucide-react';
import { demoApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSecurity } from '../context/SecurityContext';

export default function ScenarioBar({ onScenarioExecuted, onOpenThresholds }) {
  const { refreshUser } = useAuth();
  const { fetchNotifications } = useSecurity();
  const [running, setRunning] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');

  const executeScenario = async (key, name, apiCall) => {
    setRunning(key);
    setStatusMsg(`Executing ${name}...`);
    try {
      const res = await apiCall();
      if (res.data.success) {
        setStatusMsg(`${name} Finished: Action -> ${res.data.scores?.action || 'Processed'}`);
        await refreshUser();
        await fetchNotifications();
        if (onScenarioExecuted) onScenarioExecuted(res.data);
      }
    } catch (err) {
      setStatusMsg(`${name} Error: ` + (err.response?.data?.message || err.message));
      await refreshUser();
      await fetchNotifications();
      if (onScenarioExecuted) onScenarioExecuted();
    } finally {
      setRunning(null);
    }
  };

  const handleReset = async () => {
    setRunning('reset');
    setStatusMsg('Resetting demo environment...');
    try {
      await demoApi.resetDemoData();
      setStatusMsg('Demo environment reset to clean baseline state.');
      await refreshUser();
      await fetchNotifications();
      if (onScenarioExecuted) onScenarioExecuted();
    } catch (err) {
      setStatusMsg('Reset failed: ' + err.message);
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="bg-slate-900 text-white border-b border-slate-800 px-4 py-2.5 shadow-md">
      <div className="max-w-7xl mx-auto flex flex-col xl:flex-row items-center justify-between gap-3 text-xs">
        {/* Title */}
        <div className="flex items-center gap-2 font-semibold text-slate-200">
          <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span>SWE3004 Continuous Firewall Evaluation Suite:</span>
          {statusMsg && (
            <span className="text-amber-400 font-normal bg-amber-950/60 px-2.5 py-0.5 rounded-md border border-amber-800/40 truncate max-w-xs">
              {statusMsg}
            </span>
          )}
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Scenario 1: Normal User Session */}
          <button
            onClick={() => executeScenario('s1', 'Scenario 1: Normal Session', demoApi.runScenarioSafeLogin)}
            disabled={running !== null}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg font-medium transition-all disabled:opacity-50"
            title="Normal User Session: 100% FP integrity + 96% intent consistency -> ALLOW"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>S1: Normal Session</span>
          </button>

          {/* Scenario 2: Session Hijack / Cookie Theft */}
          <button
            onClick={() => executeScenario('s2', 'Scenario 2: Session Hijacking', demoApi.runScenarioSuspiciousLogin)}
            disabled={running !== null}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded-lg font-medium transition-all disabled:opacity-50"
            title="Session Hijacking / Cookie Theft: Stolen token from foreign IP & browser -> TERMINATE"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <span>S2: Session Hijack</span>
          </button>

          {/* Scenario 3: Synthetic Insider Misuse */}
          <button
            onClick={() => executeScenario('s3', 'Scenario 3: Insider Misuse', demoApi.runScenarioInsiderMisuse)}
            disabled={running !== null}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-lg font-medium transition-all disabled:opacity-50"
            title="Synthetic Insider Misuse: Legitimate device, but anomalous bulk export & sequence jump -> RESTRICT_ACCESS"
          >
            <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
            <span>S3: Insider Misuse</span>
          </button>

          {/* Scenario 4: Benign Mobile Roaming */}
          <button
            onClick={() => executeScenario('s4', 'Scenario 4: Benign Roaming', demoApi.runScenarioNetworkRoaming)}
            disabled={running !== null}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg font-medium transition-all disabled:opacity-50"
            title="Benign Mobile Roaming: IP changed, but device and intent match profile -> ALLOW without false positive block"
          >
            <Wifi className="w-3.5 h-3.5 text-blue-400" />
            <span>S4: Benign Roaming</span>
          </button>

          {/* Threshold Configurator */}
          {onOpenThresholds && (
            <button
              onClick={onOpenThresholds}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg font-medium transition-all"
              title="Configure Risk Thresholds (FR10)"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span>Thresholds (FR10)</span>
            </button>
          )}

          {/* Reset */}
          <button
            onClick={handleReset}
            disabled={running !== null}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg font-medium transition-all disabled:opacity-50"
            title="Reset to clean baseline database seed"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${running === 'reset' ? 'animate-spin' : ''}`} />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}
