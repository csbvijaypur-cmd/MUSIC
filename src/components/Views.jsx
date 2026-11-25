import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import TrackRow from './TrackRow.jsx';
import { AutoplaySwitch, VideoSwitch } from './NowPlaying.jsx';
import { DEMO_TRACKS } from '../lib/demo.js';
import * as AU from '../lib/audius.js';
import * as CT from '../lib/catalog.js';
import * as YT from '../lib/youtube.js';
import * as SP from '../lib/spotify.js';
import { getConfig, saveConfig } from '../lib/config.js';
import { VERSION, checkUpdate, downloadUpdate } from '../lib/update.js';
import { useStore, setState, playList, playTrack, toggle, setThemeColor } from '../lib/store.js';

const greet = () => { const h = new Date().getHours(); return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

function QuickBar({ go }) {
  const [v, setV] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const q = v.trim();
    if (!q) return;
    if (YT.videoIdFromUrl(q) && q.includes('/')) { const t = await YT.fromUrl(q); if (t) { setV(''); return playTrack(t); } }
    go('search', q);
  };
  return (
    <form className="quick glass" onSubmit={submit}>
      <Icon name="search" />
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Search songs, artists" aria-label="Search songs, artists" />
    </form>
  );
}

function Card({ t, onClick }) {
  return (
    <button className="card" onClick={onClick}>
      <span className="card-art">{t.art && <img src={t.art} alt="" loading="lazy" />}<span className="card-play"><Icon name="play" size={22} /></span></span>
      <b>{t.title}</b><small>{t.artist}</small>
    </button>
  );
}

export function Home({ go }) {
  const [trend, setTrend] = useState(null);
  const queue = useStore((s) => s.queue);
  const cur = useStore((s) => s.queue[s.index]);
  const playing = useStore((s) => s.playing);
  const recent = useMemo(() => queue.filter((t) => t.source !== 'demo').slice(-8).reverse(), [queue]);
  useEffect(() => { AU.trending().then(setTrend).catch(() => setTrend([])); }, []);
  const feat = cur || DEMO_TRACKS[0];
  const playFeat = () => (cur ? toggle() : playList(DEMO_TRACKS, 0));
  return (
    <div className="view">
      <div className="home-top">
        <p className="hello">{greet()}</p>
        <QuickBar go={go} />
      </div>

      <section className="spot" style={{ '--art': feat.art ? `url("${feat.art}")` : 'none' }}>
        <div className="spot-bg" aria-hidden="true" />
        <button className="spot-art" onClick={playFeat} aria-label={playing && cur ? 'Pause' : 'Play'}>
          <span className="orb" aria-hidden="true"><i /><i /></span>
          {feat.art && <img src={feat.art} alt="" />}
        </button>
        <div className="spot-info">
          <span className="spot-tag">{cur ? 'Now playing' : 'Start here'}</span>
          <h1>{feat.title}</h1>
          <p>{feat.artist}</p>
          <button className="btn primary" onClick={playFeat}><Icon name={playing && cur ? 'pause' : 'play'} size={18} /> {playing && cur ? 'Pause' : 'Play'}</button>
        </div>
      </section>

      {recent.length > 0 && <><h2 className="sec">Recent</h2><div className="cards">{recent.map((t) => <Card key={t.id} t={t} onClick={() => playTrack(t)} />)}</div></>}

      <h2 className="sec">Demo</h2>
      <div className="cards">{DEMO_TRACKS.map((t, i) => <Card key={t.id} t={t} onClick={() => playList(DEMO_TRACKS, i)} />)}</div>

      <h2 className="sec">Trending</h2>
      {trend === null ? <div className="skel-grid">{Array.from({ length: 6 }, (_, i) => <span key={i} className="skel" />)}</div>
        : trend.length ? <div className="cards">{trend.map((t, i) => <Card key={t.id} t={t} onClick={() => playList(trend, i)} />)}</div>
          : <p className="muted">Couldn’t load</p>}
    </div>
  );
}

const SOURCES = [['all', 'All'], ['catalog', 'Songs'], ['youtube', 'Videos'], ['spotify', 'Spotify'], ['audius', 'Audius']];

export function Search({ initial = '' }) {
  const [q, setQ] = useState(initial);
  const [src, setSrc] = useState('all');
  const [res, setRes] = useState({});
  const [busy, setBusy] = useState(false);
  const cfg = getConfig();

  useEffect(() => {
    const query = q.trim();
    if (!query) { setRes({}); return; }
    if (YT.videoIdFromUrl(query) && query.includes('/')) { YT.fromUrl(query).then((t) => t && setRes({ youtube: [t] })); return; }
    const id = setTimeout(async () => {
      setBusy(true);
      const jobs = {
        catalog: CT.search(query),
        youtube: cfg.youtubeApiKey ? YT.search(query) : Promise.reject(new Error('Add a YouTube API key in Settings')),
        spotify: SP.isLoggedIn() ? SP.search(query) : Promise.resolve(null),
        audius: AU.search(query),
      };
      const out = {};
      await Promise.all(Object.entries(jobs).map(([k, p]) => p.then((r) => (out[k] = r)).catch((e) => (out[k] = /fetch/i.test(e.message) ? 'Can’t connect. Check your internet.' : e.message))));
      setRes(out); setBusy(false);
    }, 350);
    return () => clearTimeout(id);
  }, [q]);

  const shown = src === 'all' ? ['catalog', 'youtube', 'spotify', 'audius'] : [src];
  return (
    <div className="view">
      <div className="search-box glass">
        <Icon name="search" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="What do you want to hear?" aria-label="Search" />
        {busy && <span className="spinner" />}
      </div>
      <div className="chips">{SOURCES.filter(([k]) => k !== 'spotify' || SP.isLoggedIn()).map(([k, l]) => <button key={k} className={'chip' + (src === k ? ' on' : '')} onClick={() => setSrc(k)}>{l}</button>)}</div>
      
      {shown.map((k) => res[k] != null && !(src === 'all' && typeof res[k] === 'string' && k !== 'catalog') && (
        <section key={k}>
          {src === 'all' && <h2 className="sec">{SOURCES.find((s) => s[0] === k)[1]}</h2>}
          {typeof res[k] === 'string' ? <p className="muted">{res[k]}</p>
            : res[k].length ? <div className="list">{(src === 'all' ? res[k].slice(0, k === 'catalog' ? 10 : 4) : res[k]).map((t, i) => <TrackRow key={t.id} t={t} i={i} />)}</div>
              : <p className="muted">No results</p>}
        </section>
      ))}
    </div>
  );
}

export function Library() {
  const liked = useStore((s) => s.liked);
  return (
    <div className="view">
      <section className="lib-head">
        <div className="lib-art"><Icon name="heart" size={56} fill /></div>
        <div><p className="kicker">Playlist</p><h1>Liked songs</h1><p className="muted">{liked.length} songs</p>
          {liked.length > 0 && <button className="btn primary" onClick={() => playList(liked, 0)}><Icon name="play" size={18} /> Play all</button>}</div>
      </section>
      {liked.length ? <div className="list">{liked.map((t, i) => <TrackRow key={t.id} t={t} i={i} onPlay={() => playList(liked, i)} />)}</div>
        : <p className="muted center">Tap ♥ on any song to save it here.</p>}
    </div>
  );
}

function Updates() {
  const [st, setSt] = useState({ state: 'idle' });
  const check = () => {
    setSt({ state: 'checking' });
    checkUpdate().then((r) => setSt({ state: r.newer ? 'available' : 'latest', ...r })).catch((e) => setSt({ state: 'error', msg: e.message }));
  };
  useEffect(check, []);
  return (
    <section className="panel glass">
      <h3>App updates</h3>
      <p className="note">Installed version: <b>{VERSION}</b>
        {st.state === 'checking' && ' · Checking…'}
        {st.state === 'latest' && ' · You have the latest version ✓'}
        {st.state === 'available' && <> · New version <b>{st.latest}</b> available</>}
        {st.state === 'error' && ' · ' + st.msg}
      </p>
      <div className="row-btns">
        {st.state === 'available'
          ? <button className="btn primary" onClick={downloadUpdate}>Download update</button>
          : <button className="btn" onClick={check} disabled={st.state === 'checking'}>Check for updates</button>}
      </div>
      {st.state === 'available' && <p className="note">After the download, open Dhun.apk and tap Update. Your liked songs and settings stay.</p>}
    </section>
  );
}

const SWATCHES = [['Violet', '#7c61ff'], ['Neon pink', '#ff3d8b'], ['Cyan', '#22d3ee'], ['Lime', '#a3e635'], ['Amber', '#fbbf24'], ['Red', '#ff4d4d'], ['Spotify green', '#1ed760'], ['Ice', '#cfe3ff']];

function ThemePicker() {
  const cur = useStore((s) => s.themeColor);
  const custom = cur !== 'auto' && !SWATCHES.some(([, c]) => c === cur);
  return (
    <section className="panel glass">
      <h3>Theme colour</h3>
      <div className="swatches" role="radiogroup" aria-label="Theme colour">
        <button role="radio" aria-checked={cur === 'auto'} className={'sw auto' + (cur === 'auto' ? ' on' : '')} onClick={() => setThemeColor('auto')} title="Auto (from album art)"><span>Auto</span></button>
        {SWATCHES.map(([n, c]) => (
          <button key={c} role="radio" aria-checked={cur === c} aria-label={n} title={n} className={'sw' + (cur === c ? ' on' : '')} style={{ '--c': c }} onClick={() => setThemeColor(c)} />
        ))}
        <label className={'sw pick' + (custom ? ' on' : '')} title="Custom" style={custom ? { '--c': cur } : undefined}>
          <input type="color" value={custom ? cur : '#7c61ff'} onChange={(e) => setThemeColor(e.target.value)} aria-label="Custom colour" />
        </label>
      </div>
      <p className="note">{cur === 'auto' ? 'Auto: changes with every song’s album art.' : 'Fixed colour for the whole app.'}</p>
    </section>
  );
}

export function Settings() {
  const [cfg, setCfg] = useState(getConfig());
  const [saved, setSaved] = useState(false);
  const [logged, setLogged] = useState(SP.isLoggedIn());
  const premium = useStore((s) => s.spotifyPremium);
  const [install, setInstall] = useState(null);
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setInstall(e); };
    addEventListener('beforeinstallprompt', h);
    return () => removeEventListener('beforeinstallprompt', h);
  }, []);
  const save = (e) => { e.preventDefault(); saveConfig(cfg); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  return (
    <div className="view settings">
      <h1>Settings</h1>
      <ThemePicker />
      <section className="panel glass">
        <h3>Playback</h3>
        <AutoplaySwitch />
        <p className="note">When your queue ends, Dhun keeps playing songs similar to the one you played.</p>
        <VideoSwitch />
        <p className="note">Off: album art and lyrics stay big, the video shrinks to a small corner player.</p>
      </section>
      {/* Keys are built into the published app, so this only shows in a local build without them */}
      {!import.meta.env.VITE_YOUTUBE_API_KEY && <form className="panel glass" onSubmit={save}>
        <h3>API keys</h3>
        <label>YouTube Data API key<input type="password" autoComplete="off" value={cfg.youtubeApiKey} onChange={(e) => setCfg({ ...cfg, youtubeApiKey: e.target.value })} placeholder="AIza…" /></label>
        <label>Spotify Client ID<input value={cfg.spotifyClientId} onChange={(e) => setCfg({ ...cfg, spotifyClientId: e.target.value })} placeholder="32 characters" /></label>
        <p className="note">Spotify Redirect URI: <code>{SP.redirectUri()}</code></p>
        <button className="btn primary">{saved ? 'Saved ✓' : 'Save'}</button>
      </form>}
      {getConfig().spotifyClientId && <section className="panel glass">
        <h3>Spotify</h3>
        {logged ? <>
          <p>Spotify connected.</p>
          <label className="switch"><input type="checkbox" checked={premium} onChange={(e) => setState({ spotifyPremium: e.target.checked })} /><span />I have Premium, play on Spotify directly</label>
          <p className="note">With Premium off, Spotify songs play free through YouTube.</p>
          <button className="btn" onClick={() => { SP.logout(); setLogged(false); }}>Disconnect</button>
        </> : <button className="btn primary" onClick={() => SP.login().catch(() => {})} disabled={!getConfig().spotifyClientId}>Connect Spotify</button>}
      </section>}
      {window.Capacitor?.isNativePlatform?.() && <Updates />}
      {!window.Capacitor?.isNativePlatform?.() && <section className="panel glass">
        <h3>App install</h3>
        <p className="note">Install on your phone or PC.</p>
        <div className="row-btns">
          <a className="btn primary" href="https://github.com/csbvijaypur-cmd/MUSIC/releases/latest/download/Dhun.apk">Download Android app</a>
          <button className="btn" disabled={!install} onClick={() => install?.prompt()}>{install ? 'Install web app' : 'Browser menu → "Install app"'}</button>
        </div>
      </section>}
      <section className="panel glass">
        <h3>Keyboard shortcuts</h3>
        <p className="note"><kbd>Space</kbd> play/pause · <kbd>→</kbd>/<kbd>←</kbd> 10 sec · <kbd>Shift</kbd>+<kbd>→</kbd> next · <kbd>L</kbd> karaoke · <kbd>F</kbd> video full screen · <kbd>/</kbd> search</p>
      </section>
    </div>
  );
}
