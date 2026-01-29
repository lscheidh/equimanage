import React, { useCallback, useEffect, useState } from 'react';
import type { Profile } from '../types';
import type { Horse } from '../types';
import * as appointmentRequestService from '../services/appointmentRequestService';

interface OwnerTerminanfragenProps {
  profile: Profile | null;
  horses: Horse[];
  onConfirmRequest: (request: appointmentRequestService.AppointmentRequestRow) => Promise<void>;
  onSelectHorse?: (horse: Horse) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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

const today = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

export const OwnerTerminanfragen: React.FC<OwnerTerminanfragenProps> = ({
  profile,
  horses,
  onConfirmRequest,
}) => {
  const [requests, setRequests] = useState<appointmentRequestService.AppointmentRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [showPast, setShowPast] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id || profile.role !== 'owner') return;
    setLoading(true);
    try {
      const list = await appointmentRequestService.listAppointmentRequestsForOwner(profile.id);
      setRequests(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.role]);

  useEffect(() => {
    load();
  }, [load]);

  const now = today();
  const isPast = (r: appointmentRequestService.AppointmentRequestRow) => {
    if (r.scheduled_date) return r.scheduled_date < now;
    if (r.status === 'rejected') return true;
    return false;
  };
  const futureOrCurrent = requests.filter((r) => !isPast(r));
  const past = requests.filter(isPast);
  const displayList = showPast ? requests : futureOrCurrent;

  const detail = detailId ? requests.find((r) => r.id === detailId) : null;
  const vetLabel = (r: appointmentRequestService.AppointmentRequestRow) =>
    r.payload.vet?.practiceName ?? 'Tierarzt';

  const handleConfirm = useCallback(async () => {
    if (!detail) return;
    setConfirmLoading(true);
    try {
      await onConfirmRequest(detail);
      setDetailId(null);
      await load();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Bestätigung fehlgeschlagen.');
    } finally {
      setConfirmLoading(false);
    }
  }, [detail, onConfirmRequest, load]);

  if (!profile || profile.role !== 'owner') return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden w-full max-w-sm shrink-0">
      <div className="p-3 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">Terminanfragen</h2>
          {past.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPast(!showPast)}
              className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-wider"
            >
              {showPast ? 'Nur Zukünftige' : 'Vergangene anzeigen'}
            </button>
          )}
        </div>
      </div>
      {loading ? (
        <div className="p-6 text-center text-slate-400 text-sm">Laden…</div>
      ) : detail ? (
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setDetailId(null)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
            >
              ← Zurück
            </button>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              detail.status === 'pending' ? 'bg-amber-100 text-amber-800' :
              detail.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {statusLabel(detail.status)}
            </span>
          </div>
          <p className="text-xs text-slate-600">{vetLabel(detail)} · {formatDate(detail.created_at)}</p>
          {detail.status === 'accepted' && detail.scheduled_date && (
            <p className="text-xs font-semibold text-emerald-700">Termin: {formatDateOnly(detail.scheduled_date)}</p>
          )}
          <div className="border-t border-slate-100 pt-2 space-y-2">
            {detail.payload.horses.map((h) => (
              <div key={h.horseId} className="text-[11px]">
                <p className="font-semibold text-slate-800">{h.name}</p>
                <div className="text-slate-500 mt-0.5 pl-2 border-l-2 border-slate-100">
                  {h.noVaccData && h.selectedCategories?.length
                    ? h.selectedCategories.map((c) => <div key={c}>· {c}</div>)
                    : (h.selectedDueItems ?? []).map((d, i) => <div key={i}>· {d.message}</div>)}
                </div>
              </div>
            ))}
          </div>
          {detail.status === 'accepted' && detail.scheduled_date && !detail.owner_confirmed_at && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirmLoading}
              className="w-full py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50"
            >
              {confirmLoading ? '…' : 'Termin bestätigen'}
            </button>
          )}
          {detail.owner_confirmed_at && (
            <p className="text-xs text-emerald-600 font-medium">Bestätigt.</p>
          )}
        </div>
      ) : (
        <>
          {displayList.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs">Keine Terminanfragen.</div>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[40vh] overflow-y-auto">
              {displayList.map((r) => (
                <li
                  key={r.id}
                  onClick={() => setDetailId(r.id)}
                  className="p-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm truncate">{vetLabel(r)}</p>
                    <p className="text-[10px] text-slate-500">
                      {formatDate(r.created_at)} · {r.payload.horses.length} Pferd{r.payload.horses.length !== 1 ? 'e' : ''}
                      <span className={`ml-1.5 px-1 py-0.5 rounded text-[10px] font-medium ${
                        r.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                        r.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {statusLabel(r.status)}
                      </span>
                    </p>
                  </div>
                  <span className="text-slate-400 text-xs shrink-0">›</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};
