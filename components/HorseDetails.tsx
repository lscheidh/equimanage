
import React, { useState, useMemo, useEffect } from 'react';
import { Horse, Vaccination, ServiceRecord, ServiceType, ComplianceStatus } from '../types';
import { checkVaccinationCompliance, getStatusColor, getStatusLabel } from '../logic';
import { uploadHorseImage, HORSE_PLACEHOLDER_IMAGE } from '../services/horseImageService';

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
  useEffect(() => { if (!showEditHorseMask) setEditedHorse(horse); }, [horse, showEditHorseMask]);

  const [entryData, setEntryData] = useState({
    type: 'Influenza',
    date: new Date().toISOString().split('T')[0],
    vetName: '',
    provider: '',
    notes: '',
    sequence: 'Booster' as any
  });

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

  const handleEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ids = isBulkEntry ? selectedHorseIds : [horse.id];
    
    if (showVaccModal) {
      if (editingItem) onUpdateVaccination(horse.id, { ...editingItem, ...entryData, isBooster: entryData.sequence === 'Booster' });
      else onBulkAddVaccination(ids, { ...entryData, isBooster: entryData.sequence === 'Booster', status: 'pending' });
      setShowVaccModal(false);
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
                <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reg.-Nr.</span><span className="font-mono text-xs text-slate-700 font-bold">{horse.feiNr || '—'}</span></div>
                
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
            <div className="p-8 border-b border-slate-50 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Impfhistorie</h3>
              <button onClick={() => openEntryModal('vacc')} className="px-5 py-2 text-xs font-black text-emerald-600 bg-emerald-50 rounded-2xl hover:bg-emerald-100 transition-all">+ NEU</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest"><tr><th className="px-8 py-4">Datum</th><th className="px-8 py-4">Typ / Sequenz</th><th className="px-8 py-4 text-right">Aktion</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {horse.vaccinations.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50/50 group transition-colors">
                      <td className="px-8 py-5 text-sm font-medium text-slate-600">{v.date}</td>
                      <td className="px-8 py-5 font-bold text-slate-800">{v.type} <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-2 py-1 rounded-md ml-2">{v.sequence}</span></td>
                      <td className="px-8 py-5 text-right space-x-1">
                        <button onClick={() => { setEditingItem(v); setEntryData({...v}); setShowVaccModal(true); }} className="p-2.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => { setTargetId(v.id); setShowDeleteConfirm('vacc'); }} className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Behandlungen</h3>
              <button onClick={() => openEntryModal('service')} className="px-5 py-2 text-xs font-black text-blue-600 bg-blue-50 rounded-2xl hover:bg-blue-100 transition-all">+ NEU</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest"><tr><th className="px-8 py-4">Datum</th><th className="px-8 py-4">Typ</th><th className="px-8 py-4 text-right">Aktion</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {horse.serviceHistory.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/50 group transition-colors">
                      <td className="px-8 py-5 text-sm font-medium text-slate-600">{s.date}</td>
                      <td className="px-8 py-5 font-bold text-slate-800">{s.type}</td>
                      <td className="px-8 py-5 text-right space-x-1">
                        <button onClick={() => { setEditingItem(s); setEntryData({...s}); setShowServiceModal(true); }} className="p-2.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => { setTargetId(s.id); setShowDeleteConfirm('service'); }} className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Full Edit Horse Mask (Modal) */}
      {showEditHorseMask && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <form onSubmit={handleSaveHorse} className="bg-white rounded-[3rem] p-10 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h4 className="text-3xl font-black text-slate-900 tracking-tight border-b border-slate-100 pb-6">Pferdedaten bearbeiten</h4>
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2 space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Pferdename</label><input type="text" value={editedHorse.name} onChange={e => setEditedHorse({...editedHorse, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" /></div>
              <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">ISO-Nr. (UELN)</label><input type="text" value={editedHorse.isoNr} onChange={e => setEditedHorse({...editedHorse, isoNr: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" /></div>
              <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Reg.-Nr.</label><input type="text" value={editedHorse.feiNr} onChange={e => setEditedHorse({...editedHorse, feiNr: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" /></div>
              <div className="col-span-2 space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Profilbild</label>
                <input type="url" value={editedHorse.image} onChange={e => setEditedHorse({...editedHorse, image: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" placeholder="URL oder Foto hochladen" />
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
              <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Geburtsjahr</label><input type="number" value={editedHorse.birthYear} onChange={e => setEditedHorse({...editedHorse, birthYear: parseInt(e.target.value, 10) || new Date().getFullYear()})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" /></div>
              <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Zuchtverband</label><input type="text" value={editedHorse.breedingAssociation} onChange={e => setEditedHorse({...editedHorse, breedingAssociation: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" /></div>
              <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Rasse</label><input type="text" value={editedHorse.breed} onChange={e => setEditedHorse({...editedHorse, breed: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" /></div>
              <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Chip-ID</label><input type="text" value={editedHorse.chipId} onChange={e => setEditedHorse({...editedHorse, chipId: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" /></div>
              <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Geschlecht</label><select value={editedHorse.gender ?? ''} onChange={e => setEditedHorse({...editedHorse, gender: (e.target.value || null) as Horse['gender']})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold"><option value="">—</option><option>Wallach</option><option>Stute</option><option>Hengst</option></select></div>
              <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Gewicht (kg)</label><input type="number" value={editedHorse.weightKg ?? ''} onChange={e => { const v = e.target.value; setEditedHorse({...editedHorse, weightKg: v === '' ? null : parseInt(v, 10) || null}); }} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" placeholder="—" /></div>
            </div>
            <div className="flex gap-4 pt-6 border-t border-slate-100">
              <button type="button" onClick={() => { setEditedHorse(horse); setShowEditHorseMask(false); }} className="flex-1 py-4 bg-slate-100 text-slate-700 font-black rounded-2xl">Abbrechen</button>
              <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100">Daten speichern</button>
            </div>
          </form>
        </div>
      )}

      {/* Lösch-Bestätigung */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[105] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 space-y-6">
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <form onSubmit={handleEntrySubmit} className="bg-white rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200 space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h4 className="text-2xl font-black text-slate-900">{editingItem ? 'Eintrag bearbeiten' : (showVaccModal ? 'Neue Impfung' : 'Neue Behandlung')}</h4>
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
                <select value={entryData.type} onChange={e => setEntryData({...entryData, type: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold">
                  {showVaccModal ? (<><option>Influenza</option><option>Herpes</option><option>Tetanus</option><option>West-Nil-Virus</option></>) : (<><option>Hufschmied</option><option>Entwurmung</option><option>Zahnarzt</option><option>Physio</option><option>Sonstiges</option></>)}
                </select>
              </div>
              {showVaccModal && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Impf-Sequenz</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[{ id: 'V1', label: 'V1', hint: '1. Grundimm.' }, { id: 'V2', label: 'V2', hint: '2. Grundimm. (28–70 Tage)' }, { id: 'V3', label: 'V3', hint: '6 Mon. + 21 Tage nach V2' }, { id: 'Booster', label: 'Booster', hint: '6 Mon. + 21 Tage nach V3' }].map(seq => (
                      <button key={seq.id} type="button" onClick={() => setEntryData({...entryData, sequence: seq.id as any})} className={`p-3 rounded-2xl border-2 text-left transition-all ${entryData.sequence === seq.id ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-slate-100 bg-white'}`}><p className="font-black text-xs">{seq.label}</p><p className="text-[9px] text-slate-400 leading-tight">{seq.hint}</p></button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Datum</label><input type="date" value={entryData.date} onChange={e => setEntryData({...entryData, date: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" required /></div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">{showVaccModal ? 'Tierarzt' : 'Dienstleister'}</label>
                  <input type="text" value={showVaccModal ? entryData.vetName : entryData.provider} onChange={e => setEntryData({...entryData, [showVaccModal ? 'vetName' : 'provider']: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" placeholder="Name..." />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(showVaccModal ? suggestions.vets : suggestions.providers).map(s => (
                      <button key={s} type="button" onClick={() => setEntryData({...entryData, [showVaccModal ? 'vetName' : 'provider']: s})} className="text-[9px] font-black bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full hover:bg-indigo-600 hover:text-white transition-all">{s}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-4 pt-4 border-t border-slate-50">
              <button type="button" onClick={() => { setShowVaccModal(false); setShowServiceModal(false); }} className="flex-1 py-4 bg-slate-100 text-slate-700 font-black rounded-2xl">Abbrechen</button>
              <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl">Speichern</button>
            </div>
          </form>
        </div>
      )}

      {/* Delete/Transfer/etc Modals follow same styling... */}
    </div>
  );
};
