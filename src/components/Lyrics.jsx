import { useEffect, useRef } from 'react';
import { useStore, seek } from '../lib/store.js';

export default function Lyrics({ big = false }) {
  const lyrics = useStore((s) => s.lyrics);
  const pos = useStore((s) => s.position);
  const box = useRef(null);
  const lines = lyrics?.synced || [];
  let active = -1;
  for (let i = 0; i < lines.length; i++) if (lines[i].time <= pos + 0.25) active = i; else break;

  useEffect(() => {
    const el = box.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [active]);

  if (!lyrics) return <div className="lyr-empty">Play a song to see lyrics</div>;
  if (lyrics.loading) return <div className="lyr-empty"><span className="spinner" /> Finding lyrics…</div>;
  if (!lines.length) return lyrics.plain
    ? <div className={'lyrics plain' + (big ? ' big' : '')}>{lyrics.plain.split('\n').map((l, i) => <p key={i}>{l || ' '}</p>)}</div>
    : <div className="lyr-empty">No lyrics found</div>;

  return (
    <div className={'lyrics' + (big ? ' big' : '')} ref={box}>
      {lines.map((l, i) => (
        <button key={i} data-active={i === active} className={i === active ? 'on' : i < active ? 'past' : ''} onClick={() => seek(l.time)}>
          {l.text || '♪'}
        </button>
      ))}
    </div>
  );
}
