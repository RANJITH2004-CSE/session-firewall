import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Lock, AlertTriangle, RefreshCw, FileText, Search, Filter } from 'lucide-react';
import api from '../services/api';

export default function AuditLogViewer() {
  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [appFilter, setAppFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit/logs', {
        params: {
          action: actionFilter,
          targetApplication: appFilter,
          limit: 50
        }
      });
      if (res.data?.success) {
        setLogs(res.data.logs || []);
        setTotalCount(res.data.totalCount || 0);
      }
    } catch (err) {
      console.warn('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, appFilter]);

  const getActionBadge = (act) => {
    switch (act) {
      case 'TERMINATE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">TERMINATE</span>;
      case 'RESTRICT_ACCESS':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">RESTRICT</span>;
      case 'STEP_UP_REAUTH':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300">STEP-UP</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">ALLOW</span>;
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" /> Continuous Firewall AuditLog Stream (FR9)
            </h3>
            <span className="text-xs text-slate-400 font-mono">({totalCount} Events Recorded)</span>
          </div>
          <p className="text-xs text-slate-500">
            Immutable audit record of risk score fluctuations, fingerprint samples & adaptive actions
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 bg-white"
          >
            <option value="ALL">All Actions</option>
            <option value="ALLOW">ALLOW (Silent)</option>
            <option value="STEP_UP_REAUTH">STEP_UP_REAUTH</option>
            <option value="RESTRICT_ACCESS">RESTRICT_ACCESS</option>
            <option value="TERMINATE">TERMINATE (Forced)</option>
          </select>

          {/* App Filter */}
          <select
            value={appFilter}
            onChange={(e) => setAppFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 bg-white"
          >
            <option value="ALL">All Target Apps</option>
            <option value="Enterprise Portal">Enterprise Portal</option>
            <option value="Cloud SaaS Workspace">Cloud SaaS Workspace</option>
            <option value="Banking FinTech">Banking FinTech</option>
          </select>

          <button
            onClick={fetchLogs}
            className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-600"
            title="Refresh Audit Logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">Time & Log ID</th>
              <th className="py-2.5 px-3">User & Target App</th>
              <th className="py-2.5 px-3">Scores (FP / Intent / Risk)</th>
              <th className="py-2.5 px-3">Adaptive Action</th>
              <th className="py-2.5 px-3">Reason & Trigger Factors</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-8 text-center text-slate-400">
                  No audit logs matching current criteria.
                </td>
              </tr>
            ) : (
              logs.map((lg) => (
                <tr key={lg._id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-900">
                      {new Date(lg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">{lg.logId}</div>
                  </td>

                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-800">{lg.userEmail || 'Anonymous'}</div>
                    <span className="inline-block mt-0.5 px-2 py-0.2 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                      {lg.targetApplication}
                    </span>
                  </td>

                  <td className="py-3 px-3 font-mono">
                    <div className="text-[11px]">
                      FP: <span className="font-bold text-blue-700">{lg.fingerprintIntegrityScore}%</span> │ 
                      Intent: <span className="font-bold text-indigo-700">{lg.behavioralConsistencyScore}%</span>
                    </div>
                    <div className="text-[11px] font-bold text-red-600">
                      Risk: {lg.riskScore} / 100
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    {getActionBadge(lg.action)}
                  </td>

                  <td className="py-3 px-3 max-w-sm">
                    <p className="text-[11px] text-slate-700 leading-snug">{lg.reason}</p>
                    {lg.requestEndpoint && (
                      <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                        {lg.requestMethod} {lg.requestEndpoint}
                      </p>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
