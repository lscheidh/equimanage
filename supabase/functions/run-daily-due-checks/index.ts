// Täglicher Cron: Prüft alle Besitzer auf Impf- und Hufschmied-Fälligkeiten, sendet E-Mails.
// Trigger: Supabase Cron (pg_cron) oder externer Cron mit Header x-cron-secret.
// Secrets: CRON_SECRET, RESEND_API_KEY, RESEND_FROM_EMAIL (optional)
// Deployment: supabase functions deploy run-daily-due-checks

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getVaccinationDueItems, getHoofDueItems } from './compliance.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors, status: 204 });

  try {
    const cronSecret = req.headers.get('x-cron-secret');
    if (!cronSecret || cronSecret !== Deno.env.get('CRON_SECRET')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { headers: { 'Content-Type': 'application/json', ...cors }, status: 401 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, notify_vaccination, notify_hoof')
      .eq('role', 'owner')
      .or('notify_vaccination.eq.true,notify_hoof.eq.true');

    if (!profiles?.length) {
      return new Response(JSON.stringify({ ok: true, ownersChecked: 0, vaccSent: 0, hoofSent: 0 }), {
        headers: { 'Content-Type': 'application/json', ...cors },
        status: 200,
      });
    }

    const fnUrl = `${supabaseUrl}/functions/v1`;
    const cronHeader = Deno.env.get('CRON_SECRET')!;
    let vaccSent = 0;
    let hoofSent = 0;

    for (const p of profiles) {
      const ownerId = p.id;
      const ownerName = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Nutzer';

      const { data } = await supabase.auth.admin.getUserById(ownerId);
      const ownerEmail = data?.user?.email ?? '';
      if (!ownerEmail) continue;

      const { data: horses } = await supabase
        .from('horses')
        .select('id, name, vaccinations, service_history')
        .eq('owner_id', ownerId);

      const horseList = (horses ?? []).map((h: Record<string, unknown>) => ({
        id: h.id,
        name: h.name ?? '',
        vaccinations: (h.vaccinations as unknown[]) ?? [],
        service_history: (h.service_history as unknown[]) ?? [],
      }));

      if (p.notify_vaccination && horseList.length > 0) {
        const vaccItems: { horseId: string; horseName: string; type: string; sequence: string; status: string; message: string }[] = [];
        for (const h of horseList) {
          vaccItems.push(...getVaccinationDueItems(h));
        }
        if (vaccItems.length > 0) {
          const res = await fetch(`${fnUrl}/check-vaccination-due`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
              'x-cron-secret': cronHeader,
            },
            body: JSON.stringify({ ownerId, ownerEmail, ownerName, items: vaccItems }),
          });
          if (res.ok) {
            const data = await res.json();
            vaccSent += data.sent ?? 0;
          }
        }
      }

      if (p.notify_hoof && horseList.length > 0) {
        const hoofItems: { horseId: string; horseName: string; status: 'yellow' | 'red'; daysSince: number; message: string }[] = [];
        for (const h of horseList) {
          hoofItems.push(...getHoofDueItems(h));
        }
        if (hoofItems.length > 0) {
          const res = await fetch(`${fnUrl}/check-hoof-due`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
              'x-cron-secret': cronHeader,
            },
            body: JSON.stringify({ ownerId, ownerEmail, ownerName, items: hoofItems }),
          });
          if (res.ok) {
            const data = await res.json();
            hoofSent += data.sent ?? 0;
          }
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      ownersChecked: profiles.length,
      vaccSent,
      hoofSent,
    }), {
      headers: { 'Content-Type': 'application/json', ...cors },
      status: 200,
    });
  } catch (e) {
    console.error('run-daily-due-checks', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { 'Content-Type': 'application/json', ...cors },
      status: 500,
    });
  }
});
