// Rimondo-Profil-URL abrufen und relevante Pferdefelder extrahieren.
// Deployment: supabase functions deploy rimondo-fetch

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RIMONDO_ORIGIN = 'https://www.rimondo.com';

interface Result {
  name?: string;
  breed?: string;
  birthYear?: number;
  gender?: 'Hengst' | 'Stute' | 'Wallach' | null;
  breedingAssociation?: string;
}

function parseHtml(html: string, url: string): Result {
  const out: Result = {};
  const lower = html.toLowerCase();

  // Rimondo-URL: /horse-details/ID/name-slug – Name oft im Titel oder og:title
  const ogTitle = /<meta\s+property="og:title"\s+content="([^"]+)"/i.exec(html);
  if (ogTitle?.[1]) {
    const t = ogTitle[1].trim();
    if (t && !t.startsWith('rimondo')) out.name = t;
  }
  if (!out.name) {
    const title = /<title>([^<]+)<\/title>/i.exec(html);
    if (title?.[1]) {
      const t = title[1].replace(/\s*\|\s*rimondo.*$/i, '').trim();
      if (t) out.name = t;
    }
  }

  // Typische Begriffe auf Rimondo-Seiten (anpassen, falls Struktur bekannt)
  const breedMatch = /(?:rasse|breed)[:\s]*([^<\n]+)/i.exec(html);
  if (breedMatch?.[1]) out.breed = breedMatch[1].trim().slice(0, 80);

  const yearMatch = /(?:geburtsjahr|birth\s*year|geb\.|foaled)[:\s]*(\d{4})/i.exec(html);
  if (yearMatch?.[1]) {
    const y = parseInt(yearMatch[1], 10);
    if (y >= 1990 && y <= new Date().getFullYear()) out.birthYear = y;
  }

  if (/\bhengst\b/i.test(html) && !/\bwallach\b/i.test(html)) out.gender = 'Hengst';
  else if (/\bstute\b/i.test(html)) out.gender = 'Stute';
  else if (/\bwallach\b/i.test(html)) out.gender = 'Wallach';

  const assocMatch = /(?:zuchtverband|breeding\s*association|verband)[:\s]*([^<\n]+)/i.exec(html);
  if (assocMatch?.[1]) out.breedingAssociation = assocMatch[1].trim().slice(0, 120);

  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors, status: 204 });

  try {
    const body = (await req.json()) as { url?: string };
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url || !url.startsWith('https://www.rimondo.com/')) {
      return new Response(JSON.stringify({}), {
        headers: { 'Content-Type': 'application/json', ...cors },
        status: 200,
      });
    }

    const res = await fetch(url, {
      headers: { 'User-Agent': 'EquiManage/1.0 (https://equimanage.app)' },
      redirect: 'follow',
    });
    if (!res.ok) {
      console.warn('rimondo-fetch: fetch failed', res.status, url);
      return new Response(JSON.stringify({}), {
        headers: { 'Content-Type': 'application/json', ...cors },
        status: 200,
      });
    }
    const html = await res.text();
    const result = parseHtml(html, url);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', ...cors },
      status: 200,
    });
  } catch (e) {
    console.error('rimondo-fetch', e);
    return new Response(JSON.stringify({}), {
      headers: { 'Content-Type': 'application/json', ...cors },
      status: 200,
    });
  }
});
