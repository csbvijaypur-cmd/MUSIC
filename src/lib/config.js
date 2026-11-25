// Keys come from .env (VITE_*) or from the in-app Settings screen (saved in localStorage).
const safeGet = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const safeSet = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} };

export const getConfig = () => ({
  spotifyClientId: safeGet('dhun.spotifyClientId') || import.meta.env.VITE_SPOTIFY_CLIENT_ID || '',
  youtubeApiKey: safeGet('dhun.youtubeApiKey') || import.meta.env.VITE_YOUTUBE_API_KEY || '',
});
export const saveConfig = ({ spotifyClientId, youtubeApiKey }) => {
  safeSet('dhun.spotifyClientId', spotifyClientId?.trim());
  safeSet('dhun.youtubeApiKey', youtubeApiKey?.trim());
};
export { safeGet, safeSet };
