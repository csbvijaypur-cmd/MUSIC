// Spotify: Authorization Code + PKCE (no backend needed) and the official Web Playback SDK.
// Full-track playback needs the listener's own Spotify Premium account.
import { getConfig, safeGet, safeSet } from './config.js';

const SCOPES = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state';
export const redirectUri = () => window.location.origin + window.location.pathname;

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomStr = (n = 64) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => chars[x % chars.length]).join('');
};

export async function login() {
  const { spotifyClientId } = getConfig();
  if (!spotifyClientId) throw new Error('Settings me Spotify Client ID daalo pehle.');
  const verifier = randomStr();
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  sessionStorage.setItem('lehar.pkce', verifier);
  const p = new URLSearchParams({
    client_id: spotifyClientId, response_type: 'code', redirect_uri: redirectUri(),
    code_challenge_method: 'S256', code_challenge: challenge, scope: SCOPES,
  });
  window.location.href = 'https://accounts.spotify.com/authorize?' + p;
}

function storeTokens(t) {
  safeSet('lehar.sp.access', t.access_token);
  if (t.refresh_token) safeSet('lehar.sp.refresh', t.refresh_token);
  safeSet('lehar.sp.expires', String(Date.now() + (t.expires_in - 60) * 1000));
}

async function tokenRequest(body) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error('Spotify login fail hua (' + res.status + ')');
  const t = await res.json();
  storeTokens(t);
  return t.access_token;
}

/** Call once on app start: finishes the redirect back from Spotify if there is a ?code= */
export async function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return false;
  const verifier = sessionStorage.getItem('lehar.pkce');
  window.history.replaceState({}, '', redirectUri());
  if (!verifier) return false;
  await tokenRequest({ client_id: getConfig().spotifyClientId, grant_type: 'authorization_code', code, redirect_uri: redirectUri(), code_verifier: verifier });
  sessionStorage.removeItem('lehar.pkce');
  return true;
}

export const isLoggedIn = () => !!safeGet('lehar.sp.refresh') || !!safeGet('lehar.sp.access');
export function logout() { ['access', 'refresh', 'expires'].forEach((k) => safeSet('lehar.sp.' + k, '')); }

export async function getToken() {
  const access = safeGet('lehar.sp.access');
  if (access && Date.now() < Number(safeGet('lehar.sp.expires'))) return access;
  const refresh = safeGet('lehar.sp.refresh');
  if (!refresh) return null;
  return tokenRequest({ client_id: getConfig().spotifyClientId, grant_type: 'refresh_token', refresh_token: refresh });
}

async function api(path, opts = {}) {
  const token = await getToken();
  if (!token) throw new Error('Spotify login nahi hai');
  const res = await fetch('https://api.spotify.com/v1' + path, { ...opts, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error('Spotify API error ' + res.status);
  return res.headers.get('content-type')?.includes('json') ? res.json() : null;
}

export const toTrack = (t) => ({
  id: 'sp:' + t.id, source: 'spotify', uri: t.uri,
  title: t.name, artist: t.artists.map((a) => a.name).join(', '), album: t.album?.name || '',
  art: t.album?.images?.[0]?.url || '', artSmall: t.album?.images?.at(-1)?.url || t.album?.images?.[0]?.url || '',
  duration: Math.round(t.duration_ms / 1000),
});

export async function search(q) {
  const data = await api('/search?type=track&limit=12&q=' + encodeURIComponent(q));
  return data.tracks.items.map(toTrack);
}

// ---------- Web Playback SDK ----------
let sdkPromise;
const loadSdk = () => sdkPromise ||= new Promise((resolve) => {
  window.onSpotifyWebPlaybackSDKReady = () => resolve(window.Spotify);
  const s = document.createElement('script');
  s.src = 'https://sdk.scdn.co/spotify-player.js';
  document.head.appendChild(s);
});

let player = null, deviceId = null, readyPromise = null;

export function initPlayer(onState) {
  if (readyPromise) return readyPromise;
  readyPromise = loadSdk().then((Spotify) => new Promise((resolve, reject) => {
    player = new Spotify.Player({ name: 'Lehar Music', getOAuthToken: (cb) => getToken().then(cb), volume: 0.8 });
    player.addListener('ready', ({ device_id }) => { deviceId = device_id; resolve(player); });
    player.addListener('player_state_changed', (s) => s && onState(s));
    player.addListener('initialization_error', ({ message }) => reject(new Error(message)));
    player.addListener('authentication_error', ({ message }) => reject(new Error(message)));
    player.addListener('account_error', () => reject(new Error('Spotify full playback ke liye Premium account chahiye.')));
    player.connect();
  }));
  readyPromise.catch(() => { readyPromise = null; });
  return readyPromise;
}

export async function play(uri, onState) {
  await initPlayer(onState);
  await player.activateElement?.(); // required on mobile browsers
  await api('/me/player/play?device_id=' + deviceId, { method: 'PUT', body: JSON.stringify({ uris: [uri] }) });
}
export const pause = () => player?.pause();
export const resume = () => player?.resume();
export const seek = (sec) => player?.seek(Math.round(sec * 1000));
export const setVolume = (v) => player?.setVolume(v);
export const getPlayer = () => player;
