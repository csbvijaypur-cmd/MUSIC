// Reads a public Spotify playlist/album from Spotify's own embed page (no login, no key)
// and returns its song list. Dhun then plays each song for free through YouTube.
const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=600',
};
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: HEADERS });

function findKey(obj, key, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 12) return null;
  if (key in obj) return obj[key];
  for (const v of Object.values(obj)) { const r = findKey(v, key, depth + 1); if (r) return r; }
  return null;
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...HEADERS, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': '*' } });
  const input = new URL(req.url).searchParams.get('url') || '';
  const m = input.match(/(playlist|album)[/:]([A-Za-z0-9]{10,40})/);
  if (!m) return reply(400, { error: 'Paste a Spotify playlist or album link' });
  const [, type, id] = m;
  let html;
  try {
    const res = await fetch(`https://open.spotify.com/embed/${type}/${id}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Accept-Language': 'en' },
    });
    if (res.status === 404) return reply(404, { error: 'Playlist not found. Is it public?' });
    if (!res.ok) return reply(502, { error: 'Spotify did not answer (' + res.status + ')' });
    html = await res.text();
  } catch { return reply(502, { error: 'Could not reach Spotify' }); }

  const raw = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!raw) return reply(502, { error: 'Could not read this playlist' });
  let data; try { data = JSON.parse(raw); } catch { return reply(502, { error: 'Could not read this playlist' }); }
  const entity = findKey(data, 'entity') || {};
  const list = entity.trackList || findKey(data, 'trackList') || [];
  const image = (entity.coverArt?.sources || entity.images || []).sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || '';
  const tracks = list
    .filter((t) => t && t.title && (t.isPlayable !== false))
    .map((t) => ({
      id: (t.uri || '').split(':').pop() || t.uid || t.title,
      title: t.title,
      artist: (t.subtitle || '').replace(/ /g, ' ').replace(/\s*,\s*/g, ', ').trim(),
      duration: Math.round((t.duration || 0) / 1000),
    }));
  if (!tracks.length) return reply(404, { error: 'No songs found in this playlist' });
  return reply(200, { name: entity.name || entity.title || 'Spotify playlist', image, type, tracks });
};
