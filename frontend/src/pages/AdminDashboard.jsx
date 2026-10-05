import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  ShieldX, 
  Search, 
  Filter, 
  RefreshCw, 
  Ban, 
  CheckCircle, 
  AlertTriangle, 
  Unlock, 
  Lock, 
  Globe, 
  Laptop, 
  Smartphone, 
  UserCheck,
  ChevronDown,
  Sliders,
  Bell,
  Zap,
  MonitorX,
  KeyRound,
  TrendingUp,
  OctagonX,
  XCircle
} from 'lucide-react';
import { adminApi } from '../services/api';
import RiskBadge from '../components/RiskBadge';
import ThreatChart from '../components/ThreatChart';
import AuditLogViewer from '../components/AuditLogViewer';
import ThresholdConfigModal from '../components/ThresholdConfigModal';

export default function AdminDashboard() {
  const [sessions, setSessions] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [blocklist, setBlocklist] = useState([]);
  const [securityAlerts, setSecurityAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [alertTypeFilter, setAlertTypeFilter] = useState('ALL');
  const [actionFeedback, setActionFeedback] = useState('');

  // Active Tab within Admin
  const [activeAdminView, setActiveAdminView] = useState('sessions'); // 'sessions' | 'alerts' | 'audit' | 'blocklist'

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sessRes, metRes, blockRes, alertsRes] = await Promise.all([
        adminApi.getSessions({
          status: statusFilter,
          riskLevel: riskFilter,
          search: searchTerm
        }),
        adminApi.getMetrics(),
        adminApi.getBlocklist(),
        adminApi.getAlerts({ alertType: alertTypeFilter !== 'ALL' ? alertTypeFilter : undefined }).catch(() => ({ data: { alerts: [] } }))
      ]);

      if (sessRes.data.success) {
        setSessions(sessRes.data.sessions);
      }
      if (metRes.data.success) {
        setMetrics(metRes.data.metrics);
        setChartData(metRes.data.chartData);
      }
      if (blockRes.data.success) {
        setBlocklist(blockRes.data.blocklist);
      }
      if (alertsRes.data.alerts) {
        setSecurityAlerts(alertsRes.data.alerts);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, riskFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  const handleToggleBlock = async (type, value, currentActive) => {
    try {
      const res = await adminApi.toggleBlocklist({
        type,
        value,
        active: !currentActive
      });
      if (res.data.success) {
        setActionFeedback(res.data.message);
        setTimeout(() => setActionFeedback(''), 4000);
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to toggle blocklist item:', err);
    }
  };

  const handleUpdateStatus = async (sessionId, newStatus) => {
    try {
      const res = await adminApi.updateSessionStatus(sessionId, { status: newStatus });
      if (res.data.success) {
        setActionFeedback(`Session ${sessionId} updated to ${newStatus}`);
        setTimeout(() => setActionFeedback(''), 4000);
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to update session status:', err);
    }
  };

  const handleToggleTransfers = async (userId, currentLocked) => {
    try {
      const res = await adminApi.toggleUserTransfers(userId, { lock: !currentLocked });
      if (res.data.success) {
        setActionFeedback(res.data.message);
        setTimeout(() => setActionFeedback(''), 4000);
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to toggle user transfers:', err);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">
              Security Operations Center (SOC)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              Enterprise Session Firewall
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time threat monitoring, automated behavioral risk grading, and quarantine management.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition-colors shadow-xs self-start md:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Evaluated Sessions</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{metrics?.totalSessions || 0}</p>
          <p className="text-[11px] text-slate-400 mt-1">Monitored across bank accounts</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-amber-700 uppercase tracking-wider">Suspicious / MFA Flagged</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{metrics?.activeThreats || 0}</p>
          <p className="text-[11px] text-amber-700 mt-1">Medium & High Risk Scores</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-red-700 uppercase tracking-wider">Blocked / Confirmed Fraud</p>
          <p className="text-2xl font-black text-red-600 mt-1">
            {(metrics?.blockedSessions || 0) + (metrics?.confirmedFraud || 0)}
          </p>
          <p className="text-[11px] text-red-600 mt-1">{metrics?.confirmedFraud || 0} user-reported breaches</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Quarantined IPs & Devices</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{metrics?.activeBlocklistCount || 0}</p>
          <p className="text-[11px] text-slate-400 mt-1">{metrics?.lockedUsersCount || 0} customer transfers restricted</p>
        </div>
      </div>

      {/* Threat Chart */}
      <ThreatChart data={chartData} />

      {/* Subnavigation between Sessions & Blocklist */}
      {/* Subnavigation between Sessions, AuditLogs, and Blocklist */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveAdminView('sessions')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
              activeAdminView === 'sessions'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Continuous Sessions & Telemetry
          </button>

          <button
            onClick={() => setActiveAdminView('alerts')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
              activeAdminView === 'alerts'
                ? 'bg-red-700 text-white'
                : 'text-red-600 hover:bg-red-50 border border-red-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Security Alerts ({securityAlerts.length})</span>
          </button>

          <button
            onClick={() => setActiveAdminView('audit')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
              activeAdminView === 'audit'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>AuditLog Stream (FR9)</span>
          </button>

          <button
            onClick={() => setActiveAdminView('blocklist')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
              activeAdminView === 'blocklist'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Quarantine Blocklist ({blocklist.length})</span>
          </button>
        </div>

        <button
          onClick={() => setIsThresholdModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold transition-all shadow-xs"
        >
          <Sliders className="w-3.5 h-3.5 text-blue-600" />
          <span>Policy Thresholds (FR10)</span>
        </button>
      </div>

      {/* Security Alerts View */}
      {activeAdminView === 'alerts' && (
        <div className="space-y-4">
          {/* Alert Category Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: 'ALL', label: 'All Alerts', icon: Bell, color: 'slate' },
              { key: 'NEW_DEVICE', label: 'New Device', icon: MonitorX, color: 'blue' },
              { key: 'CREDENTIAL_MISUSE', label: 'Credential Misuse', icon: KeyRound, color: 'orange' },
              { key: 'RISK_INCREASE', label: 'Risk Increase', icon: TrendingUp, color: 'amber' },
              { key: 'RESTRICTED_OPERATION', label: 'Restricted Op', icon: OctagonX, color: 'red' },
              { key: 'SESSION_TERMINATION', label: 'Session Terminated', icon: XCircle, color: 'rose' },
            ].map(({ key, label, icon: Icon, color }) => (
              <button
                key={key}
                onClick={() => {
                  setAlertTypeFilter(key);
                  fetchData();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  alertTypeFilter === key
                    ? `bg-${color}-700 text-white border-${color}-700`
                    : `text-${color}-700 border-${color}-200 hover:bg-${color}-50 bg-white`
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {securityAlerts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
              <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p className="font-semibold">No security alerts</p>
              <p className="text-xs text-slate-400 mt-1">The firewall has not triggered any alerts for this filter.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {securityAlerts.map((alert) => {
                const alertMeta = {
                  NEW_DEVICE: { icon: MonitorX, color: 'blue', label: 'New Device Detected' },
                  CREDENTIAL_MISUSE: { icon: KeyRound, color: 'orange', label: 'Credential Misuse' },
                  RISK_INCREASE: { icon: TrendingUp, color: 'amber', label: 'Risk Score Increase' },
                  RESTRICTED_OPERATION: { icon: OctagonX, color: 'red', label: 'Restricted Operation' },
                  SESSION_TERMINATION: { icon: XCircle, color: 'rose', label: 'Session Terminated' },
                }[alert.alertType] || { icon: Bell, color: 'slate', label: alert.alertType };
                const Icon = alertMeta.icon;

                return (
                  <div key={alert._id} className={`bg-white rounded-2xl border border-${alertMeta.color}-200 p-4 flex items-start gap-3 shadow-sm`}>
                    <div className={`p-2 rounded-xl bg-${alertMeta.color}-50 border border-${alertMeta.color}-200 flex-shrink-0`}>
                      <Icon className={`w-4 h-4 text-${alertMeta.color}-600`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-xs font-bold text-slate-900">{alertMeta.label}</p>
                        <div className="flex items-center gap-2">
                          <RiskBadge level={alert.riskLevel} score={alert.riskScore || 0} showScore={!!alert.riskScore} />
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            alert.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : alert.status === 'REVIEWED' ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {alert.status || 'OPEN'}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{alert.message || alert.description || 'No description'}</p>
                      <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
                        {alert.userId?.name && <span>👤 {alert.userId.name}</span>}
                        {alert.sessionId && <span>Session: {String(alert.sessionId).slice(-8)}</span>}
                        <span>{new Date(alert.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sessions View */}
      {activeAdminView === 'sessions' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            {/* Search */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by customer, IP, device, or Session ID..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </form>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold text-slate-700"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Allowed">Allowed</option>
                  <option value="MFA Required">MFA Required</option>
                  <option value="Blocked">Blocked</option>
                  <option value="Confirmed Fraud">Confirmed Fraud</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Risk Level:</span>
                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold text-slate-700"
                >
                  <option value="ALL">All Risk Tiers</option>
                  <option value="low">Low (0-29 pts)</option>
                  <option value="medium">Medium (30-59 pts)</option>
                  <option value="high">High (60+ pts)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Suspicious Sessions Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Time & ID</th>
                    <th className="py-3.5 px-4">Device & IP</th>
                    <th className="py-3.5 px-4">Location</th>
                    <th className="py-3.5 px-4">Risk Evaluation</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-400">
                        No sessions match current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    sessions.map((sess) => {
                      const isBlocked = sess.status === 'Blocked' || sess.status === 'Confirmed Fraud';
                      return (
                        <tr key={sess._id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Customer */}
                          <td className="py-4 px-4 font-semibold text-slate-900">
                            <div>{sess.customerName}</div>
                            <div className="text-[11px] text-slate-400 font-normal">{sess.customerEmail}</div>
                            {sess.transfersLocked && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-red-700 font-bold bg-red-50 border border-red-200 px-1.5 py-0.5 rounded mt-0.5">
                                <Lock className="w-2.5 h-2.5" /> Transfers Locked
                              </span>
                            )}
                          </td>

                          {/* Time & Session ID */}
                          <td className="py-4 px-4">
                            <div className="text-slate-800 font-medium">
                              {new Date(sess.time).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                              {new Date(sess.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">{sess.sessionId}</div>
                          </td>

                          {/* Device & IP */}
                          <td className="py-4 px-4">
                            <div className="font-semibold text-slate-800">{sess.device}</div>
                            <div className="font-mono text-slate-500 text-[11px] flex items-center gap-1">
                              {sess.ipAddress}
                              {sess.isVpn && <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-bold">VPN</span>}
                            </div>
                          </td>

                          {/* Location */}
                          <td className="py-4 px-4">
                            <div className="font-medium text-slate-800 flex items-center gap-1">
                              <Globe className="w-3 h-3 text-slate-400" />
                              {sess.location}
                            </div>
                          </td>

                          {/* Risk Score & Reasons */}
                          <td className="py-4 px-4 max-w-xs">
                            <RiskBadge score={sess.riskScore} level={sess.riskLevel} />
                            {sess.riskReasons && sess.riskReasons.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {sess.riskReasons.slice(0, 2).map((r, i) => (
                                  <p key={i} className="text-[10px] text-red-700 truncate" title={r}>
                                    • {r}
                                  </p>
                                ))}
                                {sess.riskReasons.length > 2 && (
                                  <p className="text-[9px] text-slate-400 font-semibold">
                                    +{sess.riskReasons.length - 2} more factors
                                  </p>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-4 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                              sess.status === 'Confirmed Fraud'
                                ? 'bg-red-100 text-red-900 border-red-300'
                                : sess.status === 'Blocked'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : sess.status === 'MFA Required'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : sess.status === 'Resolved'
                                      ? 'bg-blue-50 text-blue-800 border-blue-200'
                                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}>
                              {sess.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-4 text-right space-x-1.5 whitespace-nowrap">
                            {/* Block / Unblock IP Button */}
                            <button
                              onClick={() => handleToggleBlock('IP', sess.ipAddress, isBlocked)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                                isBlocked
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                              }`}
                              title={`Quarantine or unquarantine IP ${sess.ipAddress}`}
                            >
                              {isBlocked ? 'Unblock IP' : 'Block IP'}
                            </button>

                            {/* Unlock User Transfers Button if locked */}
                            {sess.transfersLocked && sess.customerId && (
                              <button
                                onClick={() => handleToggleTransfers(sess.customerId, true)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                                title="Unlock customer wire & ACH transfers"
                              >
                                Unlock Transfers
                              </button>
                            )}

                            {/* Mark Resolved */}
                            {sess.status !== 'Resolved' && (
                              <button
                                onClick={() => handleUpdateStatus(sess.sessionId, 'Resolved')}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
                              >
                                Resolve
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* AuditLog Stream View (FR9) */}
      {activeAdminView === 'audit' && (
        <AuditLogViewer />
      )}

      {/* Blocklist View */}
      {activeAdminView === 'blocklist' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Session Firewall Quarantined Artifacts</h3>
              <p className="text-xs text-slate-500">Every IP address or device fingerprint actively denied access</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">{blocklist.length} Items</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Value (IP / Device)</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Blocked By</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {blocklist.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-400">
                      Blocklist is currently empty.
                    </td>
                  </tr>
                ) : (
                  blocklist.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-bold">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          item.type === 'IP' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                        {item.value}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-sm">
                        {item.reason}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {item.blockedBy}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.isActive ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {item.isActive ? 'Active Quarantine' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleToggleBlock(item.type, item.value, item.isActive)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                          {item.isActive ? 'Unblock' : 'Re-block'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Threshold Configurator Modal (FR10) */}
      <ThresholdConfigModal
        isOpen={isThresholdModalOpen}
        onClose={() => setIsThresholdModalOpen(false)}
        onUpdated={fetchData}
      />
    </div>
  );
}
