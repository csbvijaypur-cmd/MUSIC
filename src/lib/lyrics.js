// Synced lyrics from LRCLIB (free, no key). Results are cached in memory.
const cache = new Map();

export function parseLrc(lrc) {
  const lines = [];
  for (const row of (lrc || '').split('\n')) {
    const stamps = [...row.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    const text = row.replace(/\[[^\]]*\]/g, '').trim();
    for (const s of stamps) lines.push({ time: +s[1] * 60 + +s[2], text });
  }
  return lines.sort((a, b) => a.time - b.time);
}

export async function fetchLyrics(track) {
  if (track.lrc) return { synced: parseLrc(track.lrc), plain: '' };
  if (cache.has(track.id)) return cache.get(track.id);
  const job = (async () => {
    const base = 'https://lrclib.net/api';
    const q = new URLSearchParams({ track_name: track.title, artist_name: track.artist });
    if (track.album) q.set('album_name', track.album);
    if (track.duration) q.set('duration', track.duration);
    let hit = null;
    try { const r = await fetch(`${base}/get?${q}`); if (r.ok) hit = await r.json(); } catch {}
    if (!hit?.syncedLyrics) {
      try {
        const r = await fetch(`${base}/search?${new URLSearchParams({ q: `${track.artist} ${track.title}` })}`);
        const list = r.ok ? await r.json() : [];
        const near = (x) => !track.duration || Math.abs(x.duration - track.duration) < 8;
        hit = list.find((x) => x.syncedLyrics && near(x)) || list.find((x) => x.syncedLyrics) || hit || list[0] || null;
      } catch {}
    }
    return { synced: parseLrc(hit?.syncedLyrics), plain: hit?.plainLyrics || '' };
  })();
  cache.set(track.id, job);
  job.catch(() => cache.delete(track.id));
  return job;
}
