import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from './components/Icon.jsx';
import PlayerBar from './components/PlayerBar.jsx';
import NowPlaying from './components/NowPlaying.jsx';
import Karaoke from './components/Karaoke.jsx';
import Equalizer from './components/Equalizer.jsx';
import { Home, Search, Library, Settings } from './components/Views.jsx';
import { useStore, mountYouTube, toggle, seek, next, livePosition, getState } from './lib/store.js';
import * as SP from './lib/spotify.js';
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
  const active = useStore((s) => s.ytActive ?? 0);
  const [full, setFull] = useState(false);
  useEffect(() => { mountYouTube(a.current, b.current); }, []);
  useEffect(() => {
    const h = () => { setFull(isFull()); if (!document.fullscreenElement) screen.orientation?.unlock?.(); };
    document.addEventListener('fullscreenchange', h);
    const obs = new MutationObserver(h); obs.observe(box.current, { attributes: true, attributeFilter: ['class'] });
    return () => { document.removeEventListener('fullscreenchange', h); obs.disconnect(); };
  }, []);
  // Leave full screen when the video goes away (e.g. next song is not a video)
  useEffect(() => { if (!visible && isFull()) toggleVideoFullscreen(); }, [visible]);
  // Float the (always-mounted) player over the Now Playing slot, or as a mini card.
  useLayoutEffect(() => {
    let raf;
    const place = () => {
      raf = requestAnimationFrame(place);
      const slot = document.querySelector('.now-stage');
      const r = slot?.getBoundingClientRect();
      const el = box.current;
      if (isFull()) return;
      const karaokeOn = !!document.querySelector('.karaoke');
      const onScreen = !karaokeOn && r && r.width > 150 && r.left < innerWidth - 50 && r.top < innerHeight && r.bottom > 0 && getComputedStyle(slot.closest('.now')).visibility !== 'hidden';
      if (onScreen) {
        el.classList.remove('mini');
        el.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${Math.max(200, r.height)}px`;
      } else { el.classList.add('mini'); el.style.cssText = ''; }
    };
    place();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div ref={box} className={'yt-stage' + (visible ? ' show' : '')} aria-hidden={!visible}>
      <div className={'yt-slot' + (active === 0 ? ' active' : '')}><div ref={a} /></div>
      <div className={'yt-slot' + (active === 1 ? ' active' : '')}><div ref={b} /></div>
      <button className="yt-fs" onClick={toggleVideoFullscreen} aria-label={full ? 'Exit full screen' : 'Full screen'} title={full ? 'Exit full screen (F)' : 'Full screen (F)'}>
        <Icon name={full ? 'shrink' : 'expand'} size={18} />
      </button>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState('home');
  const [q0, setQ0] = useState('');
  const go = useCallback((v, q) => { setQ0(q || ''); setView(v); }, []);
  const [nowOpen, setNowOpen] = useState(false);
  const [karaoke, setKaraoke] = useState(false);
  const [eq, setEq] = useState(false);
  const accent = useStore((s) => s.accent);
  const error = useStore((s) => s.error);
  const art = useStore((s) => s.queue[s.index]?.art);

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
      else if (e.key.toLowerCase() === 'f') toggleVideoFullscreen();
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
        {view === 'search' && <Search initial={q0} />}
        {view === 'library' && <Library />}
        {view === 'settings' && <Settings />}
      </main>

      <NowPlaying open={nowOpen} onClose={() => setNowOpen(false)} onKaraoke={() => setKaraoke(true)} />
      <PlayerBar onKaraoke={() => setKaraoke(true)} onEq={() => setEq(true)} onOpenNow={() => setNowOpen(true)} />
      <VideoStage />
      {karaoke && <Karaoke onClose={closeKaraoke} />}
      {eq && <Equalizer onClose={() => setEq(false)} />}
      {error && <div className="toast" role="status">{error}</div>}
    </div>
  );
}
