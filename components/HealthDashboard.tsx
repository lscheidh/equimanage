
import React, { useState } from 'react';
import { Horse, ComplianceStatus } from '../types';
import { HorseCard } from './HorseCard';
import { checkFEICompliance, getStatusColor } from '../logic';

interface HealthDashboardProps {
  horses: Horse[];
  onSelectHorse: (horse: Horse) => void;
  onAddNewHorse: () => void;
  onExport: () => void;
  onGoToDashboard: () => void;
}

export const HealthDashboard: React.FC<HealthDashboardProps> = ({ 
  horses, 
  onSelectHorse, 
  onAddNewHorse, 
  onExport,
  onGoToDashboard
}) => {
  const [filter, setFilter] = useState<ComplianceStatus | 'ALL'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredHorses = horses.filter(h => {
    if (filter === 'ALL') return true;
    return checkFEICompliance(h).status === filter;
  });

  const stats = {
    total: horses.length,
    green: horses.filter(h => checkFEICompliance(h).status === ComplianceStatus.GREEN).length,
    yellow: horses.filter(h => checkFEICompliance(h).status === ComplianceStatus.YELLOW).length,
    red: horses.filter(h => checkFEICompliance(h).status === ComplianceStatus.RED).length,
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="flex items-start gap-4">
          <button 
            onClick={onGoToDashboard}
            className="mt-1 p-2 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-xl transition-all shadow-sm group"
            title="Zum Dashboard"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Meine Pferde</h1>
            <p className="text-slate-500">Du verwaltest {horses.length} Pferde in deinem Profil.</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
           <div className="flex bg-slate-200 p-1 rounded-lg mr-2">
             <button 
               onClick={() => setViewMode('grid')}
               className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
             </button>
             <button 
               onClick={() => setViewMode('list')}
               className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
             </button>
           </div>

           <button 
            onClick={onExport}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 flex items-center gap-2 transition-colors"
           >
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
             Export (CSV)
           </button>

           <button 
            onClick={onAddNewHorse}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 flex items-center gap-2 shadow-sm transition-all hover:shadow-md"
           >
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
             Neues Pferd
           </button>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button 
            onClick={() => setFilter('ALL')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${filter === 'ALL' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            Alle ({stats.total})
          </button>
          <button 
            onClick={() => setFilter(ComplianceStatus.GREEN)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${filter === ComplianceStatus.GREEN ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-emerald-600 border border-emerald-100 hover:bg-emerald-50'}`}
          >
            Konform ({stats.green})
          </button>
          <button 
            onClick={() => setFilter(ComplianceStatus.YELLOW)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${filter === ComplianceStatus.YELLOW ? 'bg-amber-500 text-white shadow-md' : 'bg-white text-amber-600 border border-amber-100 hover:bg-amber-50'}`}
          >
            Fällig ({stats.yellow})
          </button>
          <button 
            onClick={() => setFilter(ComplianceStatus.RED)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${filter === ComplianceStatus.RED ? 'bg-rose-600 text-white shadow-md' : 'bg-white text-rose-600 border border-rose-100 hover:bg-rose-50'}`}
          >
            Kritisch ({stats.red})
          </button>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredHorses.map(horse => (
            <HorseCard key={horse.id} horse={horse} onClick={onSelectHorse} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Pferd</th>
                <th className="px-6 py-3">Rasse</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Nächste Impfung</th>
                <th className="px-6 py-3 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHorses.map(horse => {
                const compliance = checkFEICompliance(horse);
                return (
                  <tr key={horse.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onSelectHorse(horse)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={horse.image} className="w-10 h-10 rounded-full object-cover shadow-inner" alt={horse.name} />
                        <span className="font-bold text-slate-900">{horse.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{horse.breed}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold text-white uppercase ${getStatusColor(compliance.status)}`}>
                        {compliance.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {compliance.message}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm">Details</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filteredHorses.length === 0 && (
        <div className="py-20 text-center bg-white rounded-xl border border-dashed border-slate-300 text-slate-400">
          Keine Pferde mit diesem Status gefunden.
        </div>
      )}
    </div>
  );
};
