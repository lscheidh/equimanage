import React, { useCallback, useEffect, useState } from 'react';
import type { Profile } from '../types';
import * as appointmentRequestService from '../services/appointmentRequestService';
import { VetCalendar } from './VetCalendar';

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

function formatDateOnly(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function statusLabel(s: appointmentRequestService.AppointmentRequestStatus): string {
  switch (s) {
    case 'pending': return 'Offen';
    case 'accepted': return 'Angenommen';
    case 'rejected': return 'Abgelehnt';
    default: return 'Offen';
  }
}

export const VetPortal: React.FC<VetPortalProps> = ({ profile }) => {
  const [requests, setRequests] = useState<appointmentRequestService.AppointmentRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [respondLoading, setRespondLoading] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');

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

  const respond = useCallback(async (accepted: boolean) => {
    if (!detail || !profile?.id) return;
    setRespondLoading(true);
    try {
      await appointmentRequestService.updateAppointmentRequestVet(profile.id, detail.id, {
        status: accepted ? 'accepted' : 'rejected',
        ...(accepted && scheduledDate ? { scheduled_date: scheduledDate } : {}),
      });
      const updated = await appointmentRequestService.listAppointmentRequestsForVet(profile.id);
      setRequests(updated);
      const next = updated.find((r) => r.id === detail.id);
      if (next) setDetailId(next.id);
      setScheduledDate('');
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Aktion fehlgeschlagen.');
    } finally {
      setRespondLoading(false);
    }
  }, [detail, profile?.id, scheduledDate]);

  useEffect(() => {
    if (!detail) setScheduledDate('');
  }, [detail]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-stretch">
      <div className="flex-1 min-w-0 space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Terminanfragen</h1>
          <p className="text-slate-500">Anfragen von Besitzern, die über die App gesendet wurden.</p>
        </header>

        {detail ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDetailId(null)}
                className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Zurück
              </button>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                detail.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                detail.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {statusLabel(detail.status)}
              </span>
            </div>
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

            {detail.status === 'pending' && (
              <section className="border-t border-slate-100 pt-6">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Anfrage bearbeiten</h3>
                <p className="text-xs text-slate-500 mb-3">Bei Annahme: Datum angeben, an dem du zum Besitzer für die Impfung kommst.</p>
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="min-w-0 basis-full sm:basis-auto">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Termin am</label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full min-w-0 max-w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => respond(true)}
                      disabled={respondLoading || !scheduledDate.trim()}
                      className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {respondLoading ? '…' : 'Annehmen'}
                    </button>
                    <button
                      type="button"
                      onClick={() => respond(false)}
                      disabled={respondLoading}
                      className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-300 disabled:opacity-50"
                    >
                      Ablehnen
                    </button>
                  </div>
                </div>
              </section>
            )}

            {detail.status === 'accepted' && detail.scheduled_date && (
              <div className="bg-emerald-50 rounded-xl p-4 text-sm">
                <p className="font-semibold text-emerald-800">Termin: {formatDateOnly(detail.scheduled_date)}</p>
              </div>
            )}
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
                const st = r.status ?? 'pending';
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
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${
                          st === 'pending' ? 'bg-amber-100 text-amber-800' :
                          st === 'accepted' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {statusLabel(st)}
                        </span>
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

      <aside className="lg:w-80 flex-shrink-0">
        <VetCalendar requests={requests} />
      </aside>
    </div>
  );
};
