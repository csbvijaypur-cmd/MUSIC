import Icon from './Icon.jsx';
import Visualizer from './Visualizer.jsx';
import { fmt, SourceBadge } from './TrackRow.jsx';
import { useStore, toggle, next, prev, seek, setVolume, toggleShuffle, cycleRepeat, toggleLike } from '../lib/store.js';

export default function PlayerBar({ onKaraoke, onEq, onOpenNow }) {
  const t = useStore((s) => s.queue[s.index]);
  const playing = useStore((s) => s.playing);
  const loading = useStore((s) => s.loading);
  const pos = useStore((s) => s.position);
  const dur = useStore((s) => s.duration);
  const vol = useStore((s) => s.volume);
  const shuffle = useStore((s) => s.shuffle);
  const repeat = useStore((s) => s.repeat);
  const liked = useStore((s) => !!t && s.liked.some((x) => x.id === t.id));
  const pct = dur ? Math.min(100, (pos / dur) * 100) : 0;

  return (
    <footer className="bar glass">
      <Visualizer mode="bars" className="bar-viz" />
      <button className="bar-track" onClick={onOpenNow} disabled={!t} aria-label="Now playing">
        <span className={'bar-art' + (playing ? ' spin' : '')}>{t?.art && <img src={t.artSmall || t.art} alt="" />}</span>
        <span className="bar-meta">
          <span className="bar-title">{t ? t.title : 'Kuch nahi chal raha'}</span>
          <span className="bar-artist">{t ? <><SourceBadge source={t.source} /> {t.artist}</> : 'Search karo ya demo chalao'}</span>
        </span>
      </button>
      {t && <button className={'ib like-btn' + (liked ? ' liked' : '')} onClick={() => toggleLike(t)} aria-label="Like"><Icon name="heart" fill={liked} /></button>}

      <div className="bar-center">
        <div className="controls">
          <button className={'ib' + (shuffle ? ' on' : '')} onClick={toggleShuffle} aria-label="Shuffle" aria-pressed={shuffle}><Icon name="shuffle" size={18} /></button>
          <button className="ib" onClick={prev} aria-label="Previous"><Icon name="prev" /></button>
          <button className={'play-btn' + (loading ? ' loading' : '')} onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
            <Icon name={playing ? 'pause' : 'play'} size={24} />
          </button>
          <button className="ib" onClick={() => next()} aria-label="Next"><Icon name="next" /></button>
          <button className={'ib' + (repeat !== 'off' ? ' on' : '')} onClick={cycleRepeat} aria-label={'Repeat ' + repeat}>
            <Icon name="repeat" size={18} />{repeat === 'one' && <span className="one">1</span>}
          </button>
        </div>
        <div className="seek">
          <span>{fmt(pos)}</span>
          <input type="range" min="0" max={dur || 1} step="0.5" value={Math.min(pos, dur || 1)} style={{ '--p': pct + '%' }}
            onChange={(e) => seek(+e.target.value)} aria-label="Seek" />
          <span>{fmt(dur)}</span>
        </div>
      </div>

      <div className="bar-right">
        <button className="ib" onClick={onKaraoke} aria-label="Karaoke lyrics" title="Full-screen lyrics"><Icon name="lyrics" /></button>
        <button className="ib" onClick={onEq} aria-label="Equalizer" title="Equalizer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 4v16M12 4v16M18 4v16" /><circle cx="6" cy="14" r="2" fill="currentColor" /><circle cx="12" cy="8" r="2" fill="currentColor" /><circle cx="18" cy="16" r="2" fill="currentColor" /></svg>
        </button>
        <button className="ib" onClick={() => setVolume(vol > 0 ? 0 : 0.85)} aria-label="Mute"><Icon name={vol > 0 ? 'volume' : 'mute'} /></button>
        <input className="vol" type="range" min="0" max="1" step="0.01" value={vol} style={{ '--p': vol * 100 + '%' }} onChange={(e) => setVolume(+e.target.value)} aria-label="Volume" />
      </div>
    </footer>
  );
}
