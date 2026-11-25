// Picks a vivid accent colour from album art so the whole UI re-themes per song.
const cache = new Map();

const hashColor = (s) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 70% 55%)`;
};

export function artColor(url, fallbackKey = '') {
  if (!url) return Promise.resolve(hashColor(fallbackKey));
  if (cache.has(url)) return cache.get(url);
  const job = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 24;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 24, 24);
        const d = ctx.getImageData(0, 0, 24, 24).data;
        let best = null, bestScore = -1;
        for (let i = 0; i < d.length; i += 4) {
          const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const sat = max ? (max - min) / max : 0, lum = (max + min) / 510;
          const score = sat * (1 - Math.abs(lum - 0.55) * 1.6);
          if (score > bestScore) { bestScore = score; best = [r, g, b]; }
        }
        resolve(best && bestScore > 0.15 ? `rgb(${best.join(' ')})` : hashColor(fallbackKey || url));
      } catch { resolve(hashColor(fallbackKey || url)); } // image host sent no CORS header
    };
    img.onerror = () => resolve(hashColor(fallbackKey || url));
    img.src = url;
  });
  cache.set(url, job);
  return job;
}

/** Warm the browser cache for the next track's artwork. */
export const preloadImage = (url) => { if (url) { const i = new Image(); i.src = url; } };
