import React, { useMemo, useState } from 'react';
import type { AppointmentRequestRow } from '../services/appointmentRequestService';

interface VetCalendarProps {
  requests: AppointmentRequestRow[];
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type DayKind = 'accepted' | 'pending';

interface DayEvent {
  kind: DayKind;
  r: AppointmentRequestRow;
}

export const VetCalendar: React.FC<VetCalendarProps> = ({ requests }) => {
  const [base, setBase] = useState(() => new Date());
  const year = base.getFullYear();
  const month = base.getMonth();

  const byDate = useMemo(() => {
    const map = new Map<string, DayEvent[]>();
    for (const r of requests) {
      if (r.status === 'accepted' && r.scheduled_date) {
        const list = map.get(r.scheduled_date) ?? [];
        list.push({ kind: 'accepted', r });
        map.set(r.scheduled_date, list);
      }
      if (r.status === 'pending') {
        const d = r.created_at.slice(0, 10);
        const list = map.get(d) ?? [];
        list.push({ kind: 'pending', r });
        map.set(d, list);
      }
    }
    return map;
  }, [requests]);

  const weeks = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const start = new Date(first);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(last);
    end.setDate(end.getDate() + (6 - (end.getDay() + 6) % 7));
    const out: { date: Date; ymd: string; events: DayEvent[]; isCurrentMonth: boolean }[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      const ymd = toYMD(cur);
      out.push({
        date: new Date(cur),
        ymd,
        events: byDate.get(ymd) ?? [],
        isCurrentMonth: cur.getMonth() === month,
      });
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [year, month, byDate]);

  const monthLabel = `${['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'][month]} ${year}`;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden w-full max-w-sm shrink-0">
      <div className="p-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Kalender</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setBase((b) => { const n = new Date(b); n.setMonth(n.getMonth() - 1); return n; })}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
            aria-label="Vormonat"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-xs font-semibold text-slate-600 min-w-[7rem] text-center">{monthLabel}</span>
          <button
            type="button"
            onClick={() => setBase((b) => { const n = new Date(b); n.setMonth(n.getMonth() + 1); return n; })}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
            aria-label="Folgemonat"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
      <div className="p-2 flex gap-1 mb-1">
        {(['Mo','Di','Mi','Do','Fr','Sa','So']).map((d) => (
          <div key={d} className="flex-1 text-center text-[10px] font-bold text-slate-400">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 px-2 pb-3">
        {weeks.length ? weeks.map(({ date, ymd, events, isCurrentMonth }) => {
          const hasAccepted = events.some((e) => e.kind === 'accepted');
          const hasPending = events.some((e) => e.kind === 'pending');
          return (
            <div
              key={ymd}
              className={`group relative aspect-square flex items-center justify-center text-xs rounded-lg ${!isCurrentMonth ? 'text-slate-300' : 'text-slate-700 font-medium'} ${events.length ? 'cursor-default' : ''}`}
              title={events.length ? '' : undefined}
            >
              <span className="relative z-10">{date.getDate()}</span>
              {events.length > 0 && (
                <>
                  <div
                    className={`absolute inset-0 rounded-lg ${
                      hasAccepted && hasPending ? 'bg-gradient-to-br from-emerald-100 to-amber-100' :
                      hasAccepted ? 'bg-emerald-100' : 'bg-amber-100'
                    }`}
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity pointer-events-none">
                    <div className="bg-slate-900 text-white text-[10px] rounded-xl shadow-xl p-2 max-w-[200px] space-y-1.5 whitespace-nowrap">
                      {events.map((e, i) => {
                        const name = [e.r.payload.owner.firstName, e.r.payload.owner.lastName].filter(Boolean).join(' ') || '—';
                        const n = e.r.payload.horses.length;
                        return (
                          <div key={i}>
                            <span className={e.kind === 'accepted' ? 'text-emerald-300' : 'text-amber-300'}>{e.kind === 'accepted' ? 'Termin' : 'Anfrage'}</span>
                            {' '}{name} · {n} Pferd{n !== 1 ? 'e' : ''}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        }) : null}
      </div>
      <div className="px-3 pb-3 flex flex-wrap gap-3 text-[10px]">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-200" /> Angenommene Termine</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-200" /> Anfragen (offen)</span>
      </div>
    </div>
  );
}
