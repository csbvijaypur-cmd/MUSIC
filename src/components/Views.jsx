import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import LogoMark from './LogoMark.jsx';
import TrackRow from './TrackRow.jsx';
import { AutoplaySwitch, VideoSwitch } from './NowPlaying.jsx';
import { DEMO_TRACKS } from '../lib/demo.js';
import * as AU from '../lib/audius.js';
import * as CT from '../lib/catalog.js';
import * as YT from '../lib/youtube.js';
import * as SP from '../lib/spotify.js';
import { getConfig, saveConfig, IS_APP } from '../lib/config.js';
import { VERSION, checkUpdate, downloadUpdate } from '../lib/update.js';
import { fetchSpotifyPlaylist, isSpotifyLink } from '../lib/spotifyImport.js';
import { LANGS, loadCollection, fromSpotifyLink } from '../lib/collections.js';
import { useStore, setState, playList, playTrack, toggle, setThemeColor, createPlaylist, importPlaylist, renamePlaylist, deletePlaylist, removeFromPlaylist, clearHistory, notify } from '../lib/store.js';

const greet = () => { const h = new Date().getHours(); return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

function QuickBar({ go }) {
  const [v, setV] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const q = v.trim();
    if (!q) return;
    if (isSpotifyLink(q)) { setV(''); return go('collection', fromSpotifyLink(q)); }
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

function ColCard({ c, go, color }) {
  const [img, setImg] = useState('');
  useEffect(() => { let on = true; loadCollection(c).then((d) => on && setImg(d.image)).catch(() => {}); return () => { on = false; }; }, [c.key]);
  return (
    <button className="col-card" style={{ '--c': color }} onClick={() => go('collection', c)} aria-label={`Open ${c.name}`}>
      <span className="col-art">
        {img ? <img src={img} alt="" loading="lazy" /> : <span className="col-ph"><b>{c.name}</b></span>}
        <span className="col-tag">{c.tag}</span>
        <span className="card-play"><Icon name="play" size={22} /></span>
      </span>
      <b>{c.name}</b>
    </button>
  );
}

function Popular({ go }) {
  const [lang, setLang] = useState(() => localStorage.getItem('dhun.lang') || 'hindi');
  const L = LANGS.find((l) => l.id === lang) || LANGS[0];
  const pick = (id) => { setLang(id); try { localStorage.setItem('dhun.lang', id); } catch {} };
  return (
    <>
      <div className="sec-row">
        <h2 className="sec">Popular playlists</h2>
        <div className="seg" role="tablist" aria-label="Language">
          {LANGS.map((l) => <button key={l.id} role="tab" aria-selected={lang === l.id} className={lang === l.id ? 'on' : ''} onClick={() => pick(l.id)}>{l.name}</button>)}
        </div>
      </div>
      <div className="cards col-row" key={L.id}>{L.lists.map((c) => <ColCard key={c.key} c={c} go={go} color={L.c} />)}</div>
    </>
  );
}

export function Collection({ c, go }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { setD(null); setErr(''); loadCollection(c).then(setD).catch((e) => setErr(e.message)); }, [c.key]);
  const list = d?.tracks || [];
  return (
    <div className="view">
      <button className="back-btn" onClick={() => go('home')}><Icon name="prev" size={14} /> Home</button>
      <section className="lib-head col-head">
        <div className="lib-art">{d?.image ? <img src={d.image} alt="" /> : <Icon name="lyrics" size={56} />}</div>
        <div><p className="kicker">{c.kind === 'spotify' ? 'Popular playlist' : 'Dhun mix'}</p><h1>{d?.name || c.name || 'Spotify playlist'}</h1>
          <p className="muted">{d ? `${list.length} songs` : err || 'Loading…'}</p>
          {list.length > 0 && <div className="row-btns">
            <button className="btn primary" onClick={() => playList(list, 0)}><Icon name="play" size={18} /> Play all</button>
            <button className="btn" onClick={() => playList([...list].sort(() => Math.random() - 0.5), 0)}><Icon name="shuffle" size={18} /> Shuffle</button>
            <button className="btn" disabled={saved} onClick={() => { importPlaylist(d?.name || c.name, list); setSaved(true); }}><Icon name={saved ? 'heart' : 'plus'} size={18} fill={saved} /> {saved ? 'Saved' : 'Save to library'}</button>
          </div>}
        </div>
      </section>
      {!d && !err && <div className="list">{Array.from({ length: 8 }, (_, i) => <span key={i} className="skel row-skel" />)}</div>}
      {err && <p className="muted center">{err} <button className="btn" onClick={() => { setErr(''); loadCollection(c).then(setD).catch((e) => setErr(e.message)); }}>Retry</button></p>}
      {list.length > 0 && <div className="list">{list.map((t, i) => <TrackRow key={t.id + i} t={t} i={i} onPlay={() => playList(list, i)} />)}</div>}
    </div>
  );
}

function Moods() {
  const [busy, setBusy] = useState(null);
  const play = async (m) => {
    if (busy) return;
    setBusy(m.id);
    try {
      const list = await CT.moodMix(m);
      if (list.length) playList(list, 0); else notify('Couldn’t load this mix');
    } catch { notify('Can’t connect. Check your internet.'); }
    setBusy(null);
  };
  return (
    <>
      <h2 className="sec">Mood mixes</h2>
      <div className="moods">
        {CT.MOODS.map((m) => (
          <button key={m.id} className={'mood' + (busy === m.id ? ' busy' : '')} style={{ '--c': m.c }} onClick={() => play(m)} aria-label={`Play ${m.name} mix`}>
            <span className="mood-emoji" aria-hidden="true">{m.emoji}</span><b>{m.name}</b>
            {busy === m.id ? <span className="spinner" /> : <span className="mood-play"><Icon name="play" size={16} /></span>}
          </button>
        ))}
      </div>
    </>
  );
}

function DailyMix() {
  const history = useStore((s) => s.history);
  const [busy, setBusy] = useState(false);
  const artists = useMemo(() => CT.dailyMixArtists(history), [history]);
  if (history.length < 3 || !artists.length) return null;
  const play = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const list = await CT.dailyMix(history);
      if (list.length) playList(list, 0); else notify('Couldn’t make your mix');
    } catch { notify('Can’t connect. Check your internet.'); }
    setBusy(false);
  };
  const arts = history.filter((t) => t.art).slice(0, 4);
  return (
    <>
      <h2 className="sec">Made for you</h2>
      <button className="daily" onClick={play} aria-label="Play Daily Mix">
        <span className="daily-art" aria-hidden="true">{arts.map((t, i) => <img key={i} src={t.artSmall || t.art} alt="" loading="lazy" />)}</span>
        <span className="daily-info">
          <small>{new Date().toLocaleDateString(undefined, { weekday: 'long' })} · fresh today</small>
          <b>Daily Mix</b>
          <span>{artists.slice(0, 3).join(', ')} and more</span>
        </span>
        <span className="daily-play">{busy ? <span className="spinner" /> : <Icon name="play" size={22} />}</span>
      </button>
    </>
  );
}

export function Home({ go }) {
  const [trend, setTrend] = useState(null);
  const history = useStore((s) => s.history);
  const cur = useStore((s) => s.queue[s.index]);
  const playing = useStore((s) => s.playing);
  const videoOn = useStore((s) => s.videoVisible);
  const recent = useMemo(() => history.slice(0, 10), [history]);
  useEffect(() => { AU.trending().then(setTrend).catch(() => setTrend([])); }, []);
  const feat = cur || DEMO_TRACKS[0];
  const playFeat = () => (cur ? toggle() : playList(DEMO_TRACKS, 0));
  return (
    <div className="view">
      <div className="home-top">
        <div className="hello-wrap">
          <span className="brand" aria-hidden="true"><LogoMark size={20} />DHUN</span>
          <p className="hello">{greet()}</p>
        </div>
        <QuickBar go={go} />
      </div>

      <section className="spot" style={{ '--art': feat.art ? `url("${feat.art}")` : 'none' }}>
        <div className="spot-bg" aria-hidden="true" />
        {IS_APP && videoOn && cur ? <div className="spot-video" data-video-slot aria-hidden="true" /> :
        <button className="spot-art" onClick={playFeat} aria-label={playing && cur ? 'Pause' : 'Play'}>
          <span className="orb" aria-hidden="true"><i /><i /></span>
          {feat.art && <img src={feat.art} alt="" />}
        </button>}
        <div className="spot-info">
          <span className="spot-tag">{cur ? 'Now playing' : 'Start here'}</span>
          <h1>{feat.title}</h1>
          <p>{feat.artist}</p>
          <button className="btn primary" onClick={playFeat}><Icon name={playing && cur ? 'pause' : 'play'} size={18} /> {playing && cur ? 'Pause' : 'Play'}</button>
        </div>
      </section>

      <DailyMix />

      {recent.length > 0 && <><h2 className="sec">Recently played</h2><div className="cards shelf">{recent.map((t) => <Card key={t.id} t={t} onClick={() => playTrack(t)} />)}</div></>}

      <Popular go={go} />

      <Moods />

      <h2 className="sec">Trending</h2>
      {trend === null ? <div className="skel-grid">{Array.from({ length: 6 }, (_, i) => <span key={i} className="skel" />)}</div>
        : trend.length ? <div className="cards shelf">{trend.map((t, i) => <Card key={t.id} t={t} onClick={() => playList(trend, i)} />)}</div>
          : <p className="muted">Couldn’t load</p>}

      <h2 className="sec">Demo</h2>
      <div className="cards shelf">{DEMO_TRACKS.map((t, i) => <Card key={t.id} t={t} onClick={() => playList(DEMO_TRACKS, i)} />)}</div>
    </div>
  );
}

const SOURCES = [['all', 'All'], ['catalog', 'Songs'], ...(IS_APP ? [] : [['youtube', 'Videos']]), ['spotify', 'Spotify'], ['audius', 'Audius']];

export function Search({ initial = '', go }) {
  const [q, setQ] = useState(initial);
  const [src, setSrc] = useState('all');
  const [res, setRes] = useState({});
  const [busy, setBusy] = useState(false);
  const cfg = getConfig();

  useEffect(() => {
    const query = q.trim();
    if (!query) { setRes({}); return; }
    if (isSpotifyLink(query)) { setRes({}); go?.('collection', fromSpotifyLink(query)); return; }
    if (YT.videoIdFromUrl(query) && query.includes('/')) { YT.fromUrl(query).then((t) => t && setRes({ youtube: [t] })); return; }
    const id = setTimeout(async () => {
      setBusy(true);
      const jobs = {
        catalog: CT.search(query),
        youtube: IS_APP ? Promise.resolve([]) : cfg.youtubeApiKey ? YT.search(query) : Promise.reject(new Error('Add a YouTube API key in Settings')),
        spotify: SP.isLoggedIn() ? SP.search(query) : Promise.resolve(null),
        audius: AU.search(query),
      };
      const out = {};
      await Promise.all(Object.entries(jobs).map(([k, p]) => p.then((r) => (out[k] = r)).catch((e) => (out[k] = /fetch/i.test(e.message) ? 'Can’t connect. Check your internet.' : e.message))));
      setRes(out); setBusy(false);
    }, 350);
    return () => clearTimeout(id);
  }, [q]);

  const shown = src === 'all' ? ['catalog', ...(IS_APP ? [] : ['youtube']), 'spotify', 'audius'] : [src];
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

function SpotifyImport({ onDone }) {
  const [link, setLink] = useState('');
  const [st, setSt] = useState({});
  const go = async (e) => {
    e.preventDefault();
    if (!isSpotifyLink(link)) return setSt({ err: 'Paste a Spotify playlist or album link (Share → Copy link)' });
    setSt({ busy: true });
    try {
      const { name, tracks } = await fetchSpotifyPlaylist(link);
      onDone(importPlaylist(name, tracks)); setLink(''); setSt({});
    } catch (er) { setSt({ err: er.message }); }
  };
  return (
    <form className="sp-import glass" onSubmit={go}>
      <span className="sp-logo" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="11" fill="#1ed760" /><path d="M6.5 9.5c3.8-1.1 7.9-.7 11 1.1M7.2 12.6c3.1-.9 6.4-.5 8.9.9M7.9 15.5c2.5-.6 4.9-.3 6.9.8" stroke="#000" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg></span>
      <input value={link} onChange={(e) => { setLink(e.target.value); setSt({}); }} placeholder="Paste Spotify playlist link to import" aria-label="Spotify playlist link" />
      <button className="btn primary" disabled={!link.trim() || st.busy}>{st.busy ? <span className="spinner" /> : 'Import'}</button>
      {st.err && <p className="sp-err">{st.err}</p>}
    </form>
  );
}

export function Library() {
  const liked = useStore((s) => s.liked);
  const playlists = useStore((s) => s.playlists);
  const history = useStore((s) => s.history);
  const [open, setOpen] = useState('liked');
  const [name, setName] = useState('');
  const pl = playlists.find((p) => p.id === open);
  const tabs = [['liked', 'Liked songs', liked.length], ...playlists.map((p) => [p.id, p.name, p.tracks.length]), ['recent', 'Recently played', history.length]];
  const list = open === 'liked' ? liked : open === 'recent' ? history : pl?.tracks || [];
  const title = open === 'liked' ? 'Liked songs' : open === 'recent' ? 'Recently played' : pl?.name;
  if (!pl && !['liked', 'recent'].includes(open)) setTimeout(() => setOpen('liked'));
  return (
    <div className="view">
      <h1 className="lib-title">Your library</h1>
      <SpotifyImport onDone={setOpen} />
      <div className="lib-tabs">
        {tabs.map(([id, l, n]) => <button key={id} className={'chip' + (open === id ? ' on' : '')} onClick={() => setOpen(id)}>{l} <small>{n}</small></button>)}
        <form className="new-pl" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; setOpen(createPlaylist(name)); setName(''); }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="+ New playlist" aria-label="New playlist name" />
          {name.trim() && <button className="btn primary">Create</button>}
        </form>
      </div>
      <section className="lib-head">
        <div className="lib-art">{open === 'liked' ? <Icon name="heart" size={56} fill /> : open === 'recent' ? <Icon name="clock" size={56} /> : list[0]?.art ? <img src={list[0].art} alt="" /> : <Icon name="lyrics" size={56} />}</div>
        <div><p className="kicker">Playlist</p><h1>{title}</h1><p className="muted">{list.length} songs</p>
          <div className="row-btns">
            {list.length > 0 && <button className="btn primary" onClick={() => playList(list, 0)}><Icon name="play" size={18} /> Play all</button>}
            {list.length > 1 && <button className="btn" onClick={() => { const l = [...list].sort(() => Math.random() - 0.5); playList(l, 0); }}><Icon name="shuffle" size={18} /> Shuffle</button>}
            {pl && <button className="btn" onClick={() => { const n = prompt('Playlist name', pl.name); if (n) renamePlaylist(pl.id, n); }}>Rename</button>}
            {pl && <button className="btn" onClick={() => { if (confirm(`Delete "${pl.name}"?`)) { deletePlaylist(pl.id); setOpen('liked'); } }}>Delete</button>}
            {open === 'recent' && list.length > 0 && <button className="btn" onClick={clearHistory}>Clear</button>}
          </div>
        </div>
      </section>
      {list.length ? <div className="list">{list.map((t, i) => <TrackRow key={t.id} t={t} i={i} onPlay={() => playList(list, i)} onRemove={pl ? () => removeFromPlaylist(pl.id, t.id) : undefined} />)}</div>
        : <p className="muted center">{open === 'liked' ? 'Tap ♥ on any song to save it here.' : open === 'recent' ? 'Songs you play show up here.' : 'Add songs with the ≡+ button on any song.'}</p>}
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
        {!IS_APP && <><VideoSwitch />
        <p className="note">Off: album art and lyrics stay big, the video shrinks to a small corner player.</p></>}
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
        <p className="note"><kbd>Space</kbd> play/pause · <kbd>→</kbd>/<kbd>←</kbd> 10 sec · <kbd>Shift</kbd>+<kbd>→</kbd> next · <kbd>L</kbd> karaoke{IS_APP ? '' : <> · <kbd>F</kbd> video full screen</>} · <kbd>/</kbd> search</p>
      </section>
    </div>
  );
}
