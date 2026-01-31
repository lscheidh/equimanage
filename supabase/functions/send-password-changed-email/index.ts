// Stub: Wird nach Passwort-Änderung vom Client aufgerufen.
// Optional: E-Mail an Nutzer senden (z. B. via Resend).
// Deployment: supabase functions deploy send-password-changed-email

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors, status: 204 });

  try {
    const body = (await req.json()) as { email?: string };
    const email = body?.email;
    if (!email) {
      return new Response(JSON.stringify({ error: 'email required' }), {
        headers: { 'Content-Type': 'application/json', ...cors },
        status: 400,
      });
    }

    // TODO: E-Mail versenden (z. B. Resend API)
    // Beispiel: await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}` }, body: JSON.stringify({ from: '...', to: email, subject: 'EquiManage: Passwort geändert', html: '...' }) });
    console.log('send-password-changed-email', { email });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', ...cors },
      status: 200,
    });
  } catch (e) {
    console.error('send-password-changed-email', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { 'Content-Type': 'application/json', ...cors },
      status: 500,
    });
  }
});
