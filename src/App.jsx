import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from './components/Icon.jsx';
import PlayerBar from './components/PlayerBar.jsx';
import NowPlaying from './components/NowPlaying.jsx';
import Karaoke from './components/Karaoke.jsx';
import Equalizer from './components/Equalizer.jsx';
import { Home, Search, Library, Settings } from './components/Views.jsx';
import { useStore, mountYouTube, toggle, seek, next, livePosition, getState } from './lib/store.js';
import * as SP from './lib/spotify.js';

const NAV = [['home', 'Home', 'home'], ['search', 'Search', 'search'], ['library', 'Liked', 'heart'], ['settings', 'Settings', 'settings']];

function VideoStage() {
  const a = useRef(null), b = useRef(null), box = useRef(null);
  const visible = useStore((s) => s.videoVisible);
  const active = useStore((s) => s.ytActive ?? 0);
  useEffect(() => { mountYouTube(a.current, b.current); }, []);
  // Float the (always-mounted) player over the Now Playing slot, or as a mini card.
  useLayoutEffect(() => {
    let raf;
    const place = () => {
      raf = requestAnimationFrame(place);
      const slot = document.querySelector('.now-stage');
      const r = slot?.getBoundingClientRect();
      const el = box.current;
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
    </div>
  );
}

export default function App() {
  const [view, setView] = useState('home');
  const [nowOpen, setNowOpen] = useState(false);
  const [karaoke, setKaraoke] = useState(false);
  const [eq, setEq] = useState(false);
  const accent = useStore((s) => s.accent);
  const error = useStore((s) => s.error);
  const art = useStore((s) => s.queue[s.index]?.art);

  useEffect(() => { SP.handleRedirect().then((ok) => ok && setView('settings')).catch(() => {}); }, []);
  useEffect(() => { document.documentElement.style.setProperty('--accent', accent); document.querySelector('meta[name=theme-color]')?.setAttribute('content', '#07070d'); }, [accent]);

  const closeKaraoke = useCallback(() => setKaraoke(false), []);
  useEffect(() => {
    const k = (e) => {
      if (e.target.closest('input, textarea')) return;
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      else if (e.key === 'ArrowRight' && e.shiftKey) next();
      else if (e.key === 'ArrowRight') seek(livePosition() + 10);
      else if (e.key === 'ArrowLeft') seek(Math.max(0, livePosition() - 10));
      else if (e.key.toLowerCase() === 'l' && getState().queue.length) setKaraoke((v) => !v);
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
        <div className="logo"><svg viewBox="0 0 64 64" width="30" height="30"><path d="M6 38c6 0 6-12 12-12s6 20 12 20 6-28 12-28 6 20 12 20" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" /></svg><span>LEHAR</span></div>
        {NAV.map(([k, l, ic]) => (
          <button key={k} className={'nav' + (view === k ? ' on' : '')} onClick={() => setView(k)} aria-current={view === k ? 'page' : undefined}>
            <Icon name={ic} /><span>{l}</span>
          </button>
        ))}
        <button className="nav mobile-only" onClick={() => setNowOpen(true)}><Icon name="lyrics" /><span>Playing</span></button>
      </nav>

      <main className="main" key={view}>
        {view === 'home' && <Home go={setView} />}
        {view === 'search' && <Search />}
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
