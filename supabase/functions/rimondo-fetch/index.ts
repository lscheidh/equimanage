// Rimondo-Profil-URL abrufen und relevante Pferdefelder extrahieren.
// Rimondo-Seiten haben <div id="base_data" class="l-topic"> mit einer Tabelle.
// Deployment: supabase functions deploy rimondo-fetch

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Result {
  name?: string;
  breed?: string;
  birthYear?: number;
  gender?: 'Hengst' | 'Stute' | 'Wallach' | null;
  breedingAssociation?: string;
  isoNr?: string;
  feiNr?: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parst #base_data Tabelle (Zeilen mit Label + Wert). */
function parseBaseDataTable(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const baseDataStart = html.indexOf('id="base_data"');
  if (baseDataStart === -1) return out;
  const afterBase = html.slice(baseDataStart);
  const tableStart = afterBase.indexOf('<table');
  const tableEnd = afterBase.indexOf('</table>');
  if (tableStart === -1 || tableEnd === -1 || tableEnd < tableStart) return out;
  const block = afterBase.slice(tableStart, tableEnd + 7);

  // Tabellenzeilen: <tr>...</tr> mit mindestens 2 <td>
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRegex.exec(block)) !== null) {
    const rowHtml = trMatch[1];
    const tds = rowHtml.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
    if (!tds || tds.length < 2) continue;
    const label = stripHtml(tds[0]).replace(/:$/, '').trim().toLowerCase();
    const value = stripHtml(tds[1]).trim();
    if (label && value) out[label] = value;
  }
  return out;
}

function parseHtml(html: string): Result {
  const out: Result = {};
  const table = parseBaseDataTable(html);

  const get = (keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = table[k];
      if (v) return v;
    }
    return undefined;
  };

  out.name = get(['name', 'pferdename']);
  out.breed = get(['rasse', 'breed'])?.slice(0, 80);
  const birthStr = get(['geburtsjahr', 'geb.', 'birth year', 'foaled']);
  if (birthStr) {
    const m = birthStr.match(/\d{4}/);
    if (m) {
      const y = parseInt(m[0], 10);
      if (y >= 1990 && y <= new Date().getFullYear()) out.birthYear = y;
    }
  }
  const genderStr = get(['geschlecht', 'gender'])?.toLowerCase();
  if (genderStr) {
    if (genderStr.includes('hengst')) out.gender = 'Hengst';
    else if (genderStr.includes('stute')) out.gender = 'Stute';
    else if (genderStr.includes('wallach')) out.gender = 'Wallach';
  }
  out.breedingAssociation = get(['zuchtverband', 'verband', 'breeding association'])?.slice(0, 120);
  out.isoNr = get(['ueln', 'iso', 'passnummer'])?.slice(0, 30);
  out.feiNr = get(['fei', 'fei-nr', 'fei nr', 'fei-nummer'])?.slice(0, 30);

  // Fallback: og:title für Name
  if (!out.name) {
    const ogTitle = /<meta\s+property="og:title"\s+content="([^"]+)"/i.exec(html);
    if (ogTitle?.[1]) {
      const t = ogTitle[1].trim();
      if (t && !t.toLowerCase().startsWith('rimondo')) out.name = t;
    }
  }
  if (!out.name) {
    const title = /<title>([^<]+)<\/title>/i.exec(html);
    if (title?.[1]) {
      const t = title[1].replace(/\s*\|\s*rimondo.*$/i, '').trim();
      if (t) out.name = t;
    }
  }

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
    const result = parseHtml(html);
    const feiFromUrl = /horse-details\/(\d+)(?:\/|$)/i.exec(url);
    if (feiFromUrl?.[1] && !result.feiNr) result.feiNr = feiFromUrl[1];
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
