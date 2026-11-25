import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from './components/Icon.jsx';
import PlayerBar from './components/PlayerBar.jsx';
import NowPlaying from './components/NowPlaying.jsx';
import Karaoke from './components/Karaoke.jsx';
import Equalizer from './components/Equalizer.jsx';
import { PlaylistSheet } from './components/Extras.jsx';
import { Home, Search, Library, Settings, Collection } from './components/Views.jsx';
import { useStore, setState, mountYouTube, toggle, seek, next, livePosition, getState } from './lib/store.js';
import * as SP from './lib/spotify.js';
import { IS_APP } from './lib/config.js';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

const NAV = [['home', 'Home', 'home'], ['search', 'Search', 'search'], ['library', 'Liked', 'heart'], ['settings', 'Settings', 'settings']];

// Full screen for the video: real browser full screen where allowed (desktop, Android),
// otherwise (iPhone Safari) the stage simply covers the whole window.
const isFull = () => !!document.fullscreenElement || !!document.querySelector('.yt-stage.fs');
export function toggleVideoFullscreen() {
  const el = document.querySelector('.yt-stage');
  if (!el || !getState().videoVisible && !isFull()) return;
  if (isFull()) {
    el.classList.remove('fs');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    screen.orientation?.unlock?.();
    return;
  }
  const pseudo = () => el.classList.add('fs');
  // In the Android app the window is already full; covering it keeps the Back button working.
  if (el.requestFullscreen && !Capacitor.isNativePlatform()) {
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation?.lock?.('landscape').catch(() => {}))
      .catch(pseudo);
  } else pseudo();
}

function VideoStage() {
  const a = useRef(null), b = useRef(null), box = useRef(null);
  const visible = useStore((s) => s.videoVisible);
  const showVideo = useStore((s) => s.showVideo);
  const active = useStore((s) => s.ytActive ?? 0);
  const [full, setFull] = useState(false);
  useEffect(() => { mountYouTube(a.current, b.current); }, []);
  useEffect(() => {
    const h = () => { setFull(isFull()); if (!document.fullscreenElement) screen.orientation?.unlock?.(); };
    document.addEventListener('fullscreenchange', h);
    const obs = new MutationObserver(h); obs.observe(box.current, { attributes: true, attributeFilter: ['class'] });
    return () => { document.removeEventListener('fullscreenchange', h); obs.disconnect(); };
  }, []);
  // App: drag the floating video tile anywhere by its handle (the video itself takes taps).
  useEffect(() => {
    if (!IS_APP) return;
    const root = document.documentElement;
    const pos = (() => { try { return JSON.parse(localStorage.getItem('dhun.vpos')) || { x: 0, y: 0 }; } catch { return { x: 0, y: 0 }; } })();
    const apply = () => { root.style.setProperty('--vdx', pos.x + 'px'); root.style.setProperty('--vdy', pos.y + 'px'); };
    apply();
    const h = box.current.querySelector('.yt-drag');
    let st = null;
    const limits = (r) => {
      const barTop = document.querySelector('.bar')?.getBoundingClientRect().top ?? innerHeight;
      const top = (parseFloat(getComputedStyle(root).getPropertyValue('--sat')) || 0) + 8;
      return { minX: pos.x - (r.left - 8), maxX: pos.x + (innerWidth - 8 - r.right), minY: pos.y - (r.top - top), maxY: pos.y + (barTop - 8 - r.bottom) };
    };
    const clamp = (v, a, b) => Math.min(Math.max(v, Math.min(a, b)), b);
    const down = (e) => {
      if (!box.current.classList.contains('mini')) return;
      e.preventDefault(); h.setPointerCapture(e.pointerId);
      st = { sx: e.clientX, sy: e.clientY, x: pos.x, y: pos.y, lim: limits(box.current.getBoundingClientRect()) };
      box.current.classList.add('dragging');
    };
    const move = (e) => {
      if (!st) return;
      pos.x = clamp(st.x + e.clientX - st.sx, st.lim.minX, st.lim.maxX);
      pos.y = clamp(st.y + e.clientY - st.sy, st.lim.minY, st.lim.maxY);
      apply();
    };
    const up = () => {
      if (!st) return;
      // Snap to the nearer side edge
      pos.x = Math.abs(pos.x - st.lim.minX) < Math.abs(pos.x - st.lim.maxX) ? st.lim.minX : st.lim.maxX;
      st = null; box.current.classList.remove('dragging'); apply();
      localStorage.setItem('dhun.vpos', JSON.stringify(pos));
    };
    h.addEventListener('pointerdown', down); h.addEventListener('pointermove', move);
    h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
    return () => { h.removeEventListener('pointerdown', down); h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); };
  }, []);
  // Leave full screen when the video goes away (e.g. next song is not a video)
  useEffect(() => { if (!visible && isFull()) toggleVideoFullscreen(); }, [visible]);
  // Float the (always-mounted) player over the Now Playing slot, or as a mini card.
  useLayoutEffect(() => {
    let raf;
    let lastKey = '';
    const place = () => {
      raf = requestAnimationFrame(place);
      // Nothing to place while no YouTube song is on
      if (!getState().videoVisible) { if (lastKey) { document.documentElement.classList.remove('yt-mini'); lastKey = ''; } return; }
      const el = box.current;
      if (isFull()) return;
      const karaokeOn = !!document.querySelector('.karaoke');
      // Where the player may sit: the Now Playing cover spot, or (in the app) the Home hero art spot.
      const fits = (n) => {
        if (!n) return null;
        const r = n.getBoundingClientRect();
        const ok = r.width >= 180 && r.left < innerWidth - 50 && r.top >= 0 && r.bottom <= innerHeight - 40 && r.top < innerHeight && r.bottom > 0
          && (!n.closest('.now') || innerWidth > 900 || n.closest('.now').classList.contains('open'));
        return ok ? r : null;
      };
      const nowSlot = (getState().showVideo || IS_APP) ? fits(document.querySelector('.now-stage')) : null;
      const r = karaokeOn ? null : nowSlot || (IS_APP ? fits(document.querySelector('[data-video-slot]')) : null);
      const onScreen = !!r;
      document.documentElement.classList.toggle('yt-mini', !onScreen);
      const key = onScreen ? `${r.left|0},${r.top|0},${r.width|0},${r.height|0}` : 'mini';
      if (key === lastKey) return; // avoid style writes every frame
      lastKey = key;
      if (onScreen) {
        el.classList.remove('mini');
        el.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${IS_APP ? Math.max(200, r.width) : Math.max(200, r.height)}px`;
      } else { el.classList.add('mini'); el.style.cssText = ''; }
    };
    place();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div ref={box} className={'yt-stage' + (visible ? ' show' : '') + (showVideo ? '' : ' hidden-video')} aria-hidden={!visible}>
      <div className={'yt-slot' + (active === 0 ? ' active' : '')}><div ref={a} /></div>
      <div className={'yt-slot' + (active === 1 ? ' active' : '')}><div ref={b} /></div>
      {IS_APP && <button className="yt-drag" aria-label="Move video"><Icon name="move" size={18} /></button>}
      <button className="yt-fs" onClick={toggleVideoFullscreen} aria-label={full ? 'Make video small' : 'Make video big'} title={IS_APP ? undefined : (full ? 'Exit full screen (F)' : 'Full screen (F)')}>
        <Icon name={full ? 'shrink' : 'expand'} size={IS_APP ? 20 : 18} />
      </button>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState('home');
  const [q0, setQ0] = useState('');
  const [col, setCol] = useState(null);
  const go = useCallback((v, q) => { if (v === 'collection') setCol(q); else setQ0(q || ''); setView(v); document.querySelector('.main')?.scrollTo?.(0, 0); }, []);
  const [nowOpen, setNowOpen] = useState(false);
  const [karaoke, setKaraoke] = useState(false);
  const [eq, setEq] = useState(false);
  const accent = useStore((s) => s.accent);
  const error = useStore((s) => s.error);
  const notice = useStore((s) => s.notice);
  const art = useStore((s) => s.queue[s.index]?.art);

  // Shared song links: ?play=Song%20Artist opens search for it
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('play');
    if (q) { go('search', q); history.replaceState(null, '', location.pathname); }
  }, []);
  useEffect(() => { SP.handleRedirect().then((ok) => ok && setView('settings')).catch(() => {}); }, []);
  useEffect(() => { document.documentElement.style.setProperty('--accent', accent); document.querySelector('meta[name=theme-color]')?.setAttribute('content', '#07070d'); }, [accent]);

  const closeKaraoke = useCallback(() => setKaraoke(false), []);

  // Phone Back button (Android app): close whatever is open first, step by step.
  // Only when nothing is open does it leave the app (to the background, music keeps playing).
  const ui = useRef({});
  ui.current = { view, nowOpen, karaoke, eq };
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const back = () => {
      const u = ui.current;
      if (document.fullscreenElement || document.querySelector('.yt-stage.fs')) {
        if (document.querySelector('.yt-stage.fs') || document.fullscreenElement?.classList.contains('yt-stage')) toggleVideoFullscreen();
        else document.exitFullscreen().catch(() => {});
        if (u.karaoke) setKaraoke(false);
        return;
      }
      if (getState().pickFor) return setState({ pickFor: null });
      if (u.karaoke) return setKaraoke(false);
      if (u.eq) return setEq(false);
      if (u.nowOpen) return setNowOpen(false);
      if (u.view !== 'home') return setView('home');
      CapApp.minimizeApp();
    };
    const h = CapApp.addListener('backButton', back);
    return () => { h.then((x) => x.remove()); };
  }, []);
  useEffect(() => {
    const k = (e) => {
      if (e.target.closest('input, textarea')) return;
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      else if (e.key === 'ArrowRight' && e.shiftKey) next();
      else if (e.key === 'ArrowRight') seek(livePosition() + 10);
      else if (e.key === 'ArrowLeft') seek(Math.max(0, livePosition() - 10));
      else if (e.key.toLowerCase() === 'l' && getState().queue.length) setKaraoke((v) => !v);
      else if (e.key.toLowerCase() === 'f' && !IS_APP) toggleVideoFullscreen();
      else if (e.key === 'Escape' && document.querySelector('.yt-stage.fs')) toggleVideoFullscreen();
      else if (e.key === '/') { e.preventDefault(); setView('search'); }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);

  return (
    <div className="app">
      <div className="ambient" aria-hidden="true">
        {art && <div className="ambient-art" key={art} style={{ backgroundImage: `url("${art}")` }} />}
        <div className="ambient-glow" /><div className="ambient-grid" />
      </div>

      <nav className="side glass" aria-label="Main">
        <div className="logo"><svg viewBox="0 0 64 64" width="30" height="30"><path d="M6 38c6 0 6-12 12-12s6 20 12 20 6-28 12-28 6 20 12 20" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" /></svg><span>DHUN</span></div>
        {NAV.map(([k, l, ic]) => (
          <button key={k} className={'nav' + (view === k ? ' on' : '')} onClick={() => go(k)} aria-current={view === k ? 'page' : undefined}>
            <Icon name={ic} /><span>{l}</span>
          </button>
        ))}
        <button className="nav mobile-only" onClick={() => setNowOpen(true)}><Icon name="lyrics" /><span>Playing</span></button>
      </nav>

      <main className="main" key={view}>
        {view === 'home' && <Home go={go} />}
        {view === 'search' && <Search initial={q0} go={go} />}
        {view === 'library' && <Library />}
        {view === 'settings' && <Settings />}
        {view === 'collection' && col && <Collection c={col} go={go} />}
      </main>

      <NowPlaying open={nowOpen} onClose={() => setNowOpen(false)} onKaraoke={() => setKaraoke(true)} />
      <PlayerBar onKaraoke={() => setKaraoke(true)} onEq={() => setEq(true)} onOpenNow={() => setNowOpen(true)} />
      <VideoStage />
      {karaoke && <Karaoke onClose={closeKaraoke} />}
      {eq && <Equalizer onClose={() => setEq(false)} />}
      {(error || notice) && <div className="toast" role="status">{error || notice}</div>}
      <PlaylistSheet />
    </div>
  );
}
