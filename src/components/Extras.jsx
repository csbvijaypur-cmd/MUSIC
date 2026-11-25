import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { useStore, setSleep, pickPlaylistFor, addToPlaylist, createPlaylist } from '../lib/store.js';
import { shareSong } from '../lib/share.js';

const OPTIONS = [[0, 'Off'], [15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '1 hour'], ['end', 'End of song']];

function useNow(on) {
  const [, set] = useState(0);
  useEffect(() => { if (!on) return; const id = setInterval(() => set((x) => x + 1), 15000); return () => clearInterval(id); }, [on]);
}

export function SleepButton({ up }) {
  const sleep = useStore((s) => s.sleep);
  const [open, setOpen] = useState(false);
  const ref = useRef(null), menu = useRef(null);
  const [pos, setPos] = useState(null);
  useNow(!!sleep?.at);
  useEffect(() => {
    if (!open) return;
    const r = ref.current.getBoundingClientRect();
    setPos(up ? { right: Math.max(8, innerWidth - r.right), bottom: innerHeight - r.top + 8 } : { right: Math.max(8, innerWidth - r.right), top: r.bottom + 8 });
    const h = (e) => !ref.current?.contains(e.target) && !menu.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', h);
    return () => document.removeEventListener('pointerdown', h);
  }, [open]);
  const left = sleep?.at ? Math.max(1, Math.round((sleep.at - Date.now()) / 60000)) : 0;
  const label = sleep ? (sleep.endOfSong ? 'Stops after this song' : `Stops in ${left} min`) : 'Sleep timer';
  return (
    <span className="pop-wrap" ref={ref}>
      <button className={'ib' + (sleep ? ' on' : '')} onClick={() => setOpen((v) => !v)} aria-label={label} title={label} aria-expanded={open}>
        <Icon name="moon" size={18} />{sleep?.at && <span className="ib-badge">{left}</span>}
      </button>
      {open && pos && createPortal(
        <div ref={menu} className="pop glass" style={pos} role="menu">
          <p className="pop-title">Sleep timer</p>
          {OPTIONS.map(([v, l]) => {
            const on = v === 0 ? !sleep : v === 'end' ? !!sleep?.endOfSong : sleep?.min === v;
            return <button key={l} role="menuitemradio" aria-checked={on} className={'pop-item' + (on ? ' on' : '')} onClick={() => { setSleep(v); setOpen(false); }}>{l}</button>;
          })}
        </div>, document.body
      )}
    </span>
  );
}

export const ShareButton = ({ t, size = 18 }) => (
  <button className="ib" onClick={() => shareSong(t)} aria-label="Share song" title="Share"><Icon name="share" size={size} /></button>
);
export const AddToPlaylistButton = ({ t, size = 18 }) => (
  <button className="ib" onClick={() => pickPlaylistFor(t)} aria-label="Add to playlist" title="Add to playlist"><Icon name="listplus" size={size} /></button>
);

/** Bottom sheet: pick a playlist for a song, or make a new one */
export function PlaylistSheet() {
  const t = useStore((s) => s.pickFor);
  const playlists = useStore((s) => s.playlists);
  const [name, setName] = useState('');
  useEffect(() => { setName(''); }, [t]);
  useEffect(() => {
    if (!t) return;
    const k = (e) => e.key === 'Escape' && pickPlaylistFor(null);
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [t]);
  if (!t) return null;
  const close = () => pickPlaylistFor(null);
  return (
    <div className="sheet-back" onClick={close}>
      <div className="sheet glass" role="dialog" aria-label="Add to playlist" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><b>Add to playlist</b><button className="ib" onClick={close} aria-label="Close"><Icon name="close" /></button></div>
        <p className="muted sheet-song">{t.title} · {t.artist}</p>
        <form className="sheet-new" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; createPlaylist(name, t); close(); }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New playlist name" aria-label="New playlist name" autoFocus={!playlists.length} />
          <button className="btn primary" disabled={!name.trim()}>Create</button>
        </form>
        <div className="sheet-list">
          {playlists.map((p) => {
            const has = p.tracks.some((x) => x.id === t.id);
            return (
              <button key={p.id} className="sheet-item" disabled={has} onClick={() => { addToPlaylist(p.id, t); close(); }}>
                <span className="pl-mini">{p.tracks[0]?.art ? <img src={p.tracks[0].artSmall || p.tracks[0].art} alt="" /> : <Icon name="lyrics" />}</span>
                <span><b>{p.name}</b><small>{p.tracks.length} songs{has ? ' · added' : ''}</small></span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
