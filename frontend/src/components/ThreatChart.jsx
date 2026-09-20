import React, { useState } from 'react';
import { BarChart3, TrendingUp, ShieldAlert, ShieldX } from 'lucide-react';

export default function ThreatChart({ data = [] }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-xs text-slate-400">
        No telemetry data available for charts.
      </div>
    );
  }

  // Find max value for scaling
  const maxVal = Math.max(1, ...data.map(d => Math.max(d.total || 0, d.suspicious || 0, d.blocked || 0)));

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            7-Day Suspicious Activity & Blocked Sessions
          </h3>
          <p className="text-xs text-slate-500">
            Real-time daily telemetry monitoring by Session Firewall
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block"></span>
            Total Logins
          </div>
          <div className="flex items-center gap-1.5 text-amber-700 font-medium">
            <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block"></span>
            Suspicious
          </div>
          <div className="flex items-center gap-1.5 text-red-700 font-medium">
            <span className="w-3 h-3 rounded-sm bg-red-600 inline-block"></span>
            Blocked
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="relative pt-4 pb-2">
        <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-44 border-b border-slate-200 px-2">
          {data.map((item, idx) => {
            const totalHeight = Math.max(12, Math.round(((item.total || 0) / maxVal) * 120));
            const suspiciousHeight = Math.round(((item.suspicious || 0) / maxVal) * 120);
            const blockedHeight = Math.round(((item.blocked || 0) / maxVal) * 120);

            return (
              <div
                key={idx}
                className="flex flex-col items-center h-full justify-end relative group cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Tooltip */}
                {hoveredIdx === idx && (
                  <div className="absolute -top-16 z-20 bg-slate-900 text-white text-[11px] p-2 rounded-lg shadow-xl whitespace-nowrap pointer-events-none border border-slate-700 animate-fade-in">
                    <p className="font-bold text-slate-200">{item.label}</p>
                    <p className="text-blue-300">Total: {item.total}</p>
                    <p className="text-amber-300">Suspicious: {item.suspicious}</p>
                    <p className="text-red-400">Blocked: {item.blocked}</p>
                  </div>
                )}

                {/* Bars Group */}
                <div className="flex items-end gap-1 w-full justify-center">
                  {/* Total */}
                  <div
                    style={{ height: `${totalHeight}px` }}
                    className="w-2.5 sm:w-4 bg-blue-100 group-hover:bg-blue-200 rounded-t-sm transition-all"
                  />
                  {/* Suspicious */}
                  <div
                    style={{ height: `${Math.max(4, suspiciousHeight)}px` }}
                    className="w-2.5 sm:w-4 bg-amber-400 group-hover:bg-amber-500 rounded-t-sm transition-all"
                  />
                  {/* Blocked */}
                  <div
                    style={{ height: `${Math.max(4, blockedHeight)}px` }}
                    className="w-2.5 sm:w-4 bg-red-600 group-hover:bg-red-700 rounded-t-sm transition-all"
                  />
                </div>

                <span className="text-[10px] text-slate-500 font-medium mt-2 truncate w-full text-center">
                  {item.label?.split(' ')[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
