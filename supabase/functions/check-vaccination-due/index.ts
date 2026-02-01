// Prüft Impf-Fälligkeiten und sendet E-Mail bei neuen Fälligkeiten.
// Wird vom Client aufgerufen (mit JWT). Verwendet vaccination_due_notifications.
// Deployment: supabase functions deploy check-vaccination-due

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
    const cronSecret = req.headers.get('x-cron-secret');
    const isCron = !!cronSecret && cronSecret === Deno.env.get('CRON_SECRET');

    let ownerId: string;
    let ownerEmail: string;
    let ownerName: string;
    let items: DueItem[];

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (isCron) {
      const body = (await req.json()) as { ownerId?: string; ownerEmail?: string; ownerName?: string; items?: DueItem[] };
      ownerId = body.ownerId ?? '';
      ownerEmail = body.ownerEmail ?? '';
      ownerName = body.ownerName ?? '';
      items = body.items ?? [];
    } else {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { headers: { 'Content-Type': 'application/json', ...cors }, status: 401 });
      }
      const jwt = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(jwt);
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { headers: { 'Content-Type': 'application/json', ...cors }, status: 401 });
      }
      const body = (await req.json()) as { ownerId?: string; ownerEmail?: string; ownerName?: string; items?: DueItem[] };
      ownerId = body.ownerId ?? '';
      ownerEmail = body.ownerEmail ?? '';
      ownerName = body.ownerName ?? '';
      items = body.items ?? [];
      if (ownerId !== user.id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { headers: { 'Content-Type': 'application/json', ...cors }, status: 403 });
      }
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

    const subject = `EquiManage: Neue Impf-Fälligkeit${newItems.length > 1 ? 'en' : ''}`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Impf-Fälligkeit</title></head><body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#1e293b;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 16px;"><tr><td align="center"><table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:16px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -2px rgba(0,0,0,0.1);overflow:hidden;"><tr><td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:28px 32px;text-align:center;"><h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">EquiManage</h1><p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.9);">Impf-Fälligkeit${newItems.length > 1 ? 'en' : ''}</p></td></tr><tr><td style="padding:32px;"><p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#475569;">Hallo ${ownerName || 'Nutzer'},</p><p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#64748b;">${newItems.length === 1 ? 'Ein Pferd hat eine neue Fälligkeit' : `${newItems.length} Pferde haben neue Fälligkeiten`}:</p><div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:20px;margin-bottom:24px;"><p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;">Neue Fälligkeiten</p>${newItems.map((i) => { const isRed = (i.status || '').toUpperCase() === 'RED'; const badgeColor = isRed ? '#dc2626' : '#d97706'; const badgeBg = isRed ? '#fee2e2' : '#fef3c7'; return `<div style="margin-bottom:12px;padding:12px;background:#fff;border-radius:8px;border:1px solid #e5e7eb;"><span style="display:inline-block;padding:4px 10px;font-size:11px;font-weight:700;color:${badgeColor};background:${badgeBg};border-radius:6px;margin-bottom:6px;">${statusLabel(i.status)}</span><p style="margin:0;font-size:15px;font-weight:600;color:#1e293b;">${i.horseName} – ${i.type} (${i.sequence})</p><p style="margin:4px 0 0;font-size:13px;color:#64748b;line-height:1.5;">${i.message}</p></div>`; }).join('')}</div><p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#334155;">Alle aktuellen Fälligkeiten</p><div style="background:#f1f5f9;border-radius:8px;padding:20px;">${items.map((i) => { const isRed = (i.status || '').toUpperCase() === 'RED'; const dotColor = isRed ? '#dc2626' : '#d97706'; return `<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;"><span style="display:inline-block;width:8px;height:8px;background:${dotColor};border-radius:50%;margin-right:8px;vertical-align:middle;"></span><strong style="color:#1e293b;">${i.horseName}</strong> – ${i.type} (${i.sequence}) – ${statusLabel(i.status)}<br><span style="font-size:13px;color:#64748b;margin-left:16px;">${i.message}</span></div>`; }).join('')}</div><p style="margin:24px 0 0;font-size:14px;color:#64748b;">Bitte plane die Impfungen zeitnah.</p></td></tr><tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;"><p style="margin:0;font-size:12px;color:#94a3b8;">– EquiManage – Pferde-Management</p></td></tr></table></td></tr></table></body></html>`;

    const fromStr = Deno.env.get('SENDGRID_FROM_EMAIL') || 'EquiManage <noreply@equimanage.de>';
    const sent = await sendEmail(ownerEmail, subject, html, fromStr);
    if (!sent) {
      console.log('check-vaccination-due: SENDGRID_API_KEY nicht gesetzt, E-Mail übersprungen', { to: ownerEmail, subject });
    }

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
