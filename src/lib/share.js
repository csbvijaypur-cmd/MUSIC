// Share a song: native share sheet in the Android app, Web Share on phones, else WhatsApp/copy.
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { notify } from './store.js';

export const SITE = 'https://dhun-songs.netlify.app/';
export const shareLink = (t) => `${SITE}?play=${encodeURIComponent(`${t.title} ${t.artist || ''}`.trim())}`;

export async function shareSong(t) {
  if (!t) return;
  const url = shareLink(t);
  const text = `🎵 ${t.title}${t.artist ? ' · ' + t.artist : ''} on Dhun`;
  try {
    if (Capacitor.isNativePlatform()) return await Share.share({ title: t.title, text, url, dialogTitle: 'Share song' });
    if (navigator.share) return await navigator.share({ title: t.title, text, url });
  } catch (e) { if (e?.name === 'AbortError' || /cancel/i.test(e?.message || '')) return; }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); notify('Link copied'); }
  catch { window.open('https://wa.me/?text=' + encodeURIComponent(`${text}\n${url}`), '_blank'); }
}
