import React, { useState } from 'react';
import { Send, AlertTriangle, ShieldCheck, X, DollarSign, Lock } from 'lucide-react';
import { bankApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function TransferModal({ isOpen, onClose, onTransferSuccess }) {
  const { user, refreshUser } = useAuth();
  const [recipientName, setRecipientName] = useState('');
  const [recipientAccount, setRecipientAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Transfer');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const isTransfersLocked = user?.transfersLocked;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (isTransfersLocked) {
      setError(user.transferLockReason || 'Transfers are currently locked on this account.');
      return;
    }

    setLoading(true);

    try {
      const res = await bankApi.transferMoney({
        recipientName,
        recipientAccount,
        amount: Number(amount),
        category,
        description
      });

      if (res.data.success) {
        setSuccessMsg(res.data.message);
        await refreshUser();
        if (onTransferSuccess) onTransferSuccess(res.data.transaction);
        setTimeout(() => {
          onClose();
          setSuccessMsg('');
          setAmount('');
          setRecipientName('');
          setRecipientAccount('');
        }, 1500);
      } else {
        setError(res.data.message || 'Transfer failed.');
      }
    } catch (err) {
      const resp = err.response?.data;
      setError(resp?.message || 'Transfer could not be completed.');
      await refreshUser();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 rounded-xl border border-blue-500/30">
              <Send className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Transfer Money</h3>
              <p className="text-xs text-slate-300">SecureBank Instant Wire & ACH Transfer</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transfer Lock Warning */}
        {isTransfersLocked && (
          <div className="bg-red-50 border-b border-red-200 p-4 flex items-start gap-3">
            <Lock className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-red-900 uppercase tracking-wide">Transfers Locked by Session Firewall</p>
              <p className="text-xs text-red-700 mt-0.5">
                {user.transferLockReason || 'Outgoing transactions are paused due to an unauthorized session security report.'}
              </p>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">Available Account Balance</span>
            <span className="text-slate-900 font-bold font-mono text-sm">
              ${(user?.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Recipient Full Name
            </label>
            <input
              type="text"
              required
              disabled={isTransfersLocked}
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="e.g. Apex Cloud Services LLC"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Recipient Account #
              </label>
              <input
                type="text"
                required
                disabled={isTransfersLocked}
                value={recipientAccount}
                onChange={(e) => setRecipientAccount(e.target.value)}
                placeholder="SB-8821-9901"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Transfer Amount ($ USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-semibold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  disabled={isTransfersLocked}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="250.00"
                  className="w-full pl-7 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 font-semibold disabled:bg-slate-100"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isTransfersLocked}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100"
              >
                <option value="Transfer">General Transfer</option>
                <option value="Vendor Payment">Vendor Payment</option>
                <option value="Utilities">Utilities</option>
                <option value="Payroll">Payroll</option>
                <option value="Personal">Personal</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Memo / Note
              </label>
              <input
                type="text"
                disabled={isTransfersLocked}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional transfer note"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-300 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || isTransfersLocked}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? 'Validating Risk Policy...' : 'Confirm Transfer'}
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
