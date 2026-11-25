// Audius: free, legal, full-length tracks with an open API (no key, no login).
// Streams are plain audio files, so we can run a real Web Audio visualizer on them.
const APP = 'LeharMusic';
let hostPromise;

async function host() {
  return hostPromise ||= (async () => {
    try {
      const r = await fetch('https://api.audius.co/v1/tracks/trending?limit=1&app_name=' + APP);
      if (r.ok) return 'https://api.audius.co';
    } catch {}
    const list = await (await fetch('https://api.audius.co')).json(); // older API: list of discovery nodes
    return list.data[Math.floor(Math.random() * list.data.length)];
  })().catch((e) => { hostPromise = null; throw e; });
}

const get = async (path) => {
  const h = await host();
  const r = await fetch(`${h}/v1${path}${path.includes('?') ? '&' : '?'}app_name=${APP}`);
  if (!r.ok) throw new Error('Audius error ' + r.status);
  return (await r.json()).data;
};

const toTrack = (t, h) => ({
  id: 'au:' + t.id, source: 'audius', title: t.title, artist: t.user?.name || '', album: '',
  art: t.artwork?.['1000x1000'] || t.artwork?.['480x480'] || '', artSmall: t.artwork?.['150x150'] || '',
  duration: t.duration || 0, stream: `${h}/v1/tracks/${t.id}/stream?app_name=${APP}`,
});

export async function search(q) {
  const h = await host();
  return (await get('/tracks/search?query=' + encodeURIComponent(q))).filter((t) => t.is_streamable !== false).slice(0, 12).map((t) => toTrack(t, h));
}
export async function trending() {
  const h = await host();
  return (await get('/tracks/trending?limit=18')).map((t) => toTrack(t, h));
}
