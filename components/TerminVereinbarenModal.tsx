import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { Horse, ComplianceStatus, Profile } from '../types';
import { checkVaccinationCompliance, getStatusColor, VACC_TYPES } from '../logic';
import type { DueItem } from '../logic';
import * as auth from '../services/authService';
import * as appointmentRequestService from '../services/appointmentRequestService';
import { supabase } from '../services/supabase';

interface TerminVereinbarenModalProps {
  horses: Horse[];
  profile: Profile | null;
  onClose: () => void;
}

function dueItemKey(d: DueItem): string {
  return `${d.type}|${d.sequence}`;
}

export const TerminVereinbarenModal: React.FC<TerminVereinbarenModalProps> = ({
  horses,
  profile,
  onClose,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedCategoriesByHorse, setSelectedCategoriesByHorse] = useState<Record<string, string[]>>({});
  const [selectedDueItemKeysByHorse, setSelectedDueItemKeysByHorse] = useState<Record<string, string[]>>({});
  const [vetQuery, setVetQuery] = useState('');
  const [selectedVetId, setSelectedVetId] = useState<string | null>(null);
  const [allVets, setAllVets] = useState<auth.VetSearchResult[]>([]);
  const [vetsLoading, setVetsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const vetResults = useMemo(
    () => auth.filterVets(allVets, vetQuery),
    [allVets, vetQuery]
  );

  const dueHorses = useMemo(() => {
    return horses.filter((h) => {
      const c = checkVaccinationCompliance(h);
      return c.status === ComplianceStatus.YELLOW || c.status === ComplianceStatus.RED;
    });
  }, [horses]);

  const toggleHorse = useCallback((id: string) => {
    const horse = dueHorses.find((h) => h.id === id);
    if (!horse) return;
    const c = checkVaccinationCompliance(horse);
    const noData = c.dueItems.length === 0;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setSelectedCategoriesByHorse((s) => { const u = { ...s }; delete u[id]; return u; });
        setSelectedDueItemKeysByHorse((s) => { const u = { ...s }; delete u[id]; return u; });
        return next;
      }
      next.add(id);
      if (noData) {
        setSelectedCategoriesByHorse((s) => ({ ...s, [id]: [...VACC_TYPES] }));
      } else {
        setSelectedDueItemKeysByHorse((s) => ({
          ...s,
          [id]: c.dueItems.map(dueItemKey),
        }));
      }
      return next;
    });
  }, [dueHorses]);

  const toggleCategory = useCallback((horseId: string, cat: string) => {
    setSelectedCategoriesByHorse((prev) => {
      const arr = prev[horseId] ?? [];
      const next = arr.includes(cat) ? arr.filter((x) => x !== cat) : [...arr, cat];
      return { ...prev, [horseId]: next };
    });
  }, []);

  const toggleDueItemKey = useCallback((horseId: string, key: string) => {
    setSelectedDueItemKeysByHorse((prev) => {
      const arr = prev[horseId] ?? [];
      const next = arr.includes(key) ? arr.filter((x) => x !== key) : [...arr, key];
      return { ...prev, [horseId]: next };
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size === dueHorses.length) {
      setSelectedIds(new Set());
      setSelectedCategoriesByHorse({});
      setSelectedDueItemKeysByHorse({});
      return;
    }
    setSelectedIds(new Set(dueHorses.map((h) => h.id)));
    const cats: Record<string, string[]> = {};
    const keys: Record<string, string[]> = {};
    for (const h of dueHorses) {
      const c = checkVaccinationCompliance(h);
      if (c.dueItems.length === 0) cats[h.id] = [...VACC_TYPES];
      else keys[h.id] = c.dueItems.map(dueItemKey);
    }
    setSelectedCategoriesByHorse(cats);
    setSelectedDueItemKeysByHorse(keys);
  }, [dueHorses, selectedIds.size]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!cancelled && user?.email) setUserEmail(user.email);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setVetsLoading(true);
    auth.listVets().then((list) => {
      if (!cancelled) {
        setAllVets(list);
        setVetsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const buildPayload = useCallback((): appointmentRequestService.AppointmentRequestPayload['horses'] => {
    const out: appointmentRequestService.AppointmentRequestPayload['horses'] = [];
    for (const horse of dueHorses) {
      if (!selectedIds.has(horse.id)) continue;
      const c = checkVaccinationCompliance(horse);
      const noData = c.dueItems.length === 0;
      const cats = selectedCategoriesByHorse[horse.id] ?? [];
      const keys = selectedDueItemKeysByHorse[horse.id] ?? [];
      if (noData && cats.length === 0) continue;
      if (!noData && keys.length === 0) continue;
      const base = {
        horseId: horse.id,
        name: horse.name,
        isoNr: horse.isoNr,
        chipId: horse.chipId ?? '—',
        breed: horse.breed ?? '—',
        birthYear: horse.birthYear,
        noVaccData: noData,
      };
      if (noData) {
        out.push({ ...base, selectedCategories: cats });
      } else {
        const items = c.dueItems.filter((d) => keys.includes(dueItemKey(d)));
        out.push({
          ...base,
          selectedDueItems: items.map((d) => ({ type: d.type, sequence: d.sequence, message: d.message })),
        });
      }
    }
    return out;
  }, [dueHorses, selectedIds, selectedCategoriesByHorse, selectedDueItemKeysByHorse]);

  const payloadHorses = useMemo(() => buildPayload(), [buildPayload]);
  const canSend = selectedVetId != null && profile?.id && payloadHorses.length > 0;

  const sendRequest = useCallback(async () => {
    if (!canSend || !profile) return;
    const vet = allVets.find((v) => v.id === selectedVetId);
    setSendLoading(true);
    setSendSuccess(false);
    try {
      const vetId = selectedVetId!;
      const created = await appointmentRequestService.createAppointmentRequest(profile.id, vetId, {
        owner: {
          firstName: profile.first_name ?? '',
          lastName: profile.last_name ?? '',
          stallName: profile.stall_name ?? null,
          zip: profile.zip ?? null,
          email: userEmail ?? null,
        },
        vet: vet ? { practiceName: vet.practice_name ?? null, zip: vet.zip ?? null } : undefined,
        horses: payloadHorses,
      });
      setSendSuccess(true);
      setSelectedVetId(null);
      try {
        await supabase.functions.invoke('notify-vet-request', { body: { requestId: created.id, vetId } });
      } catch (_) { /* optional; Edge Function ggf. nicht deployed */ }
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Anfrage konnte nicht gesendet werden. Bitte erneut versuchen.');
    } finally {
      setSendLoading(false);
    }
  }, [canSend, profile, selectedVetId, userEmail, payloadHorses, allVets]);

  const exportPdf = useCallback(() => {
    const toExport = payloadHorses;
    if (toExport.length === 0) return;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.getPageWidth();
    const margin = 20;
    const maxW = pageW - margin * 2;
    let y = 18;
    const lineH = 6;

    const push = (text: string, opts?: { font?: 'bold'; size?: number }) => {
      doc.setFontSize(opts?.size ?? 10);
      doc.setFont('helvetica', opts?.font === 'bold' ? 'bold' : 'normal');
      const lines = doc.splitTextToSize(text, maxW);
      doc.text(lines, margin, y);
      y += lines.length * lineH;
    };

    push('Impfübersicht für Tierarzt', { font: 'bold', size: 14 });
    y += 4;
    const d = new Date();
    push(`Erstellt am ${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`);
    y += 6;

    push('Meine Daten', { font: 'bold' });
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || '—';
    push(`Name: ${name}`);
    push(`Stall / Betrieb: ${profile?.stall_name ?? '—'}`);
    push(`PLZ: ${profile?.zip ?? '—'}`);
    if (userEmail) push(`E-Mail: ${userEmail}`);
    y += 6;

    for (const h of toExport) {
      if (y > 260) {
        doc.addPage();
        y = 18;
      }
      push(h.name, { font: 'bold' });
      push(`ISO-Nr. (UELN): ${h.isoNr}`);
      if (h.chipId && h.chipId !== '—') push(`Chip-ID: ${h.chipId}`);
      push(`Rasse: ${h.breed}`);
      push(`Geburtsjahr: ${h.birthYear}`);
      push('Benötigte Impfungen:');
      if (h.noVaccData && h.selectedCategories?.length) {
        for (const cat of h.selectedCategories) push(`• Impfung: ${cat}`, { size: 9 });
      } else if (h.selectedDueItems?.length) {
        for (const di of h.selectedDueItems) push(`• ${di.message}`, { size: 9 });
      }
      y += 4;
    }

    doc.save('EquiManage-Impfuebersicht-Tierarzt.pdf');
  }, [profile, userEmail, payloadHorses]);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose} role="presentation">
      <div
        className="bg-white rounded-[2.5rem] max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-8 py-5">
          <h3 className="text-xl font-black text-slate-900">Termin vereinbaren</h3>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          <section>
            <p className="text-sm text-slate-600 mb-3">
              Wähle die Pferde, die beim angefragten Termin geimpft werden sollen (Status fällig bzw. kritisch). Pro Pferd kannst du Impfkategorien bzw. fällige Impfungen einzeln auswählen.
            </p>
            {dueHorses.length === 0 ? (
              <p className="text-slate-500 py-6 text-center">Derzeit sind keine Pferde mit fälligen oder kritischen Impfungen vorhanden.</p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 mb-2"
                >
                  {selectedIds.size === dueHorses.length ? 'Alle abwählen' : 'Alle auswählen'}
                </button>
                <ul className="space-y-3">
                  {dueHorses.map((horse) => {
                    const c = checkVaccinationCompliance(horse);
                    const checked = selectedIds.has(horse.id);
                    const noData = c.dueItems.length === 0;
                    const cats = selectedCategoriesByHorse[horse.id] ?? [];
                    const keys = selectedDueItemKeysByHorse[horse.id] ?? [];
                    return (
                      <li
                        key={horse.id}
                        className={`border-2 rounded-2xl overflow-hidden transition-all ${checked ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`}
                      >
                        <div
                          className="p-4 cursor-pointer flex items-start gap-3"
                          onClick={() => toggleHorse(horse.id)}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            readOnly
                            tabIndex={-1}
                            className="mt-1 w-4 h-4 rounded border-slate-300 text-indigo-600 pointer-events-none"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900">{horse.name}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${getStatusColor(c.status)}`}>
                                {c.status === ComplianceStatus.RED ? 'kritisch' : 'fällig'}
                              </span>
                            </div>
                            {!noData && (
                              <ul className="mt-1.5 space-y-0.5 text-sm text-slate-600">
                                {c.dueItems.map((di, j) => (
                                  <li key={j}>{di.message}</li>
                                ))}
                              </ul>
                            )}
                            {noData && (
                              <p className="mt-1 text-xs text-slate-500">Keine Impfdaten hinterlegt.</p>
                            )}
                          </div>
                        </div>
                        {checked && (
                          <div
                            className="border-t border-indigo-100 bg-white/80 px-4 pb-4 pt-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                              {noData ? 'Impfkategorien auswählen' : 'Fällige / kritische Impfungen auswählen'}
                            </p>
                            {noData ? (
                              <div className="flex flex-wrap gap-2">
                                {VACC_TYPES.map((t) => (
                                  <label
                                    key={t}
                                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer transition-all text-sm font-medium ${
                                      cats.includes(t) ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={cats.includes(t)}
                                      onChange={() => toggleCategory(horse.id, t)}
                                      className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600"
                                    />
                                    <span>{t}</span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {c.dueItems.map((di) => {
                                  const key = dueItemKey(di);
                                  const sel = keys.includes(key);
                                  return (
                                    <label
                                      key={key}
                                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer transition-all text-sm max-w-full ${
                                        sel ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={sel}
                                        onChange={() => toggleDueItemKey(horse.id, key)}
                                        className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 shrink-0"
                                      />
                                      <span className="truncate">{di.message}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          <section className="border-t border-slate-100 pt-6">
            <h4 className="text-sm font-bold text-slate-800 mb-2">Tierarzt suchen</h4>
            <p className="text-xs text-slate-500 mb-3">Nach Postleitzahl oder Praxis- bzw. Firmennamen suchen. Klicke einen Eintrag, um die Anfrage an diesen Tierarzt zu senden.</p>
            <input
              type="text"
              value={vetQuery}
              onChange={(e) => { setVetQuery(e.target.value); setSelectedVetId(null); }}
              placeholder="PLZ oder Name der Praxis"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {vetsLoading && <p className="text-xs text-slate-400 mt-1">Tierärzte werden geladen…</p>}
            {!vetsLoading && vetQuery.trim().length >= 1 && (
              <ul className="mt-2 space-y-1">
                {vetResults.length === 0 ? (
                  <li className="text-sm text-slate-500 py-2">Keine Tierärzte gefunden.</li>
                ) : (
                  vetResults.map((v) => (
                    <li
                      key={v.id}
                      onClick={() => setSelectedVetId((prev) => (prev === v.id ? null : v.id))}
                      className={`flex justify-between items-center p-3 rounded-xl text-sm cursor-pointer transition-all ${
                        selectedVetId === v.id ? 'bg-indigo-100 border-2 border-indigo-500' : 'bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <span className="font-medium text-slate-800">{v.practice_name || '—'}</span>
                      <span className="text-slate-500">{v.zip || '—'}</span>
                    </li>
                  ))
                )}
              </ul>
            )}
            {canSend && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={sendRequest}
                  disabled={sendLoading}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {sendLoading ? 'Wird gesendet…' : 'Anfrage senden'}
                </button>
                {sendSuccess && <span className="text-sm font-medium text-emerald-600">Anfrage wurde gesendet.</span>}
              </div>
            )}
          </section>

          <section className="border-t border-slate-100 pt-6">
            <h4 className="text-sm font-bold text-slate-800 mb-2">Keinen Tierarzt gefunden?</h4>
            <p className="text-xs text-slate-500 mb-3">
              Exportiere ein PDF mit deinen Kontaktdaten und den für die Impfung relevanten Pferdedaten. Du kannst es deinem Tierarzt z. B. per E-Mail schicken.
            </p>
            <button
              type="button"
              onClick={exportPdf}
              disabled={payloadHorses.length === 0}
              className="px-5 py-3 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title={payloadHorses.length === 0 ? 'Bitte Pferde auswählen und pro Pferd mindestens eine Impfkategorie bzw. Impfung ankreuzen.' : undefined}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              PDF exportieren
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};
