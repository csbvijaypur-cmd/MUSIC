// The unified player engine: one queue, many sources (YouTube, Audius, Spotify, demo).
// - YouTube: two IFrame players (A/B). The next video is buffered on the standby player
//   ~20 s before the current one ends, then we swap instantly => almost no gap.
// - Audius: two <audio> elements, next one preloads the same way. Real Web Audio analyser.
// - Spotify: Premium => official Web Playback SDK. Free => we keep Spotify's metadata and
//   play the matching song through the official YouTube player.
import { useSyncExternalStore } from 'react';
import * as YT from './youtube.js';
import * as SP from './spotify.js';
import { fetchLyrics } from './lyrics.js';
import { artColor, preloadImage } from './color.js';
import { createSynth } from './demo.js';
import { safeGet, safeSet, IS_APP } from './config.js';
import { similar } from './catalog.js';

// ---------------- tiny store ----------------
const saved = (() => { try { return JSON.parse(safeGet('dhun.state') || '{}'); } catch { return {}; } })();
let state = {
  queue: saved.queue || [], index: saved.index ?? -1, playing: false, loading: false,
  position: 0, duration: 0, volume: saved.volume ?? 0.85, shuffle: false, repeat: 'off',
  accent: saved.themeColor && saved.themeColor !== 'auto' ? saved.themeColor : 'rgb(124 97 255)', lyrics: null, error: '', liked: saved.liked || [],
  spotifyPremium: saved.spotifyPremium ?? false, themeColor: saved.themeColor || 'auto', lyricsMode: saved.lyricsMode || 'original', autoplay: saved.autoplay ?? true, showVideo: IS_APP ? false : saved.showVideo ?? true, history: saved.history || [], playlists: saved.playlists || [], sleep: null, notice: '', eq: saved.eq || [0, 0, 0, 0, 0], eqPreset: saved.eqPreset || 'Flat', videoVisible: false, activeKind: null,
};
const listeners = new Set();
export const getState = () => state;
export function setState(patch) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  listeners.forEach((l) => l());
}
export const useStore = (sel) => useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => sel(state));
listeners.add(() => {
  const { queue, index, volume, liked, spotifyPremium, eq, eqPreset, themeColor, lyricsMode, autoplay, showVideo, history, playlists } = state;
  safeSet('dhun.state', JSON.stringify({ queue: queue.slice(-200), index: Math.max(-1, index - Math.max(0, queue.length - 200)), volume, liked, spotifyPremium, eq, eqPreset, themeColor, lyricsMode, autoplay, showVideo, history, playlists }));
});
const current = () => state.queue[state.index];

// ---------------- audio graph (Audius + demo) ----------------
let ctx, analyser, master, synth, eqNodes = [];
export const EQ_BANDS = [
  { key: 'bass', label: 'Bass', type: 'lowshelf', freq: 110 },
  { key: 'low', label: 'Low-mid', type: 'peaking', freq: 450 },
  { key: 'mid', label: 'Mid', type: 'peaking', freq: 1500 },
  { key: 'pres', label: 'Presence', type: 'peaking', freq: 4000 },
  { key: 'treble', label: 'Treble', type: 'highshelf', freq: 9000 },
];
export const EQ_PRESETS = {
  Flat: [0, 0, 0, 0, 0], 'Bass Boost': [8, 3, 0, 0, 1], 'Bass Max': [12, 5, -1, 0, 0],
  Vocal: [-2, 0, 3, 4, 1], Bollywood: [4, 1, 2, 3, 2], Lofi: [3, 2, -1, -3, -5], Club: [7, 0, -1, 2, 4],
};
function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.82;
    master = ctx.createGain(); master.gain.value = state.volume;
    eqNodes = EQ_BANDS.map((b, i) => {
      const f = ctx.createBiquadFilter(); f.type = b.type; f.frequency.value = b.freq; f.Q.value = 0.9; f.gain.value = state.eq[i]; return f;
    });
    // Soft limiter so bass boost never clips/distorts.
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -6; comp.knee.value = 6; comp.ratio.value = 8;
    [master, ...eqNodes, comp, analyser, ctx.destination].reduce((a, b) => a.connect(b));
    synth = createSynth(ctx, master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
/** Returns a live AnalyserNode when the current source exposes real audio, else null. */
export const getAnalyser = () => (['audius', 'demo'].includes(state.activeKind) && analyser) || null;

const els = [new Audio(), new Audio()];
let elActive = 0;
els.forEach((el, i) => {
  el.preload = 'auto'; el.crossOrigin = 'anonymous';
  el.addEventListener('ended', () => i === elActive && state.activeKind === 'audius' && onEnded());
  el.addEventListener('playing', () => i === elActive && setState({ playing: true, loading: false }));
  el.addEventListener('pause', () => i === elActive && state.activeKind === 'audius' && setState({ playing: false }));
  el.addEventListener('waiting', () => i === elActive && setState({ loading: true }));
  el.addEventListener('error', () => {
    if (el.crossOrigin && el.src) { el.crossOrigin = null; const s = el.src; el.src = s; if (i === elActive) el.play().catch(() => {}); } // retry without CORS
    else if (i === elActive && state.activeKind === 'audius') fail('Couldn’t stream this track');
  });
});
let wired = new WeakSet();
function wire(el) {
  audio();
  if (!wired.has(el) && el.crossOrigin) { try { ctx.createMediaElementSource(el).connect(master); wired.add(el); } catch {} }
}

// ---------------- YouTube A/B players ----------------
const yt = { players: [null, null], active: 0, ready: null, preloadedFor: null };
export function mountYouTube(elA, elB) {
  if (yt.ready) return yt.ready;
  yt.ready = YT.loadApi().then((api) => Promise.all([elA, elB].map((el, i) => new Promise((resolve) => {
    const p = new api.Player(el, {
      width: '100%', height: '100%',
      playerVars: { playsinline: 1, controls: 0, rel: 0, modestbranding: 1, iv_load_policy: 3, disablekb: 1, origin: location.origin },
      events: {
        onReady: () => { p.setVolume(state.volume * 100); resolve(p); },
        onStateChange: (e) => {
          if (i !== yt.active) {
            // standby buffered enough: hold it paused at 0
            if (e.data === 1 && yt.preloading) { p.pauseVideo(); p.seekTo(0, true); p.unMute(); yt.preloading = false; }
            return;
          }
          if (state.activeKind !== 'youtube') return;
          if (e.data === 0) onEnded();
          else if (e.data === 1) { setState({ playing: true, loading: false, duration: p.getDuration() || state.duration }); try { p.setPlaybackQuality('highres'); } catch {} }
          else if (e.data === 2) setState({ playing: false });
          else if (e.data === 3) setState({ loading: true });
        },
        onError: (e) => i === yt.active && fail(e.data === 150 || e.data === 101 ? 'This video can’t be played here. Skipping.' : 'YouTube error ' + e.data, true),
      },
    });
    yt.players[i] = p;
  }))));
  return yt.ready;
}
const ytActive = () => yt.players[yt.active];

// ---------------- resolve Spotify -> YouTube (free mode) ----------------
const matchCache = new Map();
const savedMatches = (() => { try { return JSON.parse(safeGet('dhun.matches') || '{}'); } catch { return {}; } })();
async function resolvePlayable(t) {
  if (t.source === 'spotify' && state.spotifyPremium && SP.isLoggedIn()) return t;
  if (t.source !== 'spotify' && t.source !== 'catalog') return t;
  const asYt = (videoId) => ({ ...t, source: 'youtube', videoId, matchedFrom: t.source });
  if (savedMatches[t.id]) return asYt(savedMatches[t.id]); // saves YouTube API quota
  if (matchCache.has(t.id)) return matchCache.get(t.id);
  const job = YT.search(`${t.artist.split(',')[0]} ${t.title} official audio`).then((list) => {
    const near = list.find((v) => v.duration && Math.abs(v.duration - t.duration) <= 6) || list[0];
    if (!near) throw new Error('No match found on YouTube');
    savedMatches[t.id] = near.videoId;
    const keys = Object.keys(savedMatches); if (keys.length > 2000) delete savedMatches[keys[0]];
    safeSet('dhun.matches', JSON.stringify(savedMatches));
    return asYt(near.videoId);
  });
  matchCache.set(t.id, job);
  job.catch(() => matchCache.delete(t.id));
  return job;
}

// ---------------- core playback ----------------
let token = 0;
function stopAll(except) {
  if (except !== 'youtube') yt.players.forEach((p) => p?.pauseVideo?.());
  if (except !== 'audius') els.forEach((e) => e.pause());
  if (except !== 'demo') synth?.stop();
  if (except !== 'spotify' && state.activeKind === 'spotify') SP.pause();
}
function fail(msg, skip) {
  setState({ error: msg, loading: false });
  setTimeout(() => state.error === msg && setState({ error: '' }), 4500);
  if (skip && state.index < state.queue.length - 1) setTimeout(next, 1200);
}

async function start(from = 0) {
  const t = current();
  if (!t) return;
  const my = ++token;
  setState({ loading: true, position: from, duration: t.duration || 0, error: '', lyrics: null });
  theme(t); lyricsFor(t); mediaSession(t); autoExtend(); remember(t);
  try {
    const p = await resolvePlayable(t);
    if (my !== token) return;
    stopAll(p.source);
    setState({ activeKind: p.source, videoVisible: p.source === 'youtube' });
    if (p.source === 'youtube') {
      await yt.ready;
      const standby = yt.players[1 - yt.active];
      if (yt.preloadedFor === p.videoId && from === 0) { // gapless swap
        ytActive().pauseVideo(); yt.active = 1 - yt.active; standby.unMute(); standby.setVolume(state.volume * 100); standby.playVideo();
      } else { ytActive().loadVideoById({ videoId: p.videoId, startSeconds: from }); }
      yt.preloadedFor = null;
      setState({ ytActive: yt.active });
    } else if (p.source === 'audius') {
      const other = els[1 - elActive];
      if (other.dataset.id === p.id) { els[elActive].pause(); elActive = 1 - elActive; }
      const el = els[elActive];
      if (el.dataset.id !== p.id) { el.crossOrigin = 'anonymous'; el.src = p.stream; el.dataset.id = p.id; }
      wire(el); el.volume = 1; master.gain.value = state.volume;
      el.currentTime = from; await el.play();
    } else if (p.source === 'demo') {
      audio(); master.gain.value = state.volume; synth.play(p, from); setState({ playing: true, loading: false });
    } else if (p.source === 'spotify') {
      await SP.play(p.uri, onSpotifyState); if (from) SP.seek(from);
    }
  } catch (e) {
    if (my === token) fail(e.message || 'Couldn’t play', true);
  }
}

function onSpotifyState(s) {
  if (state.activeKind !== 'spotify') return;
  spPos = { at: performance.now(), pos: s.position / 1000, paused: s.paused };
  setState({ playing: !s.paused, loading: s.loading, duration: s.duration / 1000 });
  if (s.paused && s.position === 0 && s.track_window.previous_tracks.some((x) => x.uri === current()?.uri)) onEnded();
}
let spPos = { at: 0, pos: 0, paused: true };

function onEnded() {
  if (state.sleep?.endOfSong) { setState({ sleep: null, playing: false }); notify('Sleep timer: good night 🌙'); return; }
  if (state.repeat === 'one') return start(0);
  next(true);
}

// ---------------- public controls ----------------
export function playList(list, i = 0) {
  audio(); // unlock audio inside the click
  setState({ queue: list, index: i });
  start();
}
export function playTrack(t) {
  audio();
  const i = state.queue.findIndex((x) => x.id === t.id);
  if (i >= 0) { setState({ index: i }); return start(); }
  const q = [...state.queue]; q.splice(state.index + 1, 0, t);
  setState({ queue: q, index: state.index + 1 });
  start();
}
export function addToQueue(t) { setState((s) => ({ queue: [...s.queue, t], index: s.index < 0 ? 0 : s.index })); preloadNext(); }
export function playNextInQueue(t) { setState((s) => { const q = [...s.queue]; q.splice(s.index + 1, 0, t); return { queue: q }; }); preloadNext(); }
export function removeAt(i) {
  setState((s) => { const q = s.queue.filter((_, j) => j !== i); return { queue: q, index: i < s.index ? s.index - 1 : s.index }; });
}
export function moveItem(from, to) {
  setState((s) => {
    const q = [...s.queue]; const [x] = q.splice(from, 1); q.splice(to, 0, x);
    let idx = s.index;
    if (from === s.index) idx = to; else if (from < s.index && to >= s.index) idx--; else if (from > s.index && to <= s.index) idx++;
    return { queue: q, index: idx };
  });
}
export function jumpTo(i) { audio(); setState({ index: i }); start(); }

export function toggle() {
  const k = state.activeKind;
  if (!current()) return;
  if (!k) return start();
  if (state.playing) {
    if (k === 'youtube') ytActive()?.pauseVideo(); else if (k === 'audius') els[elActive].pause();
    else if (k === 'demo') { demoOffset = synth.pauseAt(); setState({ playing: false }); } else SP.pause();
  } else {
    audio();
    if (k === 'youtube') ytActive()?.playVideo(); else if (k === 'audius') els[elActive].play();
    else if (k === 'demo') { synth.play(current(), demoOffset); setState({ playing: true }); } else SP.resume();
  }
}
let demoOffset = 0;

function nextIndex(auto) {
  const n = state.queue.length;
  if (!n) return -1;
  if (state.shuffle) { if (n === 1) return 0; let r; do r = Math.floor(Math.random() * n); while (r === state.index); return r; }
  if (state.index + 1 < n) return state.index + 1;
  return state.repeat === 'all' || !auto ? 0 : -1;
}
// ---------------- autoplay: keep similar songs coming ----------------
let extending = null;
export function autoExtend() {
  const t = current();
  if (!t || !state.autoplay || state.repeat === 'all' || state.index < state.queue.length - 2) return Promise.resolve();
  if (extending) return extending;
  extending = similar(t, state.queue)
    .then((more) => { if (more.length) { setState((s) => ({ queue: [...s.queue, ...more] })); preloadNext(); } })
    .catch(() => {})
    .finally(() => { extending = null; });
  return extending;
}
export const setShowVideo = (on) => setState({ showVideo: on });
export const setAutoplay = (on) => { setState({ autoplay: on }); if (on) autoExtend(); };

export async function next(auto = false) {
  let i = nextIndex(auto === true);
  if (i < 0 && state.autoplay) { await autoExtend(); i = nextIndex(auto === true); }
  if (i < 0) { setState({ playing: false }); return; }
  setState({ index: i }); start();
}
export function prev() {
  if (position() > 4) return seek(0);
  setState({ index: Math.max(0, state.index - 1) }); start();
}
export function seek(sec) {
  const k = state.activeKind;
  if (k === 'youtube') ytActive()?.seekTo(sec, true);
  else if (k === 'audius') els[elActive].currentTime = sec;
  else if (k === 'demo') { demoOffset = sec; if (state.playing) synth.play(current(), sec); }
  else if (k === 'spotify') { SP.seek(sec); spPos = { ...spPos, at: performance.now(), pos: sec }; }
  setState({ position: sec });
}
export function setVolume(v) {
  setState({ volume: v });
  yt.players.forEach((p) => p?.setVolume?.(v * 100));
  if (master) master.gain.value = v;
  SP.setVolume(v);
}
export function setEq(eq, eqPreset = 'Custom') {
  setState({ eq, eqPreset });
  eqNodes.forEach((f, i) => f.gain.setTargetAtTime(eq[i], ctx.currentTime, 0.05));
}
export const toggleShuffle = () => setState((s) => ({ shuffle: !s.shuffle }));
export const cycleRepeat = () => setState((s) => ({ repeat: { off: 'all', all: 'one', one: 'off' }[s.repeat] }));
export const toggleLike = (t) => setState((s) => ({ liked: s.liked.some((x) => x.id === t.id) ? s.liked.filter((x) => x.id !== t.id) : [t, ...s.liked] }));

// ---------------- position clock + preloading ----------------
function position() {
  const k = state.activeKind;
  try {
    if (k === 'youtube') return ytActive()?.getCurrentTime?.() || 0;
    if (k === 'audius') return els[elActive].currentTime || 0;
    if (k === 'demo') return state.playing ? synth.position() : demoOffset;
    if (k === 'spotify') return spPos.paused ? spPos.pos : spPos.pos + (performance.now() - spPos.at) / 1000;
  } catch {}
  return 0;
}
export const livePosition = position;

setInterval(() => {
  if (!state.playing) return;
  if (state.sleep?.at && Date.now() >= state.sleep.at) { setState({ sleep: null }); toggle(); notify('Sleep timer: good night 🌙'); return; }
  const pos = position();
  const dur = state.activeKind === 'audius' ? els[elActive].duration || state.duration : state.duration;
  if (state.activeKind === 'demo' && pos >= dur) { synth.stop(); return onEnded(); }
  setState({ position: pos, duration: dur });
  if (dur && dur - pos < 20) preloadNext();
}, 250);

let preloadKey = null;
async function preloadNext() {
  const i = state.shuffle ? -1 : nextIndex(true);
  const t = state.queue[i];
  if (!t || i === state.index || preloadKey === t.id + state.index) return;
  preloadKey = t.id + state.index;
  preloadImage(t.art); fetchLyrics(t).catch(() => {}); artColor(t.art, t.id);
  try {
    const p = await resolvePlayable(t);
    if (p.source === 'youtube' && state.activeKind === 'youtube' && yt.players[1]) {
      const standby = yt.players[1 - yt.active];
      yt.preloading = true; standby.mute(); standby.loadVideoById(p.videoId, 0); yt.preloadedFor = p.videoId;
    } else if (p.source === 'audius') {
      const el = els[1 - elActive];
      if (el.dataset.id !== p.id) { el.crossOrigin = 'anonymous'; el.src = p.stream; el.dataset.id = p.id; el.load(); }
    }
  } catch {}
}

// ---------------- theme, lyrics, OS media controls ----------------
async function theme(t) {
  if (state.themeColor !== 'auto') return;
  const c = t.color || (await artColor(t.art, t.id));
  if (current()?.id === t.id && state.themeColor === 'auto') setState({ accent: c });
}
export function setThemeColor(c) {
  setState({ themeColor: c, accent: c === 'auto' ? 'rgb(124 97 255)' : c });
  if (c === 'auto' && current()) theme(current());
}
async function lyricsFor(t) {
  setState({ lyrics: { loading: true } });
  try {
    const l = await fetchLyrics(t);
    if (current()?.id === t.id) setState({ lyrics: l });
  } catch { if (current()?.id === t.id) setState({ lyrics: { synced: [], plain: '' } }); }
}
function mediaSession(t) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: t.album, artwork: t.art?.startsWith('http') ? [{ src: t.art, sizes: '512x512' }] : [] });
  const h = { play: toggle, pause: toggle, nexttrack: () => next(), previoustrack: prev, seekto: (d) => seek(d.seekTime) };
  for (const [k, fn] of Object.entries(h)) { try { navigator.mediaSession.setActionHandler(k, fn); } catch {} }
}

// ---------------- small notices (toast) ----------------
export function notify(msg) {
  setState({ notice: msg });
  setTimeout(() => state.notice === msg && setState({ notice: '' }), 3000);
}

// ---------------- recently played ----------------
const slim = (t) => { const { radio, ...rest } = t; return rest; };
function remember(t) {
  if (!t || t.source === 'demo') return;
  setState((s) => ({ history: [slim(t), ...s.history.filter((x) => x.id !== t.id)].slice(0, 50) }));
}
export const clearHistory = () => setState({ history: [] });

// ---------------- playlists ----------------
export function createPlaylist(name, first) {
  const p = { id: 'pl' + Date.now().toString(36), name: name.trim() || 'My playlist', tracks: first ? [slim(first)] : [] };
  setState((s) => ({ playlists: [...s.playlists, p] }));
  if (first) notify(`Added to ${p.name}`);
  return p.id;
}
export function importPlaylist(name, tracks) {
  const p = { id: 'pl' + Date.now().toString(36), name: name || 'Spotify playlist', tracks: tracks.map(slim), from: 'spotify' };
  setState((s) => ({ playlists: [...s.playlists, p] }));
  notify(`Imported ${tracks.length} songs`);
  return p.id;
}
export function addToPlaylist(pid, t) {
  const p = state.playlists.find((x) => x.id === pid);
  if (!p) return;
  if (p.tracks.some((x) => x.id === t.id)) return notify(`Already in ${p.name}`);
  setState((s) => ({ playlists: s.playlists.map((x) => (x.id === pid ? { ...x, tracks: [...x.tracks, slim(t)] } : x)) }));
  notify(`Added to ${p.name}`);
}
export const removeFromPlaylist = (pid, tid) => setState((s) => ({ playlists: s.playlists.map((x) => (x.id === pid ? { ...x, tracks: x.tracks.filter((t) => t.id !== tid) } : x)) }));
export const renamePlaylist = (pid, name) => setState((s) => ({ playlists: s.playlists.map((x) => (x.id === pid ? { ...x, name: name.trim() || x.name } : x)) }));
export const deletePlaylist = (pid) => setState((s) => ({ playlists: s.playlists.filter((x) => x.id !== pid) }));
/** Song waiting for the "Add to playlist" sheet */
export const pickPlaylistFor = (t) => setState({ pickFor: t || null });

// ---------------- sleep timer ----------------
export function setSleep(min) {
  if (!min) { setState({ sleep: null }); return notify('Sleep timer off'); }
  if (min === 'end') { setState({ sleep: { endOfSong: true } }); return notify('Music stops after this song'); }
  setState({ sleep: { at: Date.now() + min * 60000, min } });
  notify(`Music stops in ${min} min`);
}
