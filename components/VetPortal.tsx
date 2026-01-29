import React, { useCallback, useEffect, useState } from 'react';
import type { Profile } from '../types';
import * as appointmentRequestService from '../services/appointmentRequestService';

interface VetPortalProps {
  profile: Profile;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const VetPortal: React.FC<VetPortalProps> = ({ profile }) => {
  const [requests, setRequests] = useState<appointmentRequestService.AppointmentRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const list = await appointmentRequestService.listAppointmentRequestsForVet(profile.id);
      setRequests(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const detail = detailId ? requests.find((r) => r.id === detailId) : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Terminanfragen</h1>
        <p className="text-slate-500">Anfragen von Besitzern, die über die App gesendet wurden.</p>
      </header>

      {detail ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setDetailId(null)}
              className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Zurück
            </button>
            <span className="text-xs text-slate-400">{formatDate(detail.created_at)}</span>
          </div>
          <div className="p-6 space-y-6">
            <section>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Besitzer</h3>
              <div className="bg-slate-50 rounded-xl p-4 space-y-1 text-sm">
                <p className="font-semibold text-slate-900">
                  {detail.payload.owner.firstName} {detail.payload.owner.lastName}
                </p>
                <p className="text-slate-600">Stall / Betrieb: {detail.payload.owner.stallName ?? '—'}</p>
                <p className="text-slate-600">PLZ: {detail.payload.owner.zip ?? '—'}</p>
                {detail.payload.owner.email && (
                  <p className="text-slate-600">E-Mail: {detail.payload.owner.email}</p>
                )}
              </div>
            </section>
            <section>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">
                Pferde ({detail.payload.horses.length})
              </h3>
              <ul className="space-y-4">
                {detail.payload.horses.map((h) => (
                  <li key={h.horseId} className="border border-slate-200 rounded-xl p-4">
                    <p className="font-bold text-slate-900">{h.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      ISO-Nr. {h.isoNr} · Rasse {h.breed} · Geb. {h.birthYear}
                      {h.chipId && h.chipId !== '—' ? ` · Chip ${h.chipId}` : ''}
                    </p>
                    <div className="mt-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Benötigte Impfungen</p>
                      <ul className="text-sm text-slate-700 space-y-0.5">
                        {h.noVaccData && h.selectedCategories?.length
                          ? h.selectedCategories.map((c) => <li key={c}>• Impfung: {c}</li>)
                          : h.selectedDueItems?.map((d, i) => <li key={i}>• {d.message}</li>) ?? []}
                      </ul>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400">Laden…</div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              Noch keine Terminanfragen. Besitzer können dich über „Termin vereinbaren“ in der App anfragen.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {requests.map((r) => {
                const name = [r.payload.owner.firstName, r.payload.owner.lastName].filter(Boolean).join(' ') || 'Unbekannt';
                const n = r.payload.horses.length;
                return (
                  <li
                    key={r.id}
                    onClick={() => setDetailId(r.id)}
                    className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{name}</p>
                      <p className="text-sm text-slate-500">
                        {formatDate(r.created_at)} · {n} {n === 1 ? 'Pferd' : 'Pferde'}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
