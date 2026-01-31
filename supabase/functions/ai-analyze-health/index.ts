// KI: Gesundheitsanalyse für Pferd. Keys serverseitig (CLAUDE_API_KEY).
// Deployment: supabase functions deploy ai-analyze-health

import Anthropic from 'npm:@anthropic-ai/sdk@0.71.2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors, status: 204 });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { headers: { 'Content-Type': 'application/json', ...cors }, status: 401 });
    }

    const key = Deno.env.get('CLAUDE_API_KEY');
    if (!key) {
      return new Response(JSON.stringify({ error: 'CLAUDE_API_KEY not configured' }), { headers: { 'Content-Type': 'application/json', ...cors }, status: 500 });
    }

    const body = (await req.json()) as { horse?: { name?: string; breed?: string; birthYear?: number; vaccinations?: unknown[]; serviceHistory?: { type: string; date: string }[] } };
    const horse = body?.horse;
    if (!horse) {
      return new Response(JSON.stringify({ error: 'horse required' }), { headers: { 'Content-Type': 'application/json', ...cors }, status: 400 });
    }

    const deworming = (horse.serviceHistory ?? []).filter((s: { type: string }) => s.type === 'Entwurmung').sort((a: { date: string }, b: { date: string }) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastDeworming = deworming[0]?.date ?? 'Keine Daten';

    const prompt = `Analysiere die Gesundheitsdaten für das Pferd "${horse.name}" (${horse.breed}, geboren ${horse.birthYear}).
Impfungen: ${JSON.stringify(horse.vaccinations ?? [])}
Letzte Entwurmung: ${lastDeworming}

Erstelle eine professionelle Bewertung auf Deutsch (max. 100 Wörter) für den Besitzer. Fokussiere dich auf Impfkonformität und Gesundheitspflege und schlage nächste Schritte vor.`;

    const client = new Anthropic({ apiKey: key });
    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = message.content[0];
    const text = content.type === 'text' ? content.text : 'Fehler bei der Analyse. Bitte konsultieren Sie Ihren Tierarzt.';

    return new Response(JSON.stringify({ text }), { headers: { 'Content-Type': 'application/json', ...cors }, status: 200 });
  } catch (e) {
    console.error('ai-analyze-health', e);
    return new Response(JSON.stringify({ error: String(e) }), { headers: { 'Content-Type': 'application/json', ...cors }, status: 500 });
  }
});
