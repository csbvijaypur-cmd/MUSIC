// In-app updates for the Android app: compares this build with the latest GitHub Release.
export const BUILD = Number(import.meta.env.VITE_APP_BUILD || 0);
export const VERSION = '1.0.' + BUILD;
export const APK_URL = 'https://github.com/csbvijaypur-cmd/MUSIC/releases/latest/download/Dhun.apk';

/** Returns { latest: '1.0.N', newer: boolean, notes } */
export async function checkUpdate() {
  const res = await fetch('https://api.github.com/repos/csbvijaypur-cmd/MUSIC/releases/latest', { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error('Could not check (' + res.status + ')');
  const r = await res.json();
  const n = Number((r.tag_name || '').split('.').pop()) || 0;
  return { latest: '1.0.' + n, newer: n > BUILD, date: r.published_at };
}

export function downloadUpdate() {
  // Opens in the phone's browser, which downloads Dhun.apk; tapping it installs the update.
  window.open(APK_URL, '_blank');
}
