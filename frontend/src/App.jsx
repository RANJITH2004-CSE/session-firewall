import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SecurityProvider, useSecurity } from './context/SecurityContext';
import Navbar from './components/Navbar';
import ScenarioBar from './components/ScenarioBar';
import WasThisYouModal from './components/WasThisYouModal';
import EmailInboxModal from './components/EmailInboxModal';
import ThresholdConfigModal from './components/ThresholdConfigModal';
import CustomerDashboard from './pages/CustomerDashboard';
import ActiveSessions from './pages/ActiveSessions';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

function AppContent() {
  const { user, loading } = useAuth();
  const { isEmailModalOpen, setIsEmailModalOpen, bannerAlert, setBannerAlert } = useSecurity();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lastScenarioData, setLastScenarioData] = useState(null);
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-600">Initializing Session Firewall Protection...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const isCustomer = user.role === 'customer';
  const isAdmin = user.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* 1-Click SWE3004 Scenario Simulation Bar */}
      <ScenarioBar
        onScenarioExecuted={(scenarioData) => {
          setRefreshTrigger(prev => prev + 1);
          setLastScenarioData(scenarioData);
        }}
        onOpenThresholds={() => setIsThresholdModalOpen(true)}
      />

      {/* Main Banking & Gateway Navbar */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Global In-App "Was This You?" Modal */}
      <WasThisYouModal />

      {/* Simulated Email Mailbox Modal */}
      <EmailInboxModal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} />

      {/* Global Threshold Configuration Modal (FR10) */}
      <ThresholdConfigModal
        isOpen={isThresholdModalOpen}
        onClose={() => setIsThresholdModalOpen(false)}
        onUpdated={() => setRefreshTrigger(prev => prev + 1)}
      />

      {/* Global Notification Banner if triggered */}
      {bannerAlert && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 w-full">
          <div className={`p-4 rounded-2xl border text-xs shadow-sm flex items-start justify-between gap-3 animate-fade-in ${
            bannerAlert.type === 'critical'
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}>
            <div className="flex items-start gap-3">
              {bannerAlert.type === 'critical' ? (
                <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-bold text-sm">{bannerAlert.message}</p>
                {bannerAlert.instructions && (
                  <ul className="list-disc list-inside text-slate-700 text-xs space-y-0.5 pt-1">
                    {bannerAlert.instructions.map((inst, idx) => (
                      <li key={idx}>{inst}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <button
              onClick={() => setBannerAlert(null)}
              className="text-slate-400 hover:text-slate-600 font-bold px-2 py-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Page Content Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 w-full">
        {isAdmin ? (
          <AdminDashboard key={refreshTrigger} />
        ) : activeTab === 'sessions' ? (
          <ActiveSessions key={refreshTrigger} />
        ) : (
          <CustomerDashboard
            key={refreshTrigger}
            setActiveTab={setActiveTab}
            lastScenarioData={lastScenarioData}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400 mt-auto">
        <p>Intent-Aware Continuous Session Authentication Firewall • VIT SWE3004 • 22MIS0155 Nathiya A</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SecurityProvider>
        <AppContent />
      </SecurityProvider>
    </AuthProvider>
  );
}
