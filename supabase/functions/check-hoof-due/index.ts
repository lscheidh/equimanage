// Prüft Hufschmied-Fälligkeiten und sendet E-Mail bei neuem Status (fällig/kritisch).
// Wird vom Client oder Cron aufgerufen. Verwendet hoof_due_notifications.
// Deployment: supabase functions deploy check-hoof-due

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret' };

async function sendEmail(to: string, subject: string, html: string, fromStr: string): Promise<boolean> {
  const m = fromStr.match(/^(.+?)\s*<(.+?)>$/);
  const fromEmail = m ? m[2].trim() : fromStr.trim();
  const fromName = m ? m[1].trim() : 'EquiManage';

  const sendgridKey = Deno.env.get('SENDGRID_API_KEY');
  if (!sendgridKey) return false;

  const base = Deno.env.get('SENDGRID_API_URL') || 'https://api.sendgrid.com';
  const res = await fetch(`${base.replace(/\/$/, '')}/v3/mail/send`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sendgridKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }], subject }],
      from: { email: fromEmail, name: fromName },
      content: [{ type: 'text/html', value: html }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('SendGrid API error:', res.status, err);
    throw new Error(`E-Mail-Versand fehlgeschlagen: ${res.status}`);
  }
  return true;
}

interface HoofItem {
  horseId: string;
  horseName: string;
  status: 'yellow' | 'red';
  daysSince: number;
  message: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors, status: 204 });

  try {
    const authHeader = req.headers.get('Authorization');
    const cronSecret = req.headers.get('x-cron-secret');
    const isCron = !!cronSecret && cronSecret === Deno.env.get('CRON_SECRET');

    if (!authHeader && !isCron) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { headers: { 'Content-Type': 'application/json', ...cors }, status: 401 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = (await req.json()) as { ownerId?: string; ownerEmail?: string; ownerName?: string; items?: HoofItem[] };
    const { ownerId, ownerEmail, ownerName, items = [] } = body;

    if (!isCron) {
      const jwt = authHeader!.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(jwt);
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { headers: { 'Content-Type': 'application/json', ...cors }, status: 401 });
      }
      if (ownerId !== user.id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { headers: { 'Content-Type': 'application/json', ...cors }, status: 403 });
      }
    }

    const sent = await processHoofDue(supabase, ownerId!, ownerEmail!, ownerName!, items);
    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { 'Content-Type': 'application/json', ...cors },
      status: 200,
    });
  } catch (e) {
    console.error('check-hoof-due', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { 'Content-Type': 'application/json', ...cors },
      status: 500,
    });
  }
});

async function processHoofDue(
  supabase: ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2').createClient>,
  ownerId: string,
  ownerEmail: string,
  ownerName: string,
  items: HoofItem[]
): Promise<number> {
  if (!ownerId || !ownerEmail || !items.length) return 0;

  const newItems: HoofItem[] = [];
  for (const item of items) {
    const { data: existing } = await supabase
      .from('hoof_due_notifications')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('horse_id', item.horseId)
      .eq('notified_for', item.status)
      .maybeSingle();
    if (!existing) newItems.push(item);
  }

  if (newItems.length === 0) return 0;

  const statusLabel = (s: string) => s === 'red' ? 'kritisch' : 'fällig';
  const newLines = newItems.map((i) => `• ${i.horseName}: Hufschmied ${statusLabel(i.status)} (seit ${i.daysSince} Tagen)\n  ${i.message}`).join('\n\n');
  const allLines = items.map((i) => `• ${i.horseName}: Hufschmied ${statusLabel(i.status)} (seit ${i.daysSince} Tagen)\n  ${i.message}`).join('\n\n');

  const subject = `EquiManage: Hufschmied-Termin${newItems.length > 1 ? 'e' : ''} fällig`;
  const html = `
    <h2>Hufschmied-Erinnerung</h2>
    <p>Hallo ${ownerName || 'Nutzer'},</p>
    <p>${newItems.length === 1 ? 'Ein Pferd benötigt einen Hufschmied-Termin' : `${newItems.length} Pferde benötigen Hufschmied-Termine`}:</p>
    <pre style="background:#f5f5f5;padding:1rem;border-radius:0.5rem;white-space:pre-wrap;">${newLines}</pre>
    <h3>Alle offenen Hufschmied-Termine</h3>
    <pre style="background:#f5f5f5;padding:1rem;border-radius:0.5rem;white-space:pre-wrap;">${allLines}</pre>
    <p>Bitte vereinbare zeitnah einen Termin.</p>
    <p>– EquiManage</p>
  `;

  const fromStr = Deno.env.get('SENDGRID_FROM_EMAIL') || 'EquiManage <noreply@equimanage.de>';
  const sent = await sendEmail(ownerEmail, subject, html, fromStr);
  if (!sent) {
    console.log('check-hoof-due: SENDGRID_API_KEY nicht gesetzt, E-Mail übersprungen', { to: ownerEmail, subject });
  }

  for (const item of newItems) {
    await supabase.from('hoof_due_notifications').insert({
      owner_id: ownerId,
      horse_id: item.horseId,
      notified_for: item.status,
    });
  }
  return newItems.length;
}
