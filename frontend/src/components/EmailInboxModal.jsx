import React, { useState, useEffect } from 'react';
import { Mail, ShieldAlert, Clock, X, CheckCheck, RefreshCw } from 'lucide-react';
import { bankApi } from '../services/api';

export default function EmailInboxModal({ isOpen, onClose }) {
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const res = await bankApi.getNotifications();
      if (res.data.success) {
        const emailList = res.data.notifications.filter(n => n.channel === 'EMAIL_SIMULATED');
        setEmails(emailList);
        if (emailList.length > 0 && !selectedEmail) {
          setSelectedEmail(emailList[0]);
        }
      }
    } catch (err) {
      console.warn('Failed to load email inbox:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEmails();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full h-[600px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/30 rounded-lg">
              <Mail className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-bold">Simulated Customer Security Mailbox</h3>
              <p className="text-xs text-slate-400">Preview outgoing automated security advisories</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchEmails}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Columns */}
        <div className="flex-1 flex overflow-hidden">
          {/* Email List Column */}
          <div className="w-2/5 border-r border-slate-200 overflow-y-auto bg-slate-50">
            {emails.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <Mail className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                No security emails dispatched yet.
              </div>
            ) : (
              emails.map((em) => (
                <div
                  key={em._id}
                  onClick={() => setSelectedEmail(em)}
                  className={`p-3.5 border-b border-slate-200 cursor-pointer transition-colors ${
                    selectedEmail?._id === em._id
                      ? 'bg-blue-50/80 border-l-4 border-l-blue-600'
                      : 'hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span className="font-semibold text-rose-700 uppercase tracking-wider flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> Security Alert
                    </span>
                    <span>{new Date(em.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                    {em.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                    {em.message}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Email Viewer Column */}
          <div className="flex-1 p-6 overflow-y-auto bg-white">
            {selectedEmail ? (
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-4">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-800 inline-block mb-2">
                    SIMULATED OUTGOING EMAIL
                  </span>
                  <h2 className="text-lg font-bold text-slate-900">
                    {selectedEmail.title}
                  </h2>
                  <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                    <span><strong>From:</strong> fraud-prevention@securebank.com</span>
                    <span><strong>Date:</strong> {new Date(selectedEmail.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-xs whitespace-pre-wrap text-slate-800 leading-relaxed">
                  {selectedEmail.message}
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                  <CheckCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span>
                    Simulated email placeholder dispatched automatically by Session Firewall Notification Service.
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Select an email from the left pane to view details.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
