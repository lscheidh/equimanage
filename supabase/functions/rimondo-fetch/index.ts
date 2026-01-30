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

/** Parst #base_data Tabelle, dl/dt/dd oder Fließtext. Sucht in base_data oder gesamter Seite. */
function parseBaseDataTable(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const baseDataStart = html.search(/id=["']base_data["']|id=["']base-data["']|class=["'][^"']*base[_-]?data[^"']*["']/i);
  const block = baseDataStart >= 0 ? html.slice(baseDataStart, baseDataStart + 15000) : html;
  const fullBlock = html.length < 200000 ? html : html.slice(0, 100000);

  const addPair = (label: string, value: string) => {
    const raw = label.replace(/:$/, '').trim().toLowerCase().replace(/\s+/g, ' ');
    const val = value.trim();
    if (!raw || !val) return;
    out[raw] = val;
    const base = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (base && base !== raw && !out[base]) out[base] = val;
  };

  const searchBlocks = [block, fullBlock];
  for (const blk of searchBlocks) {
    if (Object.keys(out).length > 5) break;
    // 1) Tabelle: <tr> mit th/td – Rimondo: 4 Zellen/Zeile (Label1,Wert1,Label2,Wert2)
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch;
    while ((trMatch = trRegex.exec(blk)) !== null) {
      const rowHtml = trMatch[1];
      const cells = rowHtml.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
      if (!cells || cells.length < 2) continue;
      addPair(stripHtml(cells[0]), stripHtml(cells[1]));
      if (cells.length >= 4) addPair(stripHtml(cells[2]), stripHtml(cells[3]));
    }
    // 2) Definition list: <dt>Label</dt><dd>Wert</dd>
    const dtRegex = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
    let ddMatch;
    while ((ddMatch = dtRegex.exec(blk)) !== null) {
      addPair(stripHtml(ddMatch[1]), stripHtml(ddMatch[2]));
    }
  }

  // 3) Label: Wert Muster im Fließtext (DE + EN)
  const labels = [
    'Name', 'Sportname', 'Lebensnummer', 'FEI ID', 'FEI-Nr', 'Geboren', 'Born', 'Rasse', 'Breed',
    'Geschlecht', 'Gender', 'Zuchtverband', 'National-ID', 'UELN', 'Passnummer', 'Foaled',
  ];
  for (const lbl of labels) {
    if (out[lbl.toLowerCase().replace(/\s+/g, ' ')]) continue;
    const re = new RegExp(lbl + '\\s*[:\\s]*([^<\n]{1,100})', 'gi');
    const m = re.exec(fullBlock);
    if (m) addPair(lbl, m[1]);
  }
  return out;
}

/** JSON-LD aus <script type="application/ld+json"> parsen (FAQPage, Thing). */
function parseJsonLd(html: string): Partial<Result> {
  const out: Partial<Result> = {};
  const ldMatch = html.match(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!ldMatch?.[1]) return out;
  try {
    const ld = JSON.parse(ldMatch[1]) as Record<string, unknown>;
    const mainEntity = ld.mainEntity as Array<{ name?: string; acceptedAnswer?: { text?: string } }> | undefined;
    if (Array.isArray(mainEntity)) {
      for (const q of mainEntity) {
        const text = q.acceptedAnswer?.text || '';
        if (text.includes('Rasse') && text.includes('hat die Rasse')) {
          const m = text.match(/hat die Rasse\s+([^.]+)/i);
          if (m) out.breed = m[1].trim().slice(0, 80);
        } else if (text.includes('Geschlecht') && (text.includes('Stute') || text.includes('Hengst') || text.includes('Wallach'))) {
          if (text.includes('Stute')) out.gender = 'Stute';
          else if (text.includes('Hengst')) out.gender = 'Hengst';
          else if (text.includes('Wallach')) out.gender = 'Wallach';
        } else if (text.includes('geboren') && text.match(/\d{4}/)) {
          const m = text.match(/\d{4}/);
          if (m) {
            const y = parseInt(m[0], 10);
            if (y >= 1990 && y <= new Date().getFullYear()) out.birthYear = y;
          }
        }
      }
    }
    if (!out.name) {
      const graph = ld['@graph'] as Record<string, unknown>[] | undefined;
      const obj = Array.isArray(graph)
        ? graph.find((x: Record<string, unknown>) => x.name || x['@type'])
        : ld as Record<string, unknown>;
      if (obj && typeof obj.name === 'string') out.name = obj.name;
    }
  } catch {
    // ignore
  }
  return out;
}

function parseHtml(html: string): Result {
  const out: Result = {};
  const table = parseBaseDataTable(html);
  const jsonLd = parseJsonLd(html);

  const get = (keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = table[k];
      if (v) return v;
    }
    return undefined;
  };

  // Rimondo Zuordnung (Labels toLowerCase)
  out.name = get(['name', 'sportname', 'pferdename']);
  out.isoNr = get(['lebensnummer', 'ueln', 'iso', 'passnummer', 'national-id', 'national id'])?.slice(0, 30);
  out.feiNr = get(['fei id', 'fei-id', 'fei', 'fei-nr', 'fei nr'])?.slice(0, 30);
  const birthStr = get(['geboren', 'geburtsjahr', 'geb.', 'birth year', 'foaled', 'born']);
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

  if (!out.name && jsonLd.name) out.name = jsonLd.name;
  if (!out.breed && jsonLd.breed) out.breed = jsonLd.breed;
  if (!out.gender && jsonLd.gender) out.gender = jsonLd.gender;
  if (!out.birthYear && jsonLd.birthYear) out.birthYear = jsonLd.birthYear;

  // Fallback: og:title für Name
  if (!out.name) {
    const ogTitle = /<meta\s+property="og:title"\s+content="([^"]+)"/i.exec(html);
    if (ogTitle?.[1]) {
      const t = ogTitle[1].trim();
      if (t && !t.toLowerCase().startsWith('rimondo')) {
        const beforeComma = t.split(',')[0].trim();
        out.name = beforeComma.replace(/(Stute|Hengst|Wallach)$/i, '').trim() || beforeComma;
      }
    }
  }
  if (!out.name) {
    const title = /<title>([^<]+)<\/title>/i.exec(html);
    if (title?.[1]) {
      const t = title[1].replace(/\s*\|\s*rimondo.*$/i, '').replace(/\s*:\s*Springpferd.*$/i, '').trim();
      if (t) out.name = t;
    }
  }

  return out;
}


/** Name aus URL-Slug extrahieren: /horse-details/1754189/daydream-z -> Daydream Z */
function nameFromUrl(url: string): string | undefined {
  const m = /horse-details\/\d+\/([a-z0-9_-]+)(?:\/|$)/i.exec(url);
  if (!m?.[1]) return undefined;
  return m[1]
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors, status: 204 });

  try {
    const body = (await req.json()) as { url?: string };
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    const rimondoMatch = /^https:\/\/(www\.)?rimondo\.com\//i.exec(url);
    if (!url || !rimondoMatch) {
      return new Response(JSON.stringify({}), {
        headers: { 'Content-Type': 'application/json', ...cors },
        status: 200,
      });
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      },
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
    if (!result.name) {
      const urlName = nameFromUrl(url);
      if (urlName) result.name = urlName;
    }
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
