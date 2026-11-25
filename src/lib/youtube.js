// YouTube: Data API v3 for search + the official IFrame Player API for playback.
// The video stays visible (YouTube requires a visible player of at least 200x200).
import { getConfig } from './config.js';

const decode = (s) => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };

const parseDur = (iso) => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '') || [];
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
};

/** "Arijit Singh - Tum Hi Ho (Official Video) | Aashiqui 2" -> { artist, title } */
export function cleanTitle(raw, channel = '') {
  let t = raw.replace(/\[[^\]]*\]|\([^)]*(official|video|audio|lyric|lyrics|hd|4k|full song|visualizer|remaster)[^)]*\)/gi, '')
    .replace(/\|.*$/, '').replace(/\s+(ft\.?|feat\.?)\s.*$/i, '').replace(/official (music )?video|lyrical video|full video/gi, '')
    .replace(/\s{2,}/g, ' ').trim();
  let artist = channel.replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim();
  const dash = t.split(/\s[-–—]\s/);
  if (dash.length >= 2) { artist = dash[0].trim(); t = dash.slice(1).join(' - ').trim(); }
  return { artist, title: t };
}

export const videoIdFromUrl = (s) => {
  const m = /(?:youtu\.be\/|v=|\/shorts\/|\/embed\/)([\w-]{11})/.exec(s);
  return m ? m[1] : /^[\w-]{11}$/.test(s.trim()) ? s.trim() : null;
};

export const toTrack = (id, snippet, duration = 0) => {
  const { artist, title } = cleanTitle(decode(snippet.title), decode(snippet.channelTitle || ''));
  return {
    id: 'yt:' + id, source: 'youtube', videoId: id, title, artist, album: '',
    art: snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    artSmall: snippet.thumbnails?.default?.url || `https://i.ytimg.com/vi/${id}/default.jpg`, duration,
  };
};

export async function search(q) {
  const key = getConfig().youtubeApiKey;
  if (!key) throw new Error('YouTube API key nahi hai');
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&videoEmbeddable=true&maxResults=12&q=${encodeURIComponent(q)}&key=${key}`);
  if (!res.ok) throw new Error('YouTube API error ' + res.status);
  const data = await res.json();
  const ids = data.items.map((i) => i.id.videoId);
  let durs = {};
  try {
    const d = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids.join(',')}&key=${key}`)).json();
    d.items.forEach((v) => (durs[v.id] = parseDur(v.contentDetails.duration)));
  } catch {}
  return data.items.map((i) => toTrack(i.id.videoId, i.snippet, durs[i.id.videoId] || 0));
}

/** Pasted link works even without an API key (uses oEmbed for the title). */
export async function fromUrl(url) {
  const id = videoIdFromUrl(url);
  if (!id) return null;
  let snippet = { title: 'YouTube video', channelTitle: '' };
  try {
    const o = await (await fetch(`https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${id}`)).json();
    snippet = { title: o.title, channelTitle: o.author_name };
  } catch {}
  return toTrack(id, snippet);
}

let apiPromise;
export const loadApi = () => apiPromise ||= new Promise((resolve) => {
  if (window.YT?.Player) return resolve(window.YT);
  window.onYouTubeIframeAPIReady = () => resolve(window.YT);
  const s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(s);
});
