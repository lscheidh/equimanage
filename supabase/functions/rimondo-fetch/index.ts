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

/** Parst #base_data Tabelle oder dl/dt/dd (Zeilen mit Label + Wert). */
function parseBaseDataTable(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const baseDataStart = html.search(/id=["']base_data["']|id=["']base-data["']/i);
  const block = baseDataStart >= 0 ? html.slice(baseDataStart, baseDataStart + 12000) : html;

  const addPair = (label: string, value: string) => {
    const k = label.replace(/:$/, '').trim().toLowerCase();
    if (k && value.trim()) out[k] = value.trim();
  };

  // 1) Tabelle: <tr> mit <td> oder <th>
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRegex.exec(block)) !== null) {
    const rowHtml = trMatch[1];
    const cells = rowHtml.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
    if (!cells || cells.length < 2) continue;
    addPair(stripHtml(cells[0]), stripHtml(cells[1]));
  }

  // 2) Definition list: <dt>Label</dt><dd>Wert</dd>
  if (Object.keys(out).length === 0) {
    const dtRegex = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
    let ddMatch;
    while ((ddMatch = dtRegex.exec(block)) !== null) {
      addPair(stripHtml(ddMatch[1]), stripHtml(ddMatch[2]));
    }
  }

  // 3) Label: Wert Muster im Fließtext (Fallback)
  if (Object.keys(out).length === 0) {
    const labels = ['Name', 'Lebensnummer', 'FEI ID', 'Geboren', 'Rasse', 'Geschlecht', 'Zuchtverband'];
    for (const lbl of labels) {
      const re = new RegExp(lbl + '\\s*[:\\s]*([^<\n]{1,80})', 'i');
      const m = re.exec(block);
      if (m) addPair(lbl, m[1]);
    }
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

  // Rimondo #base_data Zuordnung (Labels werden toLowerCase):
  // Pferdename=Name, ISO-Nr.=Lebensnummer, FEI-Nr.=FEI ID, Geburtsjahr=Geboren, Rasse=Rasse
  out.name = get(['name', 'pferdename']);
  out.isoNr = get(['lebensnummer', 'ueln', 'iso', 'passnummer'])?.slice(0, 30);
  out.feiNr = get(['fei id', 'fei-id', 'fei', 'fei-nr', 'fei nr'])?.slice(0, 30);
  const birthStr = get(['geboren', 'geburtsjahr', 'geb.', 'birth year', 'foaled']);
  if (birthStr) {
    const m = birthStr.match(/\d{4}/);
    if (m) {
      const y = parseInt(m[0], 10);
      if (y >= 1990 && y <= new Date().getFullYear()) out.birthYear = y;
    }
  }
  out.breed = get(['rasse', 'breed'])?.slice(0, 80);
  const genderStr = get(['geschlecht', 'gender'])?.toLowerCase();
  if (genderStr) {
    if (genderStr.includes('hengst')) out.gender = 'Hengst';
    else if (genderStr.includes('stute')) out.gender = 'Stute';
    else if (genderStr.includes('wallach')) out.gender = 'Wallach';
  }
  out.breedingAssociation = get(['zuchtverband', 'verband', 'breeding association'])?.slice(0, 120);

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
