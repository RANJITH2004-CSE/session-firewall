import React, { useState, useEffect } from 'react';
import { Cloud, Database, Trash2, CheckCircle2, Lock, FolderKanban, ShieldCheck } from 'lucide-react';
import api from '../services/api';

export default function SaasWorkspaceView({ onActionCompleted }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchProjects = async () => {
    try {
      const res = await api.get('/gateway/saas/projects');
      if (res.data?.success) {
        setProjects(res.data.projects || []);
      }
    } catch (err) {
      console.warn('Failed to load SaaS projects:', err);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleExportDb = async () => {
    setLoading(true);
    setStatusMsg('');
    setErrorMsg('');
    try {
      const res = await api.post('/gateway/saas/export-database');
      setStatusMsg(res.data?.message || 'Database export archive generated.');
      if (onActionCompleted) onActionCompleted();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Database export blocked by Session Firewall.');
      if (onActionCompleted) onActionCompleted();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    setLoading(true);
    setStatusMsg('');
    setErrorMsg('');
    try {
      const res = await api.post('/gateway/saas/delete-workspace');
      setStatusMsg(res.data?.message || 'Workspace deleted.');
      if (onActionCompleted) onActionCompleted();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Destructive workspace deletion blocked by Session Firewall.');
      if (onActionCompleted) onActionCompleted();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-5 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Cloud SaaS Data Workspace
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
              MULTI-TENANT GATEWAY
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Cloud engineering environment guarded against token replay and rogue tenant exfiltration
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportDb}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all disabled:opacity-50"
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export Database Dump</span>
          </button>

          <button
            onClick={handleDeleteWorkspace}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-all disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Workspace</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-medium text-emerald-800 flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5 animate-fade-in">
          <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Operation Blocked by Continuous Adaptive Response:</p>
            <p className="mt-0.5 text-amber-800">{errorMsg}</p>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Active Engineering Projects & Workspaces
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {projects.map((p) => (
            <div key={p.id} className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-slate-400">{p.id}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {p.status}
                </span>
              </div>
              <h4 className="font-bold text-slate-900">{p.name}</h4>
              <p className="text-[11px] text-slate-500">{p.members} active engineers assigned</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
