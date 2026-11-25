// Keys come from .env (VITE_*) or from the in-app Settings screen (saved in localStorage).
const safeGet = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const safeSet = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} };

export const getConfig = () => ({
  spotifyClientId: safeGet('lehar.spotifyClientId') || import.meta.env.VITE_SPOTIFY_CLIENT_ID || '',
  youtubeApiKey: safeGet('lehar.youtubeApiKey') || import.meta.env.VITE_YOUTUBE_API_KEY || '',
});
export const saveConfig = ({ spotifyClientId, youtubeApiKey }) => {
  safeSet('lehar.spotifyClientId', spotifyClientId?.trim());
  safeSet('lehar.youtubeApiKey', youtubeApiKey?.trim());
};
export { safeGet, safeSet };
