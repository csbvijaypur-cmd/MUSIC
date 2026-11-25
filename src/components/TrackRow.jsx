import Icon from './Icon.jsx';
import { useStore, playTrack, addToQueue, playNextInQueue, toggleLike } from '../lib/store.js';

export const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const LABEL = { catalog: 'Song', youtube: 'YouTube', spotify: 'Spotify', audius: 'Audius', demo: 'Demo' };
export const SourceBadge = ({ source }) => <span className={'badge ' + source}>{LABEL[source]}</span>;

export default function TrackRow({ t, i, onPlay }) {
  const isCur = useStore((s) => s.queue[s.index]?.id === t.id);
  const playing = useStore((s) => s.playing);
  const liked = useStore((s) => s.liked.some((x) => x.id === t.id));
  return (
    <div className={'row' + (isCur ? ' cur' : '')} style={{ '--d': `${Math.min(i, 12) * 35}ms` }}>
      <button className="row-main" onClick={() => (onPlay ? onPlay() : playTrack(t))} aria-label={`Play ${t.title}`}>
        <span className="row-art">
          {t.artSmall || t.art ? <img src={t.artSmall || t.art} alt="" loading="lazy" /> : null}
          <span className="row-play">{isCur && playing ? <span className="eq"><i /><i /><i /></span> : <Icon name="play" size={18} />}</span>
        </span>
        <span className="row-text">
          <span className="row-title">{t.title}</span>
          <span className="row-sub"><SourceBadge source={t.source} /> {t.artist}</span>
        </span>
      </button>
      <span className="row-dur">{t.duration ? fmt(t.duration) : ''}</span>
      <span className="row-actions">
        <button className={'ib' + (liked ? ' liked' : '')} onClick={() => toggleLike(t)} aria-label="Like"><Icon name="heart" size={18} fill={liked} /></button>
        <button className="ib" onClick={() => playNextInQueue(t)} aria-label="Play next" title="Play next"><Icon name="playnext" size={18} /></button>
        <button className="ib" onClick={() => addToQueue(t)} aria-label="Add to queue" title="Add to queue"><Icon name="plus" size={18} /></button>
      </span>
    </div>
  );
}
