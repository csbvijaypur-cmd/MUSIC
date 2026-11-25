// Popular playlists on Home, by language. Most come from Spotify's own editorial
// playlists (always fresh, read via our function); a few are built from the free catalog.
import { fetchSpotifyPlaylist } from './spotifyImport.js';
import { moodMix } from './catalog.js';
import { safeGet, safeSet } from './config.js';

const sp = (id, name, tag) => ({ key: 'sp:' + id, kind: 'spotify', id, name, tag });
const mix = (key, name, tag, artists) => ({ key, kind: 'mix', name, tag, artists });

export const LANGS = [
  { id: 'hindi', name: 'Hindi', c: '#ff7a1a', lists: [
    sp('37i9dQZF1DX0XUfTFmNBRM', 'Latest Hindi Hits', 'New'),
    sp('37i9dQZEVXbLZ52XmnySJg', 'Top 50 India', 'Top'),
    sp('37i9dQZF1DX8xfQRRX1PDm', 'Bollywood Dance', 'Dance'),
    mix('hi-love', 'Romantic Hindi', 'Love', ['Arijit Singh', 'Atif Aslam', 'Jubin Nautiyal', 'Shreya Ghoshal']),
    sp('37i9dQZF1DWYRTlrhMB12D', 'Old is Gold', 'Old'),
    sp('37i9dQZF1DX5q67ZpWyRrZ', 'Indie India', 'Indie'),
  ] },
  { id: 'punjabi', name: 'Punjabi', c: '#ffc21a', lists: [
    sp('37i9dQZF1DWXVJK4aT7pmk', 'Latest Punjabi Hits', 'New'),
    sp('37i9dQZF1DX5cZuAHLNjGz', 'Punjabi 101', 'Top'),
    mix('pb-party', 'Punjabi Party', 'Dance', ['Diljit Dosanjh', 'Yo Yo Honey Singh', 'Badshah', 'Guru Randhawa']),
    mix('pb-gabru', 'Gabru Vibes', 'Swag', ['AP Dhillon', 'Karan Aujla', 'Sidhu Moose Wala', 'Shubh']),
    mix('pb-old', 'Punjabi Classics', 'Old', ['Gurdas Maan', 'Jazzy B', 'Babbu Maan', 'Daler Mehndi']),
  ] },
  { id: 'english', name: 'English', c: '#3b82f6', lists: [
    sp('37i9dQZF1DXcBWIGoYBM5M', "Today's Top Hits", 'New'),
    sp('37i9dQZEVXbMDoHDwVN2tF', 'Top 50 Global', 'Top'),
    sp('37i9dQZF1DX0BcQWzuB7ZO', 'Dance Hits', 'Dance'),
    sp('37i9dQZF1DX4o1oenSJRJd', 'All Out 2000s', 'Old'),
    sp('37i9dQZF1DXbTxeAdrVG2l', 'All Out 90s', 'Old'),
  ] },
];

const mem = new Map();
const TTL = 6 * 3600 * 1000;
/** { name, image, tracks } — cached in memory and for 6 h on the device */
export async function loadCollection(c) {
  if (mem.has(c.key)) return mem.get(c.key);
  try {
    const hit = JSON.parse(safeGet('dhun.col.' + c.key) || 'null');
    if (hit && Date.now() - hit.at < TTL && hit.tracks?.length) { mem.set(c.key, Promise.resolve(hit)); return hit; }
  } catch {}
  const job = (async () => {
    const data = c.kind === 'spotify'
      ? await fetchSpotifyPlaylist(`https://open.spotify.com/${c.type || 'playlist'}/${c.id}`)
      : { name: c.name, image: '', tracks: await moodMix({ artists: c.artists }, 40) };
    const out = { name: c.name || data.name, image: data.image || data.tracks[0]?.art || '', tracks: data.tracks, at: Date.now() };
    try { safeSet('dhun.col.' + c.key, JSON.stringify(out)); } catch {}
    return out;
  })();
  mem.set(c.key, job);
  job.catch(() => mem.delete(c.key));
  return job;
}

/** A pasted Spotify link becomes a collection you can open, play and save */
export function fromSpotifyLink(link) {
  const m = link.match(/(playlist|album)[/:]([A-Za-z0-9]{10,40})/);
  return m ? { key: 'sp:' + m[2], kind: 'spotify', type: m[1], id: m[2], name: '', tag: '' } : null;
}
