import React from 'react';
import { Building2, Cloud, Landmark } from 'lucide-react';

export default function ApplicationSelector({ activeApp, onSelectApp }) {
  const apps = [
    {
      id: 'banking',
      name: 'Retail Banking & FinTech',
      desc: 'Account balance, wire transfers & card controls',
      icon: Landmark
    },
    {
      id: 'enterprise',
      name: 'Enterprise HR & Admin Portal',
      desc: 'Employee payroll, confidential records & role escalation',
      icon: Building2
    },
    {
      id: 'saas',
      name: 'Cloud SaaS Data Workspace',
      desc: 'Project mesh, bulk tenant DB backup & workspace management',
      icon: Cloud
    }
  ];

  return (
    <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
      <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-2 px-1">
        Protected Backend Application Target:
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {apps.map((app) => {
          const Icon = app.icon;
          const isSelected = activeApp === app.id;
          return (
            <button
              key={app.id}
              onClick={() => onSelectApp(app.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/80'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-xs font-bold ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                  {app.name}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 line-clamp-1">{app.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
