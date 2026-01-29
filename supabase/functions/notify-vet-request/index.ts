// Stub: Wird nach „Anfrage senden“ vom Client aufgerufen.
// Optional: Hier E-Mail an Tierarzt (z. B. via Resend) senden.
// Deployment: supabase functions deploy notify-vet-request

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors, status: 204 });

  try {
    const body = (await req.json()) as { requestId?: string; vetId?: string };
    const { requestId, vetId } = body ?? {};
    console.log('notify-vet-request', { requestId, vetId });

    // TODO: Vet-E-Mail aus profiles o. ä. laden, E-Mail (z. B. Resend) senden.

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', ...cors },
      status: 200,
    });
  } catch (e) {
    console.error('notify-vet-request', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { 'Content-Type': 'application/json', ...cors },
      status: 500,
    });
  }
});
