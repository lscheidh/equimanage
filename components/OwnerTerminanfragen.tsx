import React, { useCallback, useEffect, useState } from 'react';
import type { Profile } from '../types';
import type { Horse, Vaccination } from '../types';
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

export const OwnerTerminanfragen: React.FC<OwnerTerminanfragenProps> = ({
  profile,
  horses,
  onConfirmRequest,
  onSelectHorse,
}) => {
  const [requests, setRequests] = useState<appointmentRequestService.AppointmentRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-900">Terminanfragen</h2>
        <p className="text-sm text-slate-500">Status deiner an Tierärzte gesendeten Anfragen.</p>
      </div>
      {loading ? (
        <div className="p-8 text-center text-slate-400">Laden…</div>
      ) : requests.length === 0 ? (
        <div className="p-8 text-center text-slate-500">Noch keine Terminanfragen.</div>
      ) : detail ? (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setDetailId(null)}
              className="text-sm font-bold text-indigo-600 hover:text-indigo-800"
            >
              ← Zurück
            </button>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              detail.status === 'pending' ? 'bg-amber-100 text-amber-800' :
              detail.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {statusLabel(detail.status)}
            </span>
          </div>
          <p className="text-sm text-slate-600">An {vetLabel(detail)} · {formatDate(detail.created_at)}</p>
          <p className="text-sm text-slate-600">{detail.payload.horses.length} {detail.payload.horses.length === 1 ? 'Pferd' : 'Pferde'}</p>
          {detail.status === 'accepted' && detail.scheduled_date && (
            <p className="text-sm font-semibold text-emerald-700">Termin: {formatDateOnly(detail.scheduled_date)}</p>
          )}
          {detail.status === 'accepted' && detail.scheduled_date && !detail.owner_confirmed_at && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirmLoading}
              className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50"
            >
              {confirmLoading ? 'Wird bestätigt…' : 'Termin bestätigen'}
            </button>
          )}
          {detail.owner_confirmed_at && (
            <p className="text-sm text-emerald-600 font-medium">Termin von dir bestätigt.</p>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {requests.map((r) => (
            <li
              key={r.id}
              onClick={() => setDetailId(r.id)}
              className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
            >
              <div>
                <p className="font-bold text-slate-900">{vetLabel(r)}</p>
                <p className="text-sm text-slate-500">
                  {formatDate(r.created_at)} · {r.payload.horses.length} Pferde
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${
                    r.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                    r.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {statusLabel(r.status)}
                  </span>
                </p>
              </div>
              <span className="text-slate-400">›</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
