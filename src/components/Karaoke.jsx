import { useEffect } from 'react';
import Icon from './Icon.jsx';
import Lyrics, { LyricsLang } from './Lyrics.jsx';
import Visualizer from './Visualizer.jsx';
import { fmt } from './TrackRow.jsx';
import { useStore, toggle, next, prev } from '../lib/store.js';

export default function Karaoke({ onClose }) {
  const t = useStore((s) => s.queue[s.index]);
  const playing = useStore((s) => s.playing);
  const pos = useStore((s) => s.position);
  const dur = useStore((s) => s.duration);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => { removeEventListener('keydown', k); document.fullscreenElement && document.exitFullscreen().catch(() => {}); };
  }, [onClose]);
  return (
    <div className="karaoke" role="dialog" aria-label="Karaoke lyrics">
      <div className="k-bg" style={{ backgroundImage: t?.art ? `url("${t.art}")` : undefined }} />
      <div className="k-grid" />
      <Visualizer mode="bars" className="k-viz" />
      <header className="k-head">
        {t?.art && <img src={t.artSmall || t.art} alt="" />}
        <div><b>{t?.title}</b><span>{t?.artist}</span></div>
        <LyricsLang />
        <button className="ib" onClick={onClose} aria-label="Close karaoke"><Icon name="close" size={24} /></button>
      </header>
      <Lyrics big />
      <footer className="k-foot">
        <button className="ib" onClick={prev} aria-label="Previous"><Icon name="prev" /></button>
        <button className="play-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}><Icon name={playing ? 'pause' : 'play'} size={26} /></button>
        <button className="ib" onClick={() => next()} aria-label="Next"><Icon name="next" /></button>
        <div className="k-prog"><i style={{ width: dur ? (pos / dur) * 100 + '%' : 0 }} /></div>
        <span className="k-time">{fmt(pos)} / {fmt(dur)}</span>
      </footer>
    </div>
  );
}
