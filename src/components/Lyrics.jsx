import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, seek, setState } from '../lib/store.js';
import { toRoman, translateLines } from '../lib/translit.js';

const MODES = [['original', 'Original'], ['roman', 'Hinglish'], ['english', 'English'], ['both', 'Both']];

export function LyricsLang() {
  const mode = useStore((s) => s.lyricsMode);
  return (
    <div className="lyr-lang" role="radiogroup" aria-label="Lyrics language">
      {MODES.map(([k, l]) => (
        <button key={k} role="radio" aria-checked={mode === k} className={mode === k ? 'on' : ''} onClick={() => setState({ lyricsMode: k })}>{l}</button>
      ))}
    </div>
  );
}

export default function Lyrics({ big = false }) {
  const lyrics = useStore((s) => s.lyrics);
  const pos = useStore((s) => s.position);
  const mode = useStore((s) => s.lyricsMode);
  const box = useRef(null);
  const lines = lyrics?.synced?.length ? lyrics.synced : null;
  const plainLines = useMemo(() => (lyrics?.plain ? lyrics.plain.split('\n') : []), [lyrics]);
  const [tr, setTr] = useState({});
  const [trNote, setTrNote] = useState('');

  const needEn = mode === 'english' || mode === 'both';
  useEffect(() => {
    setTr({}); setTrNote('');
    const src = lines ? lines.map((l) => l.text) : plainLines;
    if (!needEn || !src.length) return;
    const ac = new AbortController();
    translateLines(src, (o, t) => setTr((m) => ({ ...m, [o]: t })), ac.signal)
      .then((failed) => !ac.signal.aborted && failed && setTrNote('Some lines couldn’t be translated (free daily limit). Try again later.'));
    return () => ac.abort();
  }, [lyrics, needEn]);

  let active = -1;
  if (lines) for (let i = 0; i < lines.length; i++) if (lines[i].time <= pos + 0.25) active = i; else break;

  useEffect(() => {
    const el = box.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [active]);

  const show = (text) => {
    if (!text) return { main: '♪' };
    const en = tr[text.trim()];
    if (mode === 'roman') return { main: toRoman(text) };
    if (mode === 'english') return { main: en || text, pending: !en };
    if (mode === 'both') return { main: text, sub: en };
    return { main: text };
  };

  if (!lyrics) return <div className="lyr-empty">Play a song to see lyrics</div>;
  if (lyrics.loading) return <div className="lyr-empty"><span className="spinner" /> Finding lyrics…</div>;
  if (!lines && !plainLines.length) return <div className="lyr-empty">No lyrics found</div>;

  return (
    <div className={'lyrics' + (big ? ' big' : '') + (lines ? '' : ' plain')} ref={box}>
      {trNote && <p className="lyr-note">{trNote}</p>}
      {lines
        ? lines.map((l, i) => {
          const s = show(l.text);
          return (
            <button key={i} data-active={i === active} className={(i === active ? 'on' : i < active ? 'past' : '') + (s.pending ? ' pending' : '')} onClick={() => seek(l.time)}>
              {s.main}{s.sub && <small>{s.sub}</small>}
            </button>
          );
        })
        : plainLines.map((l, i) => { const s = show(l); return <p key={i}>{l ? s.main : ' '}{l && s.sub && <small>{s.sub}</small>}</p>; })}
    </div>
  );
}

/** One line of lyrics (the one being sung now), for the compact Now Playing view. */
export function LyricLine({ onOpen }) {
  const lyrics = useStore((s) => s.lyrics);
  const pos = useStore((s) => s.position);
  const mode = useStore((s) => s.lyricsMode);
  const lines = lyrics?.synced?.length ? lyrics.synced : null;
  let text = '';
  if (lyrics?.loading) text = 'Finding lyrics…';
  else if (lines) { let a = -1; for (let i = 0; i < lines.length; i++) if (lines[i].time <= pos + 0.25) a = i; else break; text = a < 0 ? '♪' : (lines[a].text || '♪'); }
  else if (lyrics?.plain) text = lyrics.plain.split('\n').find((l) => l.trim()) || '';
  else text = lyrics ? 'No lyrics found' : '';
  if (mode === 'roman' && text) text = toRoman(text);
  return (
    <button className="lyr-strip" onClick={onOpen} aria-label="Show full lyrics">
      <span className="lyr-line" key={text}>{text || '♪'}</span>
      <span className="lyr-open">Lyrics</span>
    </button>
  );
}
