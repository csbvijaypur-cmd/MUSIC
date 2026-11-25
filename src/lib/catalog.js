// Free music catalog search (Apple iTunes Search API: no key, no login).
// Gives clean song titles, artists, album art and durations, like Spotify search.
// Playback happens through the official YouTube player (matched automatically).
const cache = new Map();

export async function search(q) {
  const key = q.toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const url = `https://itunes.apple.com/search?media=music&entity=song&limit=20&country=IN&term=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Search failed (' + res.status + ')');
  const data = await res.json();
  const seen = new Set();
  const list = data.results
    .filter((r) => { const k = (r.trackName + r.artistName).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .map((r) => ({
      id: 'ct:' + r.trackId, source: 'catalog',
      title: r.trackName, artist: r.artistName, album: r.collectionName || '',
      art: r.artworkUrl100?.replace('100x100bb', '600x600bb') || '', artSmall: r.artworkUrl100 || '',
      duration: Math.round((r.trackTimeMillis || 0) / 1000),
    }));
  cache.set(key, list);
  return list;
}
