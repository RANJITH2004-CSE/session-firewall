import React, { useState, useEffect } from 'react';
import { Users, FileSpreadsheet, ShieldAlert, ShieldCheck, Download, KeyRound, CheckCircle2, Lock } from 'lucide-react';
import api from '../services/api';

export default function EnterprisePortalView({ restricted = false, onActionCompleted }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchOverview = async () => {
    try {
      const res = await api.get('/gateway/enterprise/overview');
      if (res.data?.success) {
        setEmployees(res.data.employees || []);
      }
    } catch (err) {
      console.warn('Failed to load enterprise records:', err);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleBulkExport = async () => {
    setLoading(true);
    setStatusMsg('');
    setErrorMsg('');
    try {
      const res = await api.post('/gateway/enterprise/bulk-export');
      setStatusMsg(res.data?.message || 'Bulk export completed successfully.');
      if (onActionCompleted) onActionCompleted();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Bulk export blocked by Session Firewall.');
      if (onActionCompleted) onActionCompleted();
    } finally {
      setLoading(false);
    }
  };

  const handleRoleEscalation = async () => {
    setLoading(true);
    setStatusMsg('');
    setErrorMsg('');
    try {
      const res = await api.post('/gateway/enterprise/role-escalation', {
        targetRole: 'SuperAdmin',
        reason: 'Authorized Systems Audit'
      });
      setStatusMsg(res.data?.message || 'Role escalated.');
      if (onActionCompleted) onActionCompleted();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Role escalation blocked by Session Firewall.');
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
              Enterprise HR & Global Administration Portal
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              PROTECTED ENDPOINT
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Internal administrative service protected by Session Firewall Intent-Aware Gateway
          </p>
        </div>

        {/* Sensitive Action Triggers */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleBulkExport}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Bulk Export Payroll</span>
          </button>

          <button
            onClick={handleRoleEscalation}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all disabled:opacity-50"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Elevate Privileges</span>
          </button>
        </div>
      </div>

      {/* Status Banners */}
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

      {/* Employee Records Table */}
      <div>
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Confidential Personnel Directory (Read Access Permitted)
        </h3>
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
          {employees.map((emp) => (
            <div key={emp.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors text-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs">
                  {emp.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{emp.name}</h4>
                  <p className="text-[11px] text-slate-500">{emp.title} • {emp.department}</p>
                </div>
              </div>
              <span className="font-mono text-slate-400 text-[11px]">{emp.id}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
