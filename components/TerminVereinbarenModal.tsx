import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { Horse, ComplianceStatus, Profile } from '../types';
import { checkVaccinationCompliance, getStatusColor } from '../logic';
import * as auth from '../services/authService';
import { supabase } from '../services/supabase';

interface TerminVereinbarenModalProps {
  horses: Horse[];
  profile: Profile | null;
  onClose: () => void;
}

export const TerminVereinbarenModal: React.FC<TerminVereinbarenModalProps> = ({
  horses,
  profile,
  onClose,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [vetQuery, setVetQuery] = useState('');
  const [allVets, setAllVets] = useState<auth.VetSearchResult[]>([]);
  const [vetsLoading, setVetsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

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
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size === dueHorses.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(dueHorses.map((h) => h.id)));
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

  const exportPdf = useCallback(() => {
    const toExport = dueHorses.filter((h) => selectedIds.has(h.id));
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

    for (const horse of toExport) {
      if (y > 260) {
        doc.addPage();
        y = 18;
      }
      const c = checkVaccinationCompliance(horse);
      push(horse.name, { font: 'bold' });
      push(`ISO-Nr. (UELN): ${horse.isoNr}`);
      if (horse.chipId && horse.chipId !== '—') push(`Chip-ID: ${horse.chipId}`);
      push(`Rasse: ${horse.breed || '—'}`);
      push(`Geburtsjahr: ${horse.birthYear}`);
      push('Benötigte Impfungen:');
      for (const di of c.dueItems) {
        push(`• ${di.message}`, { size: 9 });
      }
      y += 4;
    }

    doc.save('EquiManage-Impfuebersicht-Tierarzt.pdf');
  }, [profile, userEmail, dueHorses, selectedIds]);

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
              Wähle die Pferde, die beim angefragten Termin geimpft werden sollen (Status fällig bzw. kritisch).
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
                    return (
                      <li
                        key={horse.id}
                        className={`border-2 rounded-2xl p-4 transition-all cursor-pointer ${checked ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`}
                        onClick={() => toggleHorse(horse.id)}
                      >
                        <div className="flex items-start gap-3">
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
                            <ul className="mt-1.5 space-y-0.5 text-sm text-slate-600">
                              {c.dueItems.map((di, j) => (
                                <li key={j}>{di.message}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          <section className="border-t border-slate-100 pt-6">
            <h4 className="text-sm font-bold text-slate-800 mb-2">Tierarzt suchen</h4>
            <p className="text-xs text-slate-500 mb-3">Nach Postleitzahl oder Praxis- bzw. Firmennamen suchen.</p>
            <input
              type="text"
              value={vetQuery}
              onChange={(e) => setVetQuery(e.target.value)}
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
                    <li key={v.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl text-sm">
                      <span className="font-medium text-slate-800">{v.practice_name || '—'}</span>
                      <span className="text-slate-500">{v.zip || '—'}</span>
                    </li>
                  ))
                )}
              </ul>
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
              disabled={selectedIds.size === 0}
              className="px-5 py-3 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title={selectedIds.size === 0 ? 'Bitte zuerst Pferde auswählen.' : undefined}
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
