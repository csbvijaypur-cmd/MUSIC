import { useEffect, useRef } from 'react';
import { getAnalyser, getState } from '../lib/store.js';

// Radial (around the cover) or bars (wide). Uses a real FFT for Audius/demo audio.
// YouTube/Spotify audio is sealed inside their players, so there we animate a
// tempo-like simulation that only moves while music is playing.
export default function Visualizer({ mode = 'radial', className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, g = c.getContext('2d');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const N = mode === 'radial' ? 72 : 64;
    const data = new Uint8Array(128), level = new Float32Array(N);
    let raf, t = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const dpr = devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
      if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      const { playing, accent } = getState();
      const an = getAnalyser();
      t += 1 / 60;
      if (an) an.getByteFrequencyData(data);
      for (let i = 0; i < N; i++) {
        let v;
        if (an) v = data[Math.floor((i / N) ** 1.4 * 100)] / 255;
        else if (playing && !reduce) {
          const beat = Math.max(0, Math.sin(t * 7.5)) ** 6;
          v = 0.18 + 0.32 * Math.abs(Math.sin(i * 0.37 + t * 2.1)) * (0.6 + 0.4 * Math.sin(t * 1.3 + i)) + beat * 0.4 * (1 - i / N);
        } else v = 0.04;
        level[i] += (v - level[i]) * 0.25;
      }
      g.fillStyle = accent; g.strokeStyle = accent; g.shadowColor = accent; g.shadowBlur = 14;
      if (mode === 'radial') {
        const cx = w / 2, cy = h / 2, r0 = Math.min(w, h) * 0.36, len = Math.min(w, h) * 0.13;
        g.lineCap = 'round'; g.lineWidth = Math.max(2, (2 * Math.PI * r0) / N * 0.45);
        for (let i = 0; i < N; i++) {
          const a = (i / N) * Math.PI * 2 - Math.PI / 2, l = 3 + level[i] * len;
          g.globalAlpha = 0.35 + level[i] * 0.65;
          g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
          g.lineTo(cx + Math.cos(a) * (r0 + l), cy + Math.sin(a) * (r0 + l)); g.stroke();
        }
      } else {
        const bw = w / N;
        for (let i = 0; i < N; i++) {
          const bh = Math.max(2, level[i] * h);
          g.globalAlpha = 0.25 + level[i] * 0.6;
          g.fillRect(i * bw + bw * 0.2, h - bh, bw * 0.6, bh);
        }
      }
      g.globalAlpha = 1;
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [mode]);
  return <canvas ref={ref} className={'viz ' + className} aria-hidden="true" />;
}
