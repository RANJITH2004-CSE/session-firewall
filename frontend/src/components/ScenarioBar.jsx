import React, { useState } from 'react';
import { Play, ShieldCheck, ShieldAlert, RotateCcw, Check, Sparkles } from 'lucide-react';
import { demoApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSecurity } from '../context/SecurityContext';

export default function ScenarioBar({ onScenarioExecuted }) {
  const { refreshUser } = useAuth();
  const { fetchNotifications, setBannerAlert } = useSecurity();
  const [running, setRunning] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');

  const handleScenarioSafe = async () => {
    setRunning('safe');
    setStatusMsg('Running Scenario 1: Safe Login...');
    try {
      const res = await demoApi.runScenarioSafeLogin();
      if (res.data.success) {
        setStatusMsg('Scenario 1 Passed: Low risk login allowed in Mumbai.');
        await refreshUser();
        await fetchNotifications();
        if (onScenarioExecuted) onScenarioExecuted();
      }
    } catch (err) {
      setStatusMsg('Safe scenario error: ' + (err.response?.data?.message || err.message));
    } finally {
      setRunning(null);
    }
  };

  const handleScenarioSuspicious = async () => {
    setRunning('suspicious');
    setStatusMsg('Running Scenario 2: Suspicious Login (Impossible Travel)...');
    try {
      const res = await demoApi.runScenarioSuspiciousLogin();
      if (res.data.success) {
        setStatusMsg('Scenario 2 Triggered: High risk login from New York blocked! Notification dispatched.');
        await refreshUser();
        await fetchNotifications();
        if (onScenarioExecuted) onScenarioExecuted();
      }
    } catch (err) {
      setStatusMsg('Suspicious scenario triggered: ' + (err.response?.data?.message || err.message));
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
      setStatusMsg('Demo environment reset to initial state.');
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
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        {/* Title */}
        <div className="flex items-center gap-2 font-semibold text-slate-200">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span>Demo Simulation Suite:</span>
          {statusMsg && (
            <span className="text-amber-400 font-normal bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
              {statusMsg}
            </span>
          )}
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Scenario 1 */}
          <button
            onClick={handleScenarioSafe}
            disabled={running !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg font-medium transition-all hover:border-emerald-400 disabled:opacity-50"
            title="Safe login: Known device in usual location (Mumbai, India)"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Scenario 1: Safe Login</span>
          </button>

          {/* Scenario 2 */}
          <button
            onClick={handleScenarioSuspicious}
            disabled={running !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded-lg font-medium transition-all hover:border-red-400 disabled:opacity-50"
            title="Suspicious login: Impossible travel to New York in 10 mins"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <span>Scenario 2: Suspicious Login</span>
          </button>

          {/* Reset */}
          <button
            onClick={handleReset}
            disabled={running !== null}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg font-medium transition-all disabled:opacity-50"
            title="Reset database seed"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${running === 'reset' ? 'animate-spin' : ''}`} />
            <span>Reset Demo</span>
          </button>
        </div>
      </div>
    </div>
  );
}
