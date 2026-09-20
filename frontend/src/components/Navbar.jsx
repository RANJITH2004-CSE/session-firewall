import React, { useState } from 'react';
import { Shield, Bell, Mail, LogOut, User as UserIcon, CheckCircle, ChevronDown, Lock, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSecurity } from '../context/SecurityContext';

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, logout, loginWithDemo } = useAuth();
  const { unreadCount, notifications, setIsEmailModalOpen } = useSecurity();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const isCustomer = user?.role === 'customer';
  const isAdmin = user?.role === 'admin';

  const handleRoleSwitch = async (targetRole) => {
    setShowUserMenu(false);
    try {
      const res = await loginWithDemo(targetRole);
      if (res.data.success) {
        window.location.reload();
      }
    } catch (err) {
      console.error('Role switch failed:', err);
    }
  };

  return (
    <nav className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab(isCustomer ? 'dashboard' : 'admin')}>
              <div className="p-2 bg-blue-600 rounded-xl shadow-md shadow-blue-500/20">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-white">SECUREBANK</span>
                  <span className="text-[10px] uppercase font-mono font-bold bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30">
                    Session Firewall
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 tracking-wider">ENTERPRISE ZERO-TRUST</p>
              </div>
            </div>

            {/* Nav Tabs */}
            <div className="hidden md:flex items-center gap-1">
              {isCustomer && (
                <>
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
                      activeTab === 'dashboard'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    Banking Dashboard
                  </button>
                  <button
                    onClick={() => setActiveTab('sessions')}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                      activeTab === 'sessions'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    Active Sessions
                  </button>
                </>
              )}

              {isAdmin && (
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    activeTab === 'admin'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  Security Operations Center (SOC)
                </button>
              )}
            </div>
          </div>

          {/* Right Tools */}
          <div className="flex items-center gap-3">
            {/* Transfer Lock Indicator for Customer */}
            {isCustomer && user?.transfersLocked && (
              <div className="hidden sm:flex items-center gap-1.5 bg-red-950/70 border border-red-800 text-red-300 px-2.5 py-1 rounded-lg text-xs font-semibold">
                <Lock className="w-3.5 h-3.5 text-red-400" />
                <span>Transfers Locked</span>
              </div>
            )}

            {/* Simulated Mailbox Button */}
            {isCustomer && (
              <button
                onClick={() => setIsEmailModalOpen(true)}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors relative"
                title="View Simulated Security Emails"
              >
                <Mail className="w-5 h-5" />
                <span className="sr-only">Simulated Email</span>
              </button>
            )}

            {/* Notifications Dropdown */}
            {isCustomer && (
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors relative"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-fade-in">
                    <div className="p-3 bg-slate-900 text-white flex items-center justify-between text-xs">
                      <span className="font-bold">Security Notifications</span>
                      <span className="text-[11px] text-slate-400">{notifications.length} alerts</span>
                    </div>

                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <p className="p-4 text-center text-xs text-slate-500">No alerts on record.</p>
                      ) : (
                        notifications.slice(0, 5).map((n) => (
                          <div key={n._id} className="p-3 hover:bg-slate-50 text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-slate-800 flex items-center gap-1">
                                <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                                {n.title}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 line-clamp-2">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Persona Switcher & User Profile Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 pl-2.5 rounded-xl hover:bg-slate-800 border border-slate-700/80 transition-all text-xs"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  {user?.name ? user.name.charAt(0) : 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="font-bold text-white text-xs leading-none">{user?.name || 'Loading...'}</p>
                  <p className="text-[10px] text-slate-400 capitalize mt-0.5">{user?.role} Account</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-60 bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-fade-in p-2 text-xs">
                  <div className="p-2 border-b border-slate-100 mb-1">
                    <p className="font-bold text-slate-800">{user?.name}</p>
                    <p className="text-slate-500 text-[11px] truncate">{user?.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">
                      {user?.role === 'admin' ? 'Security Administrator' : 'Retail Banking Customer'}
                    </span>
                  </div>

                  <div className="py-1">
                    <p className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400">Quick Role Switch</p>
                    <button
                      onClick={() => handleRoleSwitch('customer')}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 flex items-center justify-between ${isCustomer ? 'font-bold text-blue-700' : ''}`}
                    >
                      <span>Alex Mercer (Customer)</span>
                      {isCustomer && <CheckCircle className="w-3.5 h-3.5 text-blue-600" />}
                    </button>
                    <button
                      onClick={() => handleRoleSwitch('admin')}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 flex items-center justify-between ${isAdmin ? 'font-bold text-blue-700' : ''}`}
                    >
                      <span>Sarah Connor (Admin SOC)</span>
                      {isAdmin && <CheckCircle className="w-3.5 h-3.5 text-blue-600" />}
                    </button>
                  </div>

                  <div className="border-t border-slate-100 pt-1 mt-1">
                    <button
                      onClick={logout}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
