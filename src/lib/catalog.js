// Free music catalog search (Apple iTunes Search API: no key, no login).
// Gives clean song titles, artists, album art and durations, like Spotify search.
// Playback happens through the official YouTube player (matched automatically).
const cache = new Map();

const toTracks = (results) => {
  const seen = new Set();
  return results
    .filter((r) => r.wrapperType === 'track' && r.trackName)
    .filter((r) => { const k = (r.trackName + r.artistName).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .map((r) => ({
      id: 'ct:' + r.trackId, source: 'catalog',
      title: r.trackName, artist: r.artistName, album: r.collectionName || '',
      art: r.artworkUrl100?.replace('100x100bb', '600x600bb') || '', artSmall: r.artworkUrl100 || '',
      duration: Math.round((r.trackTimeMillis || 0) / 1000),
      genre: r.primaryGenreName || '', artistId: r.artistId || 0,
    }));
};

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Search failed (' + res.status + ')');
  return (await res.json()).results || [];
}
const API = 'https://itunes.apple.com';

export async function search(q, limit = 20) {
  const key = q.toLowerCase() + '|' + limit;
  if (cache.has(key)) return cache.get(key);
  const list = toTracks(await get(`${API}/search?media=music&entity=song&limit=${limit}&country=IN&term=${encodeURIComponent(q)}`));
  cache.set(key, list);
  return list;
}

const norm = (s = '') => s.toLowerCase().replace(/\(.*?\)|\[.*?\]|feat\..*$/g, '').replace(/[^a-z0-9\u0900-\u097f]+/g, ' ').trim();
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/**
 * "Song radio": songs that sound like `t`. Mixes more songs by the same artists
 * with popular songs from the same genre (e.g. Bollywood, Punjabi Pop).
 * `avoid` = tracks already in the queue, so nothing repeats.
 */
export async function similar(t, avoid = [], count = 10) {
  let seed = t;
  if (!t.genre || !t.artistId) {
    const q = `${t.title} ${t.source === 'catalog' ? t.artist : ''}`.replace(/official|video|lyrics?|full song|audio/gi, '');
    seed = (await search(q.trim(), 5))[0] || t;
  }
  const names = (seed.artist || '').split(/\s*(?:,|&| x | and | feat\.?|ft\.?)\s*/i).filter((n) => n.length > 2).slice(0, 2);
  const jobs = [
    seed.artistId ? get(`${API}/lookup?id=${seed.artistId}&entity=song&limit=25&country=IN`).then(toTracks) : [],
    ...names.map((n) => get(`${API}/search?media=music&entity=song&attribute=artistTerm&limit=25&country=IN&term=${encodeURIComponent(n)}`).then(toTracks)),
    seed.genre ? get(`${API}/search?media=music&entity=song&attribute=genreIndex&limit=40&country=IN&term=${encodeURIComponent(seed.genre)}`).then(toTracks) : [],
  ].map((p) => Promise.resolve(p).catch(() => []));
  const res = await Promise.all(jobs);
  const genre = shuffle(res.pop() || []);
  const byArtist = shuffle(res.flat());
  const seen = new Set([t, seed, ...avoid].map((x) => norm(x.title)));
  const out = [];
  const take = (x) => { const k = norm(x.title); if (!k || seen.has(k) || x.title.toLowerCase() === (seed.genre || '').toLowerCase()) return; seen.add(k); out.push({ ...x, radio: true }); };
  // Mix: 2 by the same artists, then 1 from the genre, so it stays close but fresh
  for (let n = 0; out.length < count && (byArtist.length || genre.length); n++) {
    const fromGenre = n % 3 === 2 || !byArtist.length;
    take(fromGenre && genre.length ? genre.shift() : byArtist.shift() || genre.shift());
  }
  return out;
}

/** Mood mixes: a few artists (or search words) per mood, shuffled into one playlist. */
export const MOODS = [
  { id: 'romantic', name: 'Romantic', emoji: '💞', c: '#ff4d8d', artists: ['Arijit Singh', 'Atif Aslam', 'Jubin Nautiyal', 'Shreya Ghoshal'] },
  { id: 'punjabi', name: 'Punjabi', emoji: '🔥', c: '#ffb020', artists: ['AP Dhillon', 'Diljit Dosanjh', 'Karan Aujla', 'Sidhu Moose Wala'] },
  { id: 'party', name: 'Party', emoji: '🎉', c: '#a855f7', artists: ['Badshah', 'Yo Yo Honey Singh', 'Guru Randhawa', 'Neha Kakkar'] },
  { id: 'lofi', name: 'Lo-fi', emoji: '🌙', c: '#60a5fa', terms: ['lofi hindi', 'slowed reverb hindi', 'lofi flip'] },
  { id: 'workout', name: 'Workout', emoji: '💪', c: '#22c55e', artists: ['Divine', 'KR$NA', 'Raftaar', 'Emiway Bantai'] },
  { id: 'sad', name: 'Sad', emoji: '🌧️', c: '#94a3b8', artists: ['Vishal Mishra', 'Mohit Chauhan', 'KK', 'Ankit Tiwari'] },
  { id: '90s', name: '90s Hits', emoji: '📼', c: '#f97316', artists: ['Kumar Sanu', 'Udit Narayan', 'Alka Yagnik', 'Sonu Nigam'] },
  { id: 'bhakti', name: 'Bhakti', emoji: '🙏', c: '#facc15', terms: ['hanuman chalisa', 'shiv bhajan', 'krishna bhajan'] },
];
export async function moodMix(m, count = 30) {
  const jobs = m.artists
    ? m.artists.map((a) => get(`${API}/search?media=music&entity=song&attribute=artistTerm&limit=20&country=IN&term=${encodeURIComponent(a)}`).then(toTracks))
    : m.terms.map((t) => search(t, 15));
  const lists = (await Promise.all(jobs.map((p) => p.catch(() => [])))).map(shuffle);
  const out = []; const seen = new Set();
  // Round-robin so artists alternate
  for (let i = 0; out.length < count && lists.some((l) => l.length); i++) {
    const x = lists[i % lists.length].shift();
    if (!x) continue;
    const k = norm(x.title);
    if (seen.has(k)) continue;
    seen.add(k); out.push(x);
  }
  return out;
}
