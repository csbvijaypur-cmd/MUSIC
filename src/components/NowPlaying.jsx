import { useState } from 'react';
import Icon from './Icon.jsx';
import Lyrics, { LyricsLang } from './Lyrics.jsx';
import Visualizer from './Visualizer.jsx';
import { SourceBadge } from './TrackRow.jsx';
import { NowControls } from './PlayerBar.jsx';
import { useStore, jumpTo, removeAt, moveItem, setAutoplay, setShowVideo } from '../lib/store.js';

export function VideoSwitch() {
  const on = useStore((s) => s.showVideo);
  return <label className="switch"><input type="checkbox" checked={on} onChange={(e) => setShowVideo(e.target.checked)} /><span />Show music videos</label>;
}

export function AutoplaySwitch({ label = 'Autoplay similar songs' }) {
  const on = useStore((s) => s.autoplay);
  return <label className="switch"><input type="checkbox" checked={on} onChange={(e) => setAutoplay(e.target.checked)} /><span />{label}</label>;
}

function Queue() {
  const queue = useStore((s) => s.queue);
  const index = useStore((s) => s.index);
  const [drag, setDrag] = useState(null);
  if (!queue.length) return <div className="lyr-empty">Queue is empty</div>;
  return (
    <>
    <div className="q-auto"><AutoplaySwitch /></div>
    <ol className="queue">
      {queue.map((t, i) => (
        <li key={t.id + i} className={i === index ? 'cur' : i < index ? 'past' : ''} draggable
          onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null) moveItem(drag, i); setDrag(null); }}>
          <button className="q-main" onClick={() => jumpTo(i)}>
            {t.artSmall || t.art ? <img src={t.artSmall || t.art} alt="" loading="lazy" /> : <span className="q-ph" />}
            <span><b>{t.title}</b><small><SourceBadge source={t.source} /> {t.radio && <em className="q-similar">Similar</em>} {t.artist}</small></span>
          </button>
          {i > index + 1 && <button className="ib" onClick={() => moveItem(i, index + 1)} aria-label="Move up next"><Icon name="up" size={16} /></button>}
          {i !== index && <button className="ib" onClick={() => removeAt(i)} aria-label="Remove"><Icon name="trash" size={16} /></button>}
        </li>
      ))}
    </ol>
    </>
  );
}

export default function NowPlaying({ open, onClose, onKaraoke }) {
  const t = useStore((s) => s.queue[s.index]);
  const hasVideo = useStore((s) => s.videoVisible);
  const showVideo = useStore((s) => s.showVideo);
  const video = hasVideo && showVideo;
  const playing = useStore((s) => s.playing);
  const [tab, setTab] = useState('lyrics');
  return (
    <aside className={'now glass' + (open ? ' open' : '') + (video ? ' has-video' : '')} aria-label="Now playing">
      <button className="ib now-close" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
      <div className="now-stage">
        {/* The YouTube player is positioned over this slot when a YouTube song plays */}
        {!video && (
          <div className={'cover-wrap' + (playing ? ' playing' : '')}>
            <Visualizer mode="radial" className="cover-viz" />
            <div className="cover">{t?.art ? <img key={t.art} src={t.art} alt="" /> : <div className="cover-ph"><Icon name="play" size={48} /></div>}</div>
          </div>
        )}
      </div>
      <div className="now-meta">
        <h2 key={t?.id}>{t?.title || 'Dhun'}</h2>
        <p>{t ? <><SourceBadge source={t.source} /> {t.artist}{t.matchedFrom ? ' · via YouTube' : ''}</> : 'Nothing playing'}</p>
      </div>
      {t && <NowControls />}
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'lyrics'} onClick={() => setTab('lyrics')}>Lyrics</button>
        <button role="tab" aria-selected={tab === 'queue'} onClick={() => setTab('queue')}>Queue</button>
        {hasVideo && <button className={'ib vid-toggle' + (showVideo ? ' on' : '')} onClick={() => setShowVideo(!showVideo)} aria-pressed={showVideo} aria-label={showVideo ? 'Hide video' : 'Show video'} title={showVideo ? 'Hide video' : 'Show video'}><Icon name="video" size={18} /></button>}
        <button className="ib" onClick={onKaraoke} aria-label="Full-screen lyrics"><Icon name="expand" size={18} /></button>
      </div>
      {tab === 'lyrics' && <LyricsLang />}
      <div className="now-body">{tab === 'lyrics' ? <Lyrics /> : <Queue />}</div>
    </aside>
  );
}
