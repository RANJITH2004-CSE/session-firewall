import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';

export default function RiskBadge({ score = 0, level, showScore = true }) {
  const normalizedLevel = level ? level.toLowerCase() : (score >= 60 ? 'high' : (score >= 30 ? 'medium' : 'low'));

  if (normalizedLevel === 'high') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 shadow-sm">
        <ShieldX className="w-3.5 h-3.5 text-red-600" />
        High Risk
        {showScore && <span className="bg-red-200 text-red-800 px-1.5 py-0.2 rounded-md font-mono text-[11px]">{score} pts</span>}
      </span>
    );
  }

  if (normalizedLevel === 'medium') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 shadow-sm">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
        Medium Risk
        {showScore && <span className="bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded-md font-mono text-[11px]">{score} pts</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
      Low Risk
      {showScore && <span className="bg-emerald-200 text-emerald-800 px-1.5 py-0.2 rounded-md font-mono text-[11px]">{score} pts</span>}
    </span>
  );
}
