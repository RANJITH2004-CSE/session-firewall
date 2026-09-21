import React, { useState, useEffect } from 'react';
import { Sliders, X, CheckCircle2, Shield } from 'lucide-react';
import api from '../services/api';

export default function ThresholdConfigModal({ isOpen, onClose, onUpdated }) {
  const [thresholds, setThresholds] = useState({
    LOW_MAX: 29,
    MEDIUM_MAX: 59,
    ELEVATED_MAX: 74,
    HIGH_MIN: 75
  });
  const [loading, setLoading] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      api.get('/audit/thresholds').then((res) => {
        if (res.data?.thresholds) {
          setThresholds(res.data.thresholds);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSavedMsg('');
    try {
      const res = await api.post('/audit/thresholds', { thresholds });
      if (res.data?.success) {
        setSavedMsg('Risk thresholds successfully updated.');
        if (onUpdated) onUpdated(res.data.thresholds);
        setTimeout(() => {
          setSavedMsg('');
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error('Failed to update thresholds:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 rounded-xl border border-blue-500/30">
              <Sliders className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-bold">Continuous Firewall Threshold Configurator (FR10)</h3>
              <p className="text-xs text-slate-400">Configure decision boundaries for graduated adaptive actions</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {savedMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{savedMsg}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Low Risk Max Boundary (Silent Allow): 0 to {thresholds.LOW_MAX} pts
            </label>
            <input
              type="range"
              min="10"
              max="40"
              value={thresholds.LOW_MAX}
              onChange={(e) => setThresholds({ ...thresholds, LOW_MAX: Number(e.target.value) })}
              className="w-full accent-emerald-600"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Medium Risk Max Boundary (Step-Up Re-Auth): {thresholds.LOW_MAX + 1} to {thresholds.MEDIUM_MAX} pts
            </label>
            <input
              type="range"
              min="41"
              max="65"
              value={thresholds.MEDIUM_MAX}
              onChange={(e) => setThresholds({ ...thresholds, MEDIUM_MAX: Number(e.target.value) })}
              className="w-full accent-blue-600"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Elevated Risk Max Boundary (Restrict Sensitive Operations): {thresholds.MEDIUM_MAX + 1} to {thresholds.ELEVATED_MAX} pts
            </label>
            <input
              type="range"
              min="66"
              max="85"
              value={thresholds.ELEVATED_MAX}
              onChange={(e) => setThresholds({ ...thresholds, ELEVATED_MAX: Number(e.target.value) })}
              className="w-full accent-amber-600"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              High Risk Boundary (Forced Session Termination): &ge; {thresholds.HIGH_MIN} pts
            </label>
            <input
              type="range"
              min="70"
              max="95"
              value={thresholds.HIGH_MIN}
              onChange={(e) => setThresholds({ ...thresholds, HIGH_MIN: Number(e.target.value) })}
              className="w-full accent-red-600"
            />
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
            <p className="font-bold text-slate-700">Theoretical Fusion Parameters (Section 7.5):</p>
            <p className="text-slate-500">• Fingerprint Integrity Weight: <span className="font-mono font-bold text-blue-700">W_f = 0.50</span></p>
            <p className="text-slate-500">• Behavioral Intent Consistency Weight: <span className="font-mono font-bold text-indigo-700">W_b = 0.50</span></p>
            <p className="text-slate-500">• Dynamic Sampling Frequency: <span className="font-mono font-bold text-slate-800">12 Seconds</span></p>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-sm"
            >
              {loading ? 'Updating...' : 'Save Policy Thresholds'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
