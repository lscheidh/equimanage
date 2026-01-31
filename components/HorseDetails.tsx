
import React, { useState, useMemo, useEffect } from 'react';
import { Horse, Vaccination, ServiceRecord, ServiceType, ComplianceStatus } from '../types';
import { checkVaccinationCompliance, getStatusColor, getStatusLabel } from '../logic';

const todayStr = () => new Date().toISOString().split('T')[0];
import { uploadHorseImage, HORSE_PLACEHOLDER_IMAGE } from '../services/horseImageService';
import * as rimondo from '../services/rimondoService';

interface HorseDetailsProps {
  horse: Horse;
  allHorses: Horse[];
  onBack: () => void;
  onDelete: (id: string) => void;
  onUpdateHorse: (horse: Horse) => void;
  onBulkAddVaccination: (horseIds: string[], vacc: Omit<Vaccination, 'id'>) => void;
  onUpdateVaccination: (horseId: string, vacc: Vaccination) => void;
  onDeleteVaccination: (horseId: string, vaccId: string) => void;
  onBulkAddService: (horseIds: string[], service: Omit<ServiceRecord, 'id'>) => void;
  onUpdateService: (horseId: string, service: ServiceRecord) => void;
  onDeleteService: (horseId: string, serviceId: string) => void;
  onTransfer: (id: string) => void;
}

export const HorseDetails: React.FC<HorseDetailsProps> = ({ 
  horse, allHorses, onBack, onDelete, onUpdateHorse, onBulkAddVaccination, onUpdateVaccination, onDeleteVaccination,
  onBulkAddService, onUpdateService, onDeleteService, onTransfer
}) => {
  const compliance = checkVaccinationCompliance(horse);
  const statusLabel = getStatusLabel(compliance.status);
  
  const [showEditHorseMask, setShowEditHorseMask] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<'horse' | 'service' | 'vacc' | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  
  const [showVaccModal, setShowVaccModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [isBulkEntry, setIsBulkEntry] = useState(false);
  const [selectedHorseIds, setSelectedHorseIds] = useState<string[]>([horse.id]);
  
  const [editingItem, setEditingItem] = useState<any>(null);
  const [transferCode, setTransferCode] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);

  const [editedHorse, setEditedHorse] = useState<Horse>(horse);
  const [rimondoUrl, setRimondoUrl] = useState('');
  const [rimondoLoading, setRimondoLoading] = useState(false);
  const [rimondoPreviewData, setRimondoPreviewData] = useState<rimondo.RimondoParsed | null>(null);
  const [rimondoError, setRimondoError] = useState<string | null>(null);
  useEffect(() => { if (!showEditHorseMask) setEditedHorse(horse); }, [horse, showEditHorseMask]);

  const [entryData, setEntryData] = useState({
    type: 'Influenza',
    date: new Date().toISOString().split('T')[0],
    vetName: '',
    provider: '',
    notes: '',
    sequence: 'Booster' as any
  });
  const [selectedVaccTypes, setSelectedVaccTypes] = useState<string[]>(['Influenza']);

  // Smart Suggestions
  const suggestions = useMemo(() => {
    const vets = new Set<string>();
    const providers = new Set<string>();
    allHorses.forEach(h => {
      h.vaccinations.forEach(v => v.vetName && vets.add(v.vetName));
      h.serviceHistory.forEach(s => s.provider && providers.add(s.provider));
    });
    return { vets: Array.from(vets).slice(0, 3), providers: Array.from(providers).slice(0, 3) };
  }, [allHorses]);

  const handleSaveHorse = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateHorse(editedHorse);
    setShowEditHorseMask(false);
  };

  const confirmDelete = () => {
    if (showDeleteConfirm === 'horse') onDelete(horse.id);
    if (showDeleteConfirm === 'service' && targetId) onDeleteService(horse.id, targetId);
    if (showDeleteConfirm === 'vacc' && targetId) onDeleteVaccination(horse.id, targetId);
    setShowDeleteConfirm(null);
    setTargetId(null);
  };

  const handleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (entryData.date > todayStr()) {
      return;
    }
    const ids = isBulkEntry ? selectedHorseIds : [horse.id];
    
    if (showVaccModal) {
      if (editingItem) {
        const payload = { ...editingItem, ...entryData, isBooster: entryData.sequence === 'Booster' };
        if ((editingItem as Vaccination).status === 'planned') (payload as Vaccination).status = 'verified';
        onUpdateVaccination(horse.id, payload as Vaccination);
        setShowVaccModal(false);
      } else {
        const types = selectedVaccTypes.length ? selectedVaccTypes : [entryData.type];
        const base = { ...entryData, isBooster: entryData.sequence === 'Booster', status: 'pending' as const };
        for (const type of types) {
          await onBulkAddVaccination(ids, { ...base, type });
        }
        setShowVaccModal(false);
      }
    } else {
      const servicePayload: Omit<ServiceRecord, 'id'> = {
        type: entryData.type as ServiceType,
        date: entryData.date,
        notes: entryData.notes || undefined,
        provider: entryData.provider || undefined,
      };
      if (editingItem) onUpdateService(horse.id, { ...editingItem, ...servicePayload });
      else onBulkAddService(ids, servicePayload);
      setShowServiceModal(false);
    }
    setEditingItem(null);
    setIsBulkEntry(false);
    setSelectedHorseIds([horse.id]);
  };

  const toggleHorseSelection = (id: string) => {
    setSelectedHorseIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const openEntryModal = (type: 'vacc' | 'service') => {
    setEditingItem(null);
    setIsBulkEntry(false);
    setSelectedHorseIds([horse.id]);
    setSelectedVaccTypes(['Influenza']);
    setEntryData({
      type: type === 'vacc' ? 'Influenza' : 'Hufschmied',
      date: new Date().toISOString().split('T')[0],
      vetName: '',
      provider: '',
      notes: '',
      sequence: 'Booster'
    });
    if (type === 'vacc') setShowVaccModal(true);
    else setShowServiceModal(true);
  };

  const toggleVaccType = (t: string) => {
    setSelectedVaccTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  };

  const [vaccSortBy, setVaccSortBy] = useState<'date' | 'type'>('date');
  const [serviceSortBy, setServiceSortBy] = useState<'date' | 'type'>('date');

  const vaccsByYear = useMemo(() => {
    const byYear = new Map<number, { date: string; vaccs: Vaccination[] }[]>();
    for (const v of horse.vaccinations) {
      const year = parseInt(v.date.slice(0, 4), 10);
      if (!byYear.has(year)) byYear.set(year, []);
      const list = byYear.get(year)!;
      const existing = list.find(x => x.date === v.date);
      if (existing) existing.vaccs.push(v);
      else list.push({ date: v.date, vaccs: [v] });
    }
    for (const arr of byYear.values()) arr.sort((a, b) => b.date.localeCompare(a.date));
    return Array.from(byYear.entries()).sort((a, b) => b[0] - a[0]).map(([year, items]) => ({ year, items }));
  }, [horse.vaccinations]);

  const servicesByYear = useMemo(() => {
    const byYear = new Map<number, { date: string; services: ServiceRecord[] }[]>();
    for (const s of horse.serviceHistory) {
      const year = parseInt(s.date.slice(0, 4), 10);
      if (!byYear.has(year)) byYear.set(year, []);
      const list = byYear.get(year)!;
      const existing = list.find(x => x.date === s.date);
      if (existing) existing.services.push(s);
      else list.push({ date: s.date, services: [s] });
    }
    for (const arr of byYear.values()) arr.sort((a, b) => b.date.localeCompare(a.date));
    return Array.from(byYear.entries()).sort((a, b) => b[0] - a[0]).map(([year, items]) => ({ year, items }));
  }, [horse.serviceHistory]);

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-500">
      {/* Header Nav */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <button onClick={onBack} className="flex items-center text-sm font-bold text-slate-500 hover:text-slate-800 group">
          <svg className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Stallübersicht
        </button>
        <div className="flex gap-2">
          <button onClick={() => setShowTransferModal(true)} className="px-4 py-2 text-indigo-600 text-xs font-bold bg-white border border-indigo-100 rounded-xl hover:bg-indigo-50 transition-all">Übertragen</button>
          <button onClick={() => setShowEditHorseMask(true)} className="px-4 py-2 text-slate-600 text-xs font-bold bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">Bearbeiten</button>
          <button onClick={() => setShowDeleteConfirm('horse')} className="px-4 py-2 text-rose-600 text-xs font-bold bg-white border border-rose-100 rounded-xl hover:bg-rose-50 transition-all">Löschen</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden group">
            <div className="relative h-56 overflow-hidden">
              <img src={horse.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={horse.name} onError={e => { (e.target as HTMLImageElement).src = HORSE_PLACEHOLDER_IMAGE; }} />
              <div className={`absolute top-4 right-4 px-3 py-1.5 rounded-full text-[10px] font-black text-white uppercase tracking-widest shadow-lg ${getStatusColor(compliance.status)}`}>{statusLabel}</div>
            </div>
            <div className="p-8 space-y-5">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{horse.name}</h2>
                <p className="text-sm text-slate-400 font-bold mt-1">{horse.breed || '—'}</p>
              </div>
              
              <div className="pt-5 border-t border-slate-50 space-y-3">
                <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ISO-Nr.</span><span className="font-mono text-xs text-slate-700 font-bold">{horse.isoNr}</span></div>
                <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">FEI-Nr.</span><span className="font-mono text-xs text-slate-700 font-bold">{horse.feiNr || '—'}</span></div>
                
                {showMoreInfo && (
                  <div className="pt-3 space-y-3 border-t border-slate-50 mt-3 animate-in slide-in-from-top-4">
                    <div className="flex justify-between"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Geburtsjahr</span><span className="text-xs font-bold text-slate-800">{horse.birthYear}</span></div>
                    <div className="flex justify-between"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chip-ID</span><span className="text-xs font-mono text-slate-800">{horse.chipId || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verband</span><span className="text-xs font-bold text-slate-800">{horse.breedingAssociation || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Geschlecht</span><span className="text-xs font-bold text-slate-800">{horse.gender ?? '—'}</span></div>
                    <div className="flex justify-between"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Farbe</span><span className="text-xs font-bold text-slate-800">{horse.color || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gewicht</span><span className="text-xs font-bold text-slate-800">{horse.weightKg != null ? `${horse.weightKg} kg` : '—'}</span></div>
                  </div>
                )}
                
                <button onClick={() => setShowMoreInfo(!showMoreInfo)} className="w-full mt-2 py-3 text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em] bg-indigo-50/50 hover:bg-indigo-50 rounded-2xl transition-all">
                  {showMoreInfo ? 'Weniger Details' : 'Mehr Details anzeigen'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Historie Panels */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-8 border-b border-slate-50">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">Impfhistorie</h3>
                  {compliance.allNextDue.length > 0 && (
                    <details className="mt-3 group">
                      <summary className="cursor-pointer text-sm text-slate-500 hover:text-indigo-600 font-medium list-none flex items-center gap-2">
                        <span className="group-open:rotate-90 transition-transform">▶</span>
                        Nächste Fälligkeiten pro Kategorie
                      </summary>
                      <ul className="mt-2 pl-5 space-y-1.5 text-sm">
                        {compliance.allNextDue.map((n, i) => (
                          <li key={i} className="flex flex-wrap items-baseline gap-2">
                            <span className={`inline-block w-2 h-2 rounded-full shrink-0 mt-1 ${getStatusColor(n.status)}`} />
                            <span className="font-semibold text-slate-800">{n.type} ({n.sequence}):</span>
                            <span className={n.status === ComplianceStatus.RED ? 'text-rose-600' : n.status === ComplianceStatus.YELLOW ? 'text-amber-600' : 'text-slate-600'}>
                              {n.status === ComplianceStatus.GREEN ? `Ab ${n.dueDate} fällig, spätestens bis ${n.graceEndDate}` : n.message}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
                <button onClick={() => openEntryModal('vacc')} className="px-5 py-2 text-xs font-black text-emerald-600 bg-emerald-50 rounded-2xl hover:bg-emerald-100 transition-all shrink-0">+ NEU</button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sortierung:</span>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button type="button" onClick={() => setVaccSortBy('date')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${vaccSortBy === 'date' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>Nach Datum</button>
                  <button type="button" onClick={() => setVaccSortBy('type')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${vaccSortBy === 'type' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>Nach Typ</button>
                </div>
              </div>

              {vaccsByYear.length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">Noch keine Impfungen eingetragen.</p>
              ) : (
                <div className="space-y-2">
                  {vaccsByYear.map(({ year, items }) => (
                    <details key={year} className="group bg-slate-50/50 rounded-2xl overflow-hidden border border-slate-100">
                      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none font-black text-slate-800 hover:bg-slate-100/50 transition-colors">
                        <span>{year}</span>
                        <span className="text-slate-400 text-xs group-open:rotate-180 transition-transform">▼</span>
                      </summary>
                      <div className="border-t border-slate-100">
                        {vaccSortBy === 'type' ? (
                          (() => {
                            const byType = new Map<string, Vaccination[]>();
                            for (const { vaccs } of items) for (const v of vaccs) {
                              const t = v.type || 'Influenza';
                              if (!byType.has(t)) byType.set(t, []);
                              byType.get(t)!.push(v);
                            }
                            return Array.from(byType.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([type, vaccs]) => (
                              <div key={type} className="px-5 py-3 border-b border-slate-50 last:border-0">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{type}</div>
                                <ul className="space-y-2">
                                  {vaccs.sort((a, b) => b.date.localeCompare(a.date)).map(v => (
                                    <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                                      <span className="text-sm font-medium text-slate-600">{v.date}</span>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-slate-800">{v.type} <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-2 py-0.5 rounded">{v.sequence}</span></span>
                                        {v.status === 'planned' && <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Geplant</span>}
                                        {v.status === 'planned' ? (
                                          <button type="button" onClick={() => { setEditingItem(v); setEntryData({ ...v, date: new Date().toISOString().split('T')[0], vetName: v.vetName ?? '', provider: '', notes: '' }); setShowVaccModal(true); }} className="text-xs font-bold text-emerald-600 hover:text-emerald-800">Aktivieren</button>
                                        ) : (
                                          <>
                                            <button type="button" onClick={() => { setEditingItem(v); setEntryData({...v}); setShowVaccModal(true); }} className="p-1.5 text-slate-300 hover:text-indigo-600 rounded-lg" title="Bearbeiten"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                            <button type="button" onClick={() => { setTargetId(v.id); setShowDeleteConfirm('vacc'); }} className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg" title="Löschen"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                          </>
                                        )}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ));
                          })()
                        ) : (
                          items.map(({ date, vaccs }) => (
                            <div key={date} className="px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-2 border-b border-slate-50 last:border-0">
                              <span className="text-sm font-medium text-slate-600 shrink-0 sm:w-28">{date}</span>
                              <div className="flex flex-wrap gap-x-4 gap-y-2">
                                {vaccs.map(v => {
                                  const isPlanned = v.status === 'planned';
                                  return (
                                    <span key={v.id} className="inline-flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-slate-800">{v.type} <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-2 py-1 rounded-md ml-1">{v.sequence}</span></span>
                                      {isPlanned && <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Geplant</span>}
                                      {isPlanned ? (
                                        <button type="button" onClick={e => { e.stopPropagation(); setEditingItem(v); setEntryData({ ...v, date: new Date().toISOString().split('T')[0], vetName: v.vetName ?? '', provider: '', notes: '' }); setShowVaccModal(true); }} className="text-xs font-bold text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 px-2 py-1 rounded-lg" title="Aktivieren">Aktivieren</button>
                                      ) : (
                                        <>
                                          <button type="button" onClick={e => { e.stopPropagation(); setEditingItem(v); setEntryData({...v}); setShowVaccModal(true); }} className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Bearbeiten"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                          <button type="button" onClick={e => { e.stopPropagation(); setTargetId(v.id); setShowDeleteConfirm('vacc'); }} className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Löschen"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                        </>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex flex-wrap items-center justify-between gap-4">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Behandlungen</h3>
              <div className="flex items-center gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sortierung:</span>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button type="button" onClick={() => setServiceSortBy('date')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${serviceSortBy === 'date' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>Nach Datum</button>
                    <button type="button" onClick={() => setServiceSortBy('type')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${serviceSortBy === 'type' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>Nach Typ</button>
                  </div>
                </div>
                <button onClick={() => openEntryModal('service')} className="px-5 py-2 text-xs font-black text-blue-600 bg-blue-50 rounded-2xl hover:bg-blue-100 transition-all shrink-0">+ NEU</button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              {servicesByYear.length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">Noch keine Behandlungen eingetragen.</p>
              ) : (
                <div className="space-y-2">
                  {servicesByYear.map(({ year, items }) => (
                    <details key={year} className="group bg-slate-50/50 rounded-2xl overflow-hidden border border-slate-100">
                      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none font-black text-slate-800 hover:bg-slate-100/50 transition-colors">
                        <span>{year}</span>
                        <span className="text-slate-400 text-xs group-open:rotate-180 transition-transform">▼</span>
                      </summary>
                      <div className="border-t border-slate-100">
                        {serviceSortBy === 'type' ? (
                          (() => {
                            const byType = new Map<string, ServiceRecord[]>();
                            for (const { services } of items) for (const s of services) {
                              const t = s.type;
                              if (!byType.has(t)) byType.set(t, []);
                              byType.get(t)!.push(s);
                            }
                            return Array.from(byType.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([type, services]) => (
                              <div key={type} className="px-5 py-3 border-b border-slate-50 last:border-0">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{type}</div>
                                <ul className="space-y-2">
                                  {services.sort((a, b) => b.date.localeCompare(a.date)).map(s => (
                                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                                      <span className="text-sm font-medium text-slate-600">{s.date}</span>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {s.provider && <span className="text-xs text-slate-500">{s.provider}</span>}
                                        <button type="button" onClick={() => { setEditingItem(s); setEntryData({...s}); setShowServiceModal(true); }} className="p-1.5 text-slate-300 hover:text-indigo-600 rounded-lg" title="Bearbeiten"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                        <button type="button" onClick={() => { setTargetId(s.id); setShowDeleteConfirm('service'); }} className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg" title="Löschen"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ));
                          })()
                        ) : (
                          items.map(({ date, services }) => (
                            <div key={date} className="px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-2 border-b border-slate-50 last:border-0">
                              <span className="text-sm font-medium text-slate-600 shrink-0 sm:w-28">{date}</span>
                              <div className="flex flex-wrap gap-x-4 gap-y-2">
                                {services.map(s => (
                                  <span key={s.id} className="inline-flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-slate-800">{s.type}</span>
                                    {s.provider && <span className="text-xs text-slate-500">({s.provider})</span>}
                                    <button type="button" onClick={e => { e.stopPropagation(); setEditingItem(s); setEntryData({...s}); setShowServiceModal(true); }} className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Bearbeiten"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                    <button type="button" onClick={e => { e.stopPropagation(); setTargetId(s.id); setShowDeleteConfirm('service'); }} className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Löschen"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full Edit Horse Mask (Modal) */}
      {showEditHorseMask && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[110] flex items-center justify-center p-3 sm:p-4 overflow-y-auto modal-overlay">
          {rimondoPreviewData && (
            <div className="fixed inset-0 z-[111] flex items-center justify-center p-4 bg-slate-900/60">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h4 className="text-lg font-bold text-slate-900">Rimondo-Daten übernehmen?</h4>
                <p className="text-sm text-slate-600">Sollen diese Daten in das Formular übernommen werden?</p>
                <dl className="space-y-1 text-sm bg-slate-50 rounded-xl p-4">
                  {rimondoPreviewData.name != null && <div className="flex justify-between gap-4"><dt className="text-slate-500">Name</dt><dd className="font-medium truncate">{rimondoPreviewData.name}</dd></div>}
                  {rimondoPreviewData.isoNr != null && <div className="flex justify-between gap-4"><dt className="text-slate-500">ISO-Nr.</dt><dd className="font-medium truncate">{rimondoPreviewData.isoNr}</dd></div>}
                  {rimondoPreviewData.breed != null && <div className="flex justify-between gap-4"><dt className="text-slate-500">Rasse</dt><dd className="font-medium truncate">{rimondoPreviewData.breed}</dd></div>}
                  {rimondoPreviewData.birthYear != null && <div className="flex justify-between gap-4"><dt className="text-slate-500">Geburtsjahr</dt><dd className="font-medium">{rimondoPreviewData.birthYear}</dd></div>}
                  {rimondoPreviewData.gender != null && <div className="flex justify-between gap-4"><dt className="text-slate-500">Geschlecht</dt><dd className="font-medium">{rimondoPreviewData.gender}</dd></div>}
                  {rimondoPreviewData.breedingAssociation != null && <div className="flex justify-between gap-4"><dt className="text-slate-500">Zuchtverband</dt><dd className="font-medium truncate">{rimondoPreviewData.breedingAssociation}</dd></div>}
                  {rimondoPreviewData.feiNr != null && <div className="flex justify-between gap-4"><dt className="text-slate-500">FEI-Nr.</dt><dd className="font-medium">{rimondoPreviewData.feiNr}</dd></div>}
                </dl>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setRimondoPreviewData(null)} className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200">Abbrechen</button>
                  <button type="button" onClick={() => { const d = rimondoPreviewData; setEditedHorse(prev => ({ ...prev, name: d.name ?? prev.name, isoNr: d.isoNr ?? prev.isoNr, feiNr: d.feiNr ?? prev.feiNr, breed: d.breed ?? prev.breed, birthYear: d.birthYear ?? prev.birthYear, breedingAssociation: d.breedingAssociation ?? prev.breedingAssociation, gender: d.gender ?? prev.gender })); setRimondoPreviewData(null); }} className="flex-1 py-3 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700">Übernehmen</button>
                </div>
              </div>
            </div>
          )}
          <form onSubmit={handleSaveHorse} className="bg-white rounded-2xl sm:rounded-[3rem] p-4 sm:p-10 max-w-2xl w-full max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200 space-y-4 sm:space-y-6 custom-scrollbar my-2 sm:my-auto modal-content">
            <h4 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight border-b border-slate-100 pb-4 sm:pb-6">Pferdedaten bearbeiten</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
              <div className="col-span-2 space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Pferdename</label><input type="text" value={editedHorse.name} onChange={e => setEditedHorse({...editedHorse, name: e.target.value})} className="w-full p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-base" /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">ISO-Nr. (UELN)</label><input type="text" value={editedHorse.isoNr} onChange={e => setEditedHorse({...editedHorse, isoNr: e.target.value})} className="w-full p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl outline-none text-base" /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">FEI-Nr.</label><input type="text" value={editedHorse.feiNr} onChange={e => setEditedHorse({...editedHorse, feiNr: e.target.value})} className="w-full p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl outline-none text-base" /></div>
              <div className="col-span-2 space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Profilbild</label>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 text-sm font-medium text-slate-700">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span>{imageUploading ? 'Wird hochgeladen…' : 'Foto aufnehmen / hochladen'}</span>
                    <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={imageUploading} onChange={async e => {
                      const f = e.target.files?.[0];
                      if (!f || !horse.ownerId) return;
                      setImageUploading(true);
                      try {
                        const url = await uploadHorseImage(f, horse.ownerId, horse.id);
                        setEditedHorse(prev => ({ ...prev, image: url }));
                      } catch (_) { /* TODO: toast */ }
                      finally { setImageUploading(false); e.target.value = ''; }
                    }} />
                  </label>
                </div>
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-100 hidden">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Rimondo</div>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input type="url" value={rimondoUrl} onChange={e => { setRimondoUrl(e.target.value); setRimondoError(null); }} placeholder="Rimondo-Profil-URL" className="flex-1 min-w-0 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                    <button type="button" onClick={async () => { if (!rimondo.isRimondoUrl(rimondoUrl)) return; setRimondoLoading(true); setRimondoPreviewData(null); setRimondoError(null); try { const d = await rimondo.fetchRimondoData(rimondoUrl); const hasData = d.name || d.breed || d.birthYear || d.gender || d.breedingAssociation || d.isoNr || d.feiNr; if (hasData) setRimondoPreviewData(d); else setRimondoError('Keine Pferdedaten auf der Rimondo-Seite gefunden.'); } catch { setRimondoError('Rimondo-Daten konnten nicht geladen werden.'); } finally { setRimondoLoading(false); } }} disabled={rimondoLoading || !rimondo.isRimondoUrl(rimondoUrl)} className="px-4 py-3 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 disabled:opacity-50 shrink-0">{rimondoLoading ? 'Laden…' : 'Von Rimondo laden'}</button>
                  </div>
                  {rimondoError && <p className="text-sm text-rose-600">{rimondoError}</p>}
                </div>
              </div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Geburtsjahr</label><input type="number" value={editedHorse.birthYear} onChange={e => setEditedHorse({...editedHorse, birthYear: parseInt(e.target.value, 10) || new Date().getFullYear()})} className="w-full p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl outline-none text-base" /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Zuchtverband</label><input type="text" value={editedHorse.breedingAssociation} onChange={e => setEditedHorse({...editedHorse, breedingAssociation: e.target.value})} className="w-full p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl outline-none text-base" /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Rasse</label><input type="text" value={editedHorse.breed} onChange={e => setEditedHorse({...editedHorse, breed: e.target.value})} className="w-full p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl outline-none text-base" /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Chip-ID</label><input type="text" value={editedHorse.chipId} onChange={e => setEditedHorse({...editedHorse, chipId: e.target.value})} className="w-full p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl outline-none text-base" /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Geschlecht</label><select value={editedHorse.gender ?? ''} onChange={e => setEditedHorse({...editedHorse, gender: (e.target.value || null) as Horse['gender']})} className="w-full p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl outline-none font-bold text-base"><option value="">—</option><option>Wallach</option><option>Stute</option><option>Hengst</option></select></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Gewicht (kg)</label><input type="number" value={editedHorse.weightKg ?? ''} onChange={e => { const v = e.target.value; setEditedHorse({...editedHorse, weightKg: v === '' ? null : parseInt(v, 10) || null}); }} className="w-full p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl outline-none text-base" placeholder="—" /></div>
            </div>
            <div className="flex gap-3 sm:gap-4 pt-4 sm:pt-6 border-t border-slate-100">
              <button type="button" onClick={() => { setEditedHorse(horse); setShowEditHorseMask(false); }} className="flex-1 py-3 sm:py-4 bg-slate-100 text-slate-700 font-black rounded-xl sm:rounded-2xl text-sm sm:text-base">Abbrechen</button>
              <button type="submit" className="flex-1 py-3 sm:py-4 bg-indigo-600 text-white font-black rounded-xl sm:rounded-2xl shadow-xl shadow-indigo-100 text-sm sm:text-base">Daten speichern</button>
            </div>
          </form>
        </div>
      )}

      {/* Lösch-Bestätigung */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[105] flex items-center justify-center p-4 modal-overlay">
          <div className="bg-white rounded-2xl sm:rounded-[2.5rem] p-6 sm:p-10 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 space-y-4 sm:space-y-6 modal-content">
            <h4 className="text-xl font-black text-slate-900">
              {showDeleteConfirm === 'horse' && 'Pferd löschen?'}
              {showDeleteConfirm === 'vacc' && 'Impfung löschen?'}
              {showDeleteConfirm === 'service' && 'Behandlung löschen?'}
            </h4>
            <p className="text-slate-600">
              {showDeleteConfirm === 'horse' && 'Dieses Pferd und alle zugehörigen Daten werden unwiderruflich gelöscht.'}
              {showDeleteConfirm === 'vacc' && 'Diesen Impfeintrag unwiderruflich löschen?'}
              {showDeleteConfirm === 'service' && 'Diesen Behandlungs-Eintrag unwiderruflich löschen?'}
            </p>
            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => { setShowDeleteConfirm(null); setTargetId(null); }} className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all">Abbrechen</button>
              <button type="button" onClick={confirmDelete} className="flex-1 py-4 bg-rose-600 text-white font-bold rounded-2xl hover:bg-rose-700 transition-all">Löschen</button>
            </div>
          </div>
        </div>
      )}

      {/* Entry Modal (Impfung/Behandlung) */}
      {(showVaccModal || showServiceModal) && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto modal-overlay">
          <form onSubmit={handleEntrySubmit} className="bg-white rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-10 max-w-lg w-full max-w-[min(100vw-1rem,32rem)] shadow-2xl animate-in zoom-in-95 duration-200 space-y-4 sm:space-y-6 max-h-[calc(100dvh-2rem)] overflow-y-auto custom-scrollbar my-2 sm:my-auto modal-content">
            <h4 className="text-2xl font-black text-slate-900">
              {showVaccModal && editingItem && (editingItem as Vaccination).status === 'planned'
                ? 'Impfung aktivieren'
                : editingItem ? 'Eintrag bearbeiten' : (showVaccModal ? 'Neue Impfung' : 'Neue Behandlung')}
            </h4>
            {showVaccModal && editingItem && (editingItem as Vaccination).status === 'planned' && (
              <p className="text-sm text-slate-500 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">Impfung durchgeführt? Datum prüfen, bestätigen und aktivieren.</p>
            )}
            {showVaccModal && !editingItem && (
              <p className="text-sm text-slate-500 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                <strong>Vollständige Serie</strong> (V1→V2→V3→Booster): Das Pferd ist bereits nach V2 konform (auch ohne V3/Booster); V3- und Booster-Fälligkeit bleiben bestehen. <strong>Nur letzter Booster</strong>: Ein Eintrag pro Kategorie mit Sequenz „Booster“; Fälligkeit = Datum + 6 Mon. + 21 Tage.
              </p>
            )}
            {!editingItem && (
              <label className="flex items-center gap-4 p-4 bg-slate-50 rounded-[1.5rem] cursor-pointer hover:bg-slate-100 transition-all border border-slate-100">
                <input type="checkbox" checked={isBulkEntry} onChange={e => setIsBulkEntry(e.target.checked)} className="w-6 h-6 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm font-black text-slate-700">Als Sammeleintrag erfassen?</span>
              </label>
            )}
            {isBulkEntry && !editingItem && (
              <div className="p-5 bg-indigo-50 rounded-3xl border border-indigo-100 space-y-4">
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">Mitbetroffene Pferde wählen</label>
                <div className="grid grid-cols-2 gap-2">
                  {allHorses.map(h => (
                    <button key={h.id} type="button" onClick={() => toggleHorseSelection(h.id)} className={`flex items-center gap-2 p-2 rounded-xl border-2 transition-all ${selectedHorseIds.includes(h.id) ? 'bg-white border-indigo-600 shadow-sm' : 'bg-slate-50 border-transparent text-slate-400'}`}>
                      <img src={h.image} className="w-7 h-7 rounded-full object-cover" alt={h.name} /><span className="text-xs font-bold truncate">{h.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Kategorie</label>
                {showVaccModal && !editingItem ? (
                  <div className="flex flex-wrap gap-2">
                    {['Influenza', 'Herpes', 'Tetanus', 'West-Nil-Virus'].map(t => (
                      <label key={t} className={`inline-flex items-center gap-2 px-4 py-3 rounded-2xl border-2 cursor-pointer transition-all ${selectedVaccTypes.includes(t) ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}>
                        <input type="checkbox" checked={selectedVaccTypes.includes(t)} onChange={() => toggleVaccType(t)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-sm font-bold text-slate-800">{t}</span>
                      </label>
                    ))}
                  </div>
                ) : showVaccModal && editingItem ? (
                  <input readOnly value={entryData.type} className="w-full p-3 sm:p-4 bg-slate-100 border border-slate-200 rounded-xl sm:rounded-2xl font-bold text-slate-700 text-base" />
                ) : (
                  <select value={entryData.type} onChange={e => setEntryData({...entryData, type: e.target.value})} className="w-full p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl outline-none font-bold text-base">
                    <option>Hufschmied</option><option>Entwurmung</option><option>Zahnarzt</option><option>Physio</option><option>Sonstiges</option>
                  </select>
                )}
              </div>
              {showVaccModal && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Impf-Sequenz</label>
                  {editingItem && (editingItem as Vaccination).status === 'planned' ? (
                    <input readOnly value={entryData.sequence ?? '—'} className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl font-bold text-slate-700" />
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {[{ id: 'V1', label: 'V1', hint: '1. Grundimm.' }, { id: 'V2', label: 'V2', hint: '2. Grundimm. (28–70 Tage)' }, { id: 'V3', label: 'V3', hint: '6 Mon. + 21 Tage nach V2' }, { id: 'Booster', label: 'Booster', hint: '6 Mon. + 21 Tage nach V3; oder nur letzter Booster' }].map(seq => (
                        <button key={seq.id} type="button" onClick={() => setEntryData({...entryData, sequence: seq.id as any})} className={`p-3 rounded-2xl border-2 text-left transition-all ${entryData.sequence === seq.id ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-slate-100 bg-white'}`}><p className="font-black text-xs">{seq.label}</p><p className="text-[9px] text-slate-400 leading-tight">{seq.hint}</p></button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Datum</label>
                <input type="date" max={todayStr()} value={entryData.date} onChange={e => setEntryData({...entryData, date: e.target.value})} className="w-full p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl outline-none text-base" required title="Keine zukünftigen Daten" />
                {entryData.date > todayStr() && <p className="text-xs text-rose-600 mt-1">Nur Datum heute oder in der Vergangenheit.</p>}
              </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">{showVaccModal ? 'Tierarzt' : 'Dienstleister'}</label>
                  <input type="text" value={showVaccModal ? entryData.vetName : entryData.provider} onChange={e => setEntryData({...entryData, [showVaccModal ? 'vetName' : 'provider']: e.target.value})} className="w-full p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl outline-none text-base" placeholder="Name..." />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(showVaccModal ? suggestions.vets : suggestions.providers).map(s => (
                      <button key={s} type="button" onClick={() => setEntryData({...entryData, [showVaccModal ? 'vetName' : 'provider']: s})} className="text-[9px] font-black bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full hover:bg-indigo-600 hover:text-white transition-all">{s}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-4 pt-4 border-t border-slate-50">
              <button type="button" onClick={() => { setShowVaccModal(false); setShowServiceModal(false); setEditingItem(null); }} className="flex-1 py-4 bg-slate-100 text-slate-700 font-black rounded-2xl">Abbrechen</button>
              <button
                type="submit"
                disabled={showVaccModal && !editingItem && selectedVaccTypes.length === 0}
                className={`flex-1 py-4 font-black rounded-2xl shadow-xl disabled:opacity-50 disabled:cursor-not-allowed ${
                  showVaccModal && editingItem && (editingItem as Vaccination).status === 'planned'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {showVaccModal && editingItem && (editingItem as Vaccination).status === 'planned' ? 'Aktivieren' : 'Speichern'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete/Transfer/etc Modals follow same styling... */}
    </div>
  );
};
