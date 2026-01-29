
import React, { useState, useMemo } from 'react';
import { Horse, ComplianceStatus } from '../types';
import { checkVaccinationCompliance, checkHoofCareStatus, getStatusColor } from '../logic';

interface ActionSubItem {
  type: 'VACC' | 'HOOF';
  priority: ComplianceStatus;
  message: string;
}

interface ConsolidatedActionItem {
  horse: Horse;
  tasks: ActionSubItem[];
  highestPriority: ComplianceStatus;
}

interface ActionDashboardProps {
  horses: Horse[];
  onSelectHorse: (horse: Horse) => void;
  onGoToStable: () => void;
}

export const ActionDashboard: React.FC<ActionDashboardProps> = ({ horses, onSelectHorse, onGoToStable }) => {
  const [filterType, setFilterType] = useState<'ALL' | 'VACC' | 'HOOF'>('ALL');
  const [filterPriority, setFilterPriority] = useState<'ALL' | ComplianceStatus>('ALL');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  const actionItems = useMemo(() => {
    const consolidatedMap = new Map<string, ConsolidatedActionItem>();

    horses.forEach(horse => {
      const tasks: ActionSubItem[] = [];
      
      // Check Vaccination
      const compliance = checkVaccinationCompliance(horse);
      if (compliance.status !== ComplianceStatus.GREEN) {
        tasks.push({
          type: 'VACC',
          priority: compliance.status,
          message: compliance.message
        });
      }

      // Check Hoof Care
      const hoof = checkHoofCareStatus(horse);
      if (hoof.status !== ComplianceStatus.GREEN) {
        tasks.push({
          type: 'HOOF',
          priority: hoof.status,
          message: hoof.status === ComplianceStatus.RED 
            ? `Hufschmied überfällig (über 8 Wochen)` 
            : `Hufschmied fällig (über 6 Wochen)`
        });
      }

      if (tasks.length > 0) {
        const hasRed = tasks.some(t => t.priority === ComplianceStatus.RED);
        consolidatedMap.set(horse.id, {
          horse,
          tasks,
          highestPriority: hasRed ? ComplianceStatus.RED : ComplianceStatus.YELLOW
        });
      }
    });

    return Array.from(consolidatedMap.values()).sort((a, b) => {
      if (a.highestPriority === b.highestPriority) return 0;
      return a.highestPriority === ComplianceStatus.RED ? -1 : 1;
    });
  }, [horses]);

  const filteredItems = actionItems.filter(item => {
    const matchesType = filterType === 'ALL' || item.tasks.some(t => t.type === filterType);
    const matchesPriority = filterPriority === 'ALL' || item.highestPriority === filterPriority;
    return matchesType && matchesPriority;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">Zusammengefasste Aufgaben für deine Pferde.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm border ${
              isFilterExpanded 
                ? 'bg-slate-900 text-white border-slate-900' 
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter & Sortierung
          </button>
          
          <button 
            onClick={onGoToStable}
            className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 group"
          >
            Zu Meine Pferde
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </header>

      {isFilterExpanded && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 animate-in slide-in-from-top-2 duration-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Aufgabentyp</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'ALL', label: 'Alle' },
                  { id: 'VACC', label: 'Impfungen' },
                  { id: 'HOOF', label: 'Hufschmied' }
                ].map(opt => (
                  <button 
                    key={opt.id}
                    onClick={() => setFilterType(opt.id as any)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${filterType === opt.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Dringlichkeit</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'ALL', label: 'Alle' },
                  { id: ComplianceStatus.RED, label: 'Kritisch (Rot)' },
                  { id: ComplianceStatus.YELLOW, label: 'Fällig (Gelb)' }
                ].map(opt => (
                  <button 
                    key={opt.id}
                    onClick={() => setFilterPriority(opt.id as any)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${filterPriority === opt.id ? 'bg-rose-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {filteredItems.map((item) => (
              <div 
                key={item.horse.id}
                onClick={() => onSelectHorse(item.horse)}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${getStatusColor(item.highestPriority)}`} />
                
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <img src={item.horse.image} className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-50 shadow-inner group-hover:scale-105 transition-transform" alt={item.horse.name} />
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(item.highestPriority)} shadow-sm`} />
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-slate-900 text-xl group-hover:text-indigo-600 transition-colors">{item.horse.name}</h4>
                    <p className="text-xs text-slate-400 font-medium">{item.horse.breed} • {item.horse.gender}</p>
                  </div>
                </div>

                <div className="mt-4 md:mt-0 space-y-2 flex-1 md:max-w-md lg:max-w-xl md:ml-12">
                  {item.tasks.map((task, tidx) => (
                    <div key={tidx} className="flex items-start gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${getStatusColor(task.priority)}`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">
                          {task.type === 'VACC' ? 'Impfung' : 'Hufschmied'}
                        </span>
                        <p className="text-sm text-slate-600 font-medium leading-tight whitespace-normal break-words">{task.message}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden lg:flex items-center ml-4">
                  <svg className="w-6 h-6 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 py-24 text-center">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900">Alles erledigt!</h3>
            <p className="text-slate-400 max-w-xs mx-auto mt-2 px-4 whitespace-normal break-words">Momentan stehen keine kritischen Aufgaben für deine Pferde an.</p>
          </div>
        )}
      </div>
    </div>
  );
};
