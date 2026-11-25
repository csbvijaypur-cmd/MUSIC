// Import a public Spotify playlist/album by link. No Spotify login or Premium needed:
// our small Netlify function reads the song list, and each song plays free via YouTube.
const API = /netlify\.app$/.test(location.hostname) ? '/.netlify/functions/spotify-playlist' : 'https://dhun-songs.netlify.app/.netlify/functions/spotify-playlist';

export const isSpotifyLink = (s) => /open\.spotify\.com\/(?:intl-[a-z]+\/)?(playlist|album)\/|spotify:(playlist|album):/.test(s);

export async function fetchSpotifyPlaylist(link) {
  let res;
  try { res = await fetch(`${API}?v=2&url=${encodeURIComponent(link.trim())}`); }
  catch { throw new Error('Can’t connect. Check your internet.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Import failed');
  return {
    name: data.name, image: data.image,
    tracks: data.tracks.map((t) => ({
      id: 'sp:' + t.id, source: 'catalog', title: t.title, artist: t.artist, album: data.name,
      art: t.art || data.image, artSmall: t.art || data.image, duration: t.duration,
    })),
  };
}
