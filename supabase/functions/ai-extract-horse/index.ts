// KI: Pferdedaten aus Passbild extrahieren. Keys serverseitig (CLAUDE_API_KEY / GEMINI_API_KEY).
// Deployment: supabase functions deploy ai-extract-horse

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

    const body = (await req.json()) as { base64Image?: string };
    const base64Image = body?.base64Image;
    if (!base64Image || typeof base64Image !== 'string') {
      return new Response(JSON.stringify({ error: 'base64Image required' }), { headers: { 'Content-Type': 'application/json', ...cors }, status: 400 });
    }

    const client = new Anthropic({ apiKey: key });
    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
          { type: 'text', text: 'Extrahiere alle relevanten Informationen über das Pferd aus diesem Pass-Bild. Wenn ein Feld nicht erkennbar ist, lasse es leer oder verwende null. Antworte als JSON-Objekt mit: name, isoNr, feiNr, birthYear, breed, chipId, gender, color, breedingAssociation, weightKg.' }
        ]
      }],
      response_format: { type: 'json_schema', json_schema: { name: 'horse_data', strict: true, schema: { type: 'object', properties: { name: { type: 'string' }, isoNr: { type: 'string' }, feiNr: { type: 'string' }, birthYear: { type: 'number' }, breed: { type: 'string' }, chipId: { type: 'string' }, gender: { type: 'string' }, color: { type: 'string' }, breedingAssociation: { type: 'string' }, weightKg: { type: 'number' } }, required: [] } } }
    });

    const content = message.content[0];
    const text = content.type === 'text' ? content.text : '{}';
    const data = JSON.parse(text || '{}');

    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', ...cors }, status: 200 });
  } catch (e) {
    console.error('ai-extract-horse', e);
    return new Response(JSON.stringify({ error: String(e) }), { headers: { 'Content-Type': 'application/json', ...cors }, status: 500 });
  }
});
