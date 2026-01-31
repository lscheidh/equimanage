// Prüft Impf-Fälligkeiten und sendet E-Mail bei neuen Fälligkeiten.
// Wird vom Client aufgerufen (mit JWT). Verwendet vaccination_due_notifications.
// Deployment: supabase functions deploy check-vaccination-due

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

interface DueItem {
  horseId: string;
  horseName: string;
  type: string;
  sequence: string;
  status: string;
  message: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors, status: 204 });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { headers: { 'Content-Type': 'application/json', ...cors }, status: 401 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(jwt);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { headers: { 'Content-Type': 'application/json', ...cors }, status: 401 });
    }

    const body = (await req.json()) as { ownerId?: string; ownerEmail?: string; ownerName?: string; items?: DueItem[] };
    const { ownerId, ownerEmail, ownerName, items = [] } = body;

    if (ownerId !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { headers: { 'Content-Type': 'application/json', ...cors }, status: 403 });
    }

    if (!ownerId || !ownerEmail || !items.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { 'Content-Type': 'application/json', ...cors }, status: 200 });
    }

    const newItems: DueItem[] = [];
    for (const item of items) {
      const { data: existing } = await supabase
        .from('vaccination_due_notifications')
        .select('id')
        .eq('owner_id', ownerId)
        .eq('horse_id', item.horseId)
        .eq('vacc_type', item.type)
        .eq('vacc_sequence', item.sequence)
        .maybeSingle();
      if (!existing) newItems.push(item);
    }

    if (newItems.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { 'Content-Type': 'application/json', ...cors }, status: 200 });
    }

    const statusLabel = (s: string) => ((s || '').toUpperCase() === 'RED' ? 'kritisch' : (s || '').toUpperCase() === 'YELLOW' ? 'fällig' : 'konform');
    const newLines = newItems.map((i) => `• ${i.horseName}: ${i.type} (${i.sequence}) – ${statusLabel(i.status)}\n  ${i.message}`).join('\n\n');
    const allLines = items.map((i) => `• ${i.horseName}: ${i.type} (${i.sequence}) – ${statusLabel(i.status)}\n  ${i.message}`).join('\n\n');

    const subject = `EquiManage: Neue Impf-Fälligkeit${newItems.length > 1 ? 'en' : ''}`;
    const html = `
      <h2>Impf-Fälligkeit${newItems.length > 1 ? 'en' : ''}</h2>
      <p>Hallo ${ownerName || 'Nutzer'},</p>
      <p>${newItems.length === 1 ? 'Ein Pferd hat eine neue Fälligkeit' : `${newItems.length} Pferde haben neue Fälligkeiten`}:</p>
      <pre style="background:#f5f5f5;padding:1rem;border-radius:0.5rem;white-space:pre-wrap;">${newLines}</pre>
      <h3>Alle aktuellen Fälligkeiten</h3>
      <pre style="background:#f5f5f5;padding:1rem;border-radius:0.5rem;white-space:pre-wrap;">${allLines}</pre>
      <p>Bitte plane die Impfungen zeitnah.</p>
      <p>– EquiManage</p>
    `;

    // TODO: E-Mail senden (z. B. Resend)
    // await fetch('https://api.resend.com/emails', { method: 'POST', ... });
    console.log('check-vaccination-due would send', { to: ownerEmail, subject, newCount: newItems.length });

    for (const item of newItems) {
      await supabase.from('vaccination_due_notifications').insert({
        owner_id: ownerId,
        horse_id: item.horseId,
        vacc_type: item.type,
        vacc_sequence: item.sequence,
      });
    }

    return new Response(JSON.stringify({ ok: true, sent: newItems.length }), {
      headers: { 'Content-Type': 'application/json', ...cors },
      status: 200,
    });
  } catch (e) {
    console.error('check-vaccination-due', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { 'Content-Type': 'application/json', ...cors },
      status: 500,
    });
  }
});
