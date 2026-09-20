import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  Send, 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Activity, 
  Globe, 
  Clock, 
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { bankApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSecurity } from '../context/SecurityContext';
import TransferModal from '../components/TransferModal';
import RiskBadge from '../components/RiskBadge';

export default function CustomerDashboard({ setActiveTab }) {
  const { user, currentSession, refreshUser } = useAuth();
  const { pendingChallenge } = useSecurity();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await bankApi.getDashboard();
      if (res.data.success) {
        setDashboardData(res.data);
      }
    } catch (err) {
      console.warn('Dashboard fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const isTransfersLocked = user?.transfersLocked;

  return (
    <div className="space-y-6 pb-12">
      {/* Transfer Modal */}
      <TransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        onTransferSuccess={() => {
          fetchDashboard();
          refreshUser();
        }}
      />

      {/* Critical Transfer Lockout Banner if user reported fraud */}
      {isTransfersLocked && (
        <div className="bg-red-50 border-l-4 border-l-red-600 p-4 rounded-xl shadow-xs flex items-start justify-between gap-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 rounded-lg text-red-700">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-red-950">
                Security Restriction Active: Outgoing Transfers Disabled
              </h3>
              <p className="text-xs text-red-800 mt-0.5">
                {user.transferLockReason || 'Your account is under temporary protection following an unauthorized session report. Wire and ACH transfers are paused.'}
              </p>
              <div className="mt-2 flex items-center gap-3 text-xs font-semibold text-red-900">
                <span>• Suspicious device/IP quarantined</span>
                <span>• Admin notified</span>
                <button
                  onClick={() => setActiveTab('sessions')}
                  className="underline hover:text-red-950"
                >
                  View Active Sessions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Welcome & Quick Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Welcome back, {user?.name || 'Customer'}
          </h1>
          <p className="text-xs text-slate-500">
            Account #{user?.accountNumber || 'SB-8829-4102'} • Real-Time Protection Active
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboard}
            className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 transition-colors shadow-xs"
            title="Refresh balance and transactions"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsTransferOpen(true)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all ${
              isTransfersLocked
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-blue-700 hover:bg-blue-800 text-white shadow-blue-500/20'
            }`}
          >
            {isTransfersLocked ? <Lock className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
            <span>Transfer Funds</span>
          </button>
        </div>
      </div>

      {/* Main Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Balance Card */}
        <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between h-48">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Available Balance
              </span>
              <h2 className="text-3xl font-black tracking-tight text-white mt-1">
                ${(user?.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h2>
            </div>
            <div className="p-2.5 bg-blue-600/30 border border-blue-500/30 rounded-2xl">
              <Wallet className="w-6 h-6 text-blue-400" />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800 pt-3">
            <span className="font-mono">Account: {user?.accountNumber || 'SB-8829-4102'}</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Protected by Firewall
            </span>
          </div>
        </div>

        {/* Current Session Telemetry Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-48">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Current Active Session
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-1 truncate max-w-[200px]">
                {currentSession?.device || 'Chrome 122 on Windows 11'}
              </h3>
            </div>
            <RiskBadge score={currentSession?.riskScore || 0} level={currentSession?.riskLevel || 'low'} />
          </div>

          <div className="space-y-1 text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">IP Address:</span>
              <span className="font-mono font-medium">{currentSession?.ipAddress || '103.21.244.0'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Location:</span>
              <span className="font-medium">
                {currentSession?.location?.city ? `${currentSession.location.city}, ${currentSession.location.country}` : 'Mumbai, India'}
              </span>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-2 flex justify-between items-center text-xs">
            <span className="text-slate-400">Status:</span>
            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
              Authenticated
            </span>
          </div>
        </div>

        {/* Firewall Defense Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-48">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Account Protection
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-1">
                {isTransfersLocked ? 'High Alert / Restricted' : 'Optimal Security Baseline'}
              </h3>
            </div>
            <div className={`p-2.5 rounded-2xl ${isTransfersLocked ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {isTransfersLocked ? <ShieldAlert className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            {isTransfersLocked
              ? 'Transfers are restricted due to flagged activity. Resolve pending alerts to restore full capabilities.'
              : 'Our 8-rule behavioral risk engine continuously verifies device telemetry, velocity, and geolocation.'}
          </p>

          <button
            onClick={() => setActiveTab('sessions')}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 text-left flex items-center gap-1"
          >
            Manage Active Sessions & Devices →
          </button>
        </div>
      </div>

      {/* Recent Banking Transactions */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recent Account Activity</h3>
            <p className="text-xs text-slate-500">Live transactions ledger for {user?.name}</p>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {dashboardData?.transactions?.length || 0} Records
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {(!dashboardData?.transactions || dashboardData.transactions.length === 0) ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No recent transactions on record.
            </div>
          ) : (
            dashboardData.transactions.map((tx) => {
              const isCredit = tx.type === 'credit';
              const isBlocked = tx.status === 'blocked';

              return (
                <div key={tx._id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${
                      isBlocked 
                        ? 'bg-red-50 text-red-600' 
                        : isCredit 
                          ? 'bg-emerald-50 text-emerald-600' 
                          : 'bg-blue-50 text-blue-600'
                    }`}>
                      {isBlocked ? (
                        <Lock className="w-4 h-4" />
                      ) : isCredit ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900">
                          {tx.recipientName}
                        </h4>
                        {isBlocked && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                            BLOCKED BY FIREWALL
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {tx.category} • {new Date(tx.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={`text-sm font-bold font-mono ${
                      isBlocked 
                        ? 'text-slate-400 line-through' 
                        : isCredit 
                          ? 'text-emerald-600' 
                          : 'text-slate-900'
                    }`}>
                      {isCredit ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                      {tx.status}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
