import Icon from './Icon.jsx';
import Visualizer from './Visualizer.jsx';
import { fmt, SourceBadge } from './TrackRow.jsx';
import { useStore, toggle, next, prev, seek, livePosition, setVolume, toggleShuffle, cycleRepeat, toggleLike } from '../lib/store.js';

export function Seek() {
  const pos = useStore((s) => s.position);
  const dur = useStore((s) => s.duration);
  const pct = dur ? Math.min(100, (pos / dur) * 100) : 0;
  return (
    <div className="seek">
      <span>{fmt(pos)}</span>
      <input type="range" min="0" max={dur || 1} step="0.5" value={Math.min(pos, dur || 1)} style={{ '--p': pct + '%' }}
        onChange={(e) => seek(+e.target.value)} aria-label="Seek" />
      <span>{fmt(dur)}</span>
    </div>
  );
}

const Skip = ({ back }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={back ? undefined : { transform: 'scaleX(-1)' }}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4v4h4" /><text x="12" y="15.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none" style={back ? undefined : { transform: 'scaleX(-1)', transformOrigin: '12px 12px' }}>10</text>
  </svg>
);
export const skip = (s) => seek(Math.max(0, livePosition() + s));

/** Big controls for the phone's Now Playing screen: seek bar, -10 s / +10 s, prev / play / next */
export function NowControls() {
  const playing = useStore((s) => s.playing);
  const loading = useStore((s) => s.loading);
  const shuffle = useStore((s) => s.shuffle);
  const repeat = useStore((s) => s.repeat);
  return (
    <div className="now-controls">
      <Seek />
      <div className="controls big">
        <button className={'ib' + (shuffle ? ' on' : '')} onClick={toggleShuffle} aria-label="Shuffle" aria-pressed={shuffle}><Icon name="shuffle" size={18} /></button>
        <button className="ib" onClick={() => skip(-10)} aria-label="Back 10 seconds"><Skip back /></button>
        <button className="ib" onClick={prev} aria-label="Previous"><Icon name="prev" size={26} /></button>
        <button className={'play-btn' + (loading ? ' loading' : '')} onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}><Icon name={playing ? 'pause' : 'play'} size={28} /></button>
        <button className="ib" onClick={() => next()} aria-label="Next"><Icon name="next" size={26} /></button>
        <button className="ib" onClick={() => skip(10)} aria-label="Forward 10 seconds"><Skip /></button>
        <button className={'ib' + (repeat !== 'off' ? ' on' : '')} onClick={cycleRepeat} aria-label={'Repeat ' + repeat}><Icon name="repeat" size={18} />{repeat === 'one' && <span className="one">1</span>}</button>
      </div>
    </div>
  );
}

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
      <div className="bar-progress" style={{ width: pct + '%' }} aria-hidden="true" />
      <button className="bar-track" onClick={onOpenNow} disabled={!t} aria-label="Now playing">
        <span className={'bar-art' + (playing ? ' spin' : '')}>{t?.art && <img src={t.artSmall || t.art} alt="" />}</span>
        <span className="bar-meta">
          <span className="bar-title">{t ? t.title : 'Nothing playing'}</span>
          <span className="bar-artist">{t ? <><SourceBadge source={t.source} /> {t.artist}</> : 'Pick a song to start'}</span>
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
        <Seek />
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
