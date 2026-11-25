import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import TrackRow from './TrackRow.jsx';
import { DEMO_TRACKS } from '../lib/demo.js';
import * as AU from '../lib/audius.js';
import * as YT from '../lib/youtube.js';
import * as SP from '../lib/spotify.js';
import { getConfig, saveConfig } from '../lib/config.js';
import { useStore, setState, playList, playTrack } from '../lib/store.js';

const greet = () => { const h = new Date().getHours(); return h < 5 ? 'Raat ke sitaare' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

function LinkBox() {
  const [v, setV] = useState('');
  const [msg, setMsg] = useState('');
  const go = async (e) => {
    e.preventDefault();
    const t = await YT.fromUrl(v);
    if (!t) return setMsg('Ye YouTube link sahi nahi lag raha');
    setV(''); setMsg(''); playTrack(t);
  };
  return (
    <form className="linkbox glass" onSubmit={go}>
      <Icon name="link" />
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="YouTube link paste karo aur Enter dabao" aria-label="YouTube link" />
      <button className="btn" disabled={!v.trim()}>Play</button>
      {msg && <span className="err-inline">{msg}</span>}
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
  const recent = useMemo(() => queue.filter((t) => t.source !== 'demo').slice(-8).reverse(), [queue]);
  useEffect(() => { AU.trending().then(setTrend).catch(() => setTrend([])); }, []);
  const cfg = getConfig();
  return (
    <div className="view">
      <section className="hero">
        <div>
          <p className="kicker">{greet()}, Pankaj</p>
          <h1>Ek app. YouTube, Spotify, Audius. <span className="grad">Sab ek lehar me.</span></h1>
          <p className="sub">Gaana search karo, synced lyrics ke saath suno, aur har gaane ke colour me app ko badalte dekho.</p>
          <div className="hero-cta">
            <button className="btn primary" onClick={() => playList(DEMO_TRACKS, 0)}><Icon name="play" size={18} /> Demo chalao</button>
            <button className="btn" onClick={() => go('search')}><Icon name="search" size={18} /> Search</button>
          </div>
        </div>
        <div className="orb" aria-hidden="true"><i /><i /><i /></div>
      </section>

      <LinkBox />
      {(!cfg.youtubeApiKey || !cfg.spotifyClientId) && (
        <button className="setup-hint glass" onClick={() => go('settings')}>
          <b>Setup baaki hai:</b> {!cfg.youtubeApiKey && 'YouTube search ke liye API key'}{!cfg.youtubeApiKey && !cfg.spotifyClientId && ' aur '}{!cfg.spotifyClientId && 'Spotify search ke liye Client ID'} daalo. Settings kholo →
        </button>
      )}

      <h2 className="sec">Demo tracks <small>bina setup ke chalte hain</small></h2>
      <div className="cards">{DEMO_TRACKS.map((t, i) => <Card key={t.id} t={t} onClick={() => playList(DEMO_TRACKS, i)} />)}</div>

      {recent.length > 0 && <><h2 className="sec">Haal hi me</h2><div className="list">{recent.map((t, i) => <TrackRow key={t.id + i} t={t} i={i} />)}</div></>}

      <h2 className="sec">Trending on Audius <small>free full songs</small></h2>
      {trend === null ? <div className="skel-grid">{Array.from({ length: 6 }, (_, i) => <span key={i} className="skel" />)}</div>
        : trend.length ? <div className="cards">{trend.map((t, i) => <Card key={t.id} t={t} onClick={() => playList(trend, i)} />)}</div>
          : <p className="muted">Audius abhi load nahi hua. Internet check karo.</p>}
    </div>
  );
}

const SOURCES = [['all', 'Sab'], ['youtube', 'YouTube'], ['spotify', 'Spotify'], ['audius', 'Audius']];

export function Search() {
  const [q, setQ] = useState('');
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
        youtube: cfg.youtubeApiKey ? YT.search(query) : Promise.reject(new Error('Settings me YouTube API key daalo')),
        spotify: SP.isLoggedIn() ? SP.search(query) : Promise.reject(new Error('Settings me Spotify connect karo')),
        audius: AU.search(query),
      };
      const out = {};
      await Promise.all(Object.entries(jobs).map(([k, p]) => p.then((r) => (out[k] = r)).catch((e) => (out[k] = /fetch/i.test(e.message) ? 'Connect nahi ho paaya, internet check karo' : e.message))));
      setRes(out); setBusy(false);
    }, 350);
    return () => clearTimeout(id);
  }, [q]);

  const shown = src === 'all' ? ['youtube', 'spotify', 'audius'] : [src];
  return (
    <div className="view">
      <div className="search-box glass">
        <Icon name="search" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Gaana, artist, ya YouTube link…" aria-label="Search" />
        {busy && <span className="spinner" />}
      </div>
      <div className="chips">{SOURCES.map(([k, l]) => <button key={k} className={'chip' + (src === k ? ' on' : '')} onClick={() => setSrc(k)}>{l}</button>)}</div>
      {!q && <p className="muted center">Kuch bhi likho, teeno jagah se ek saath result aayenge.</p>}
      {shown.map((k) => res[k] !== undefined && (
        <section key={k}>
          {src === 'all' && <h2 className="sec">{SOURCES.find((s) => s[0] === k)[1]}</h2>}
          {typeof res[k] === 'string' ? <p className="muted">{res[k]}</p>
            : res[k].length ? <div className="list">{(src === 'all' ? res[k].slice(0, 5) : res[k]).map((t, i) => <TrackRow key={t.id} t={t} i={i} />)}</div>
              : <p className="muted">Kuch nahi mila</p>}
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
        <div><p className="kicker">Playlist</p><h1>Liked songs</h1><p className="muted">{liked.length} gaane</p>
          {liked.length > 0 && <button className="btn primary" onClick={() => playList(liked, 0)}><Icon name="play" size={18} /> Sab chalao</button>}</div>
      </section>
      {liked.length ? <div className="list">{liked.map((t, i) => <TrackRow key={t.id} t={t} i={i} onPlay={() => playList(liked, i)} />)}</div>
        : <p className="muted center">Kisi bhi gaane par ♥ dabao, wo yahan aa jayega.</p>}
    </div>
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
      <form className="panel glass" onSubmit={save}>
        <h3>API keys</h3>
        <label>YouTube Data API key<input value={cfg.youtubeApiKey} onChange={(e) => setCfg({ ...cfg, youtubeApiKey: e.target.value })} placeholder="AIza…" /></label>
        <label>Spotify Client ID<input value={cfg.spotifyClientId} onChange={(e) => setCfg({ ...cfg, spotifyClientId: e.target.value })} placeholder="32 characters" /></label>
        <p className="note">Spotify app ke Redirect URI me ye daalna: <code>{SP.redirectUri()}</code></p>
        <button className="btn primary">{saved ? 'Save ho gaya ✓' : 'Save'}</button>
      </form>
      <section className="panel glass">
        <h3>Spotify</h3>
        {logged ? <>
          <p>Spotify connected hai. Search aur metadata Spotify se aayega.</p>
          <label className="switch"><input type="checkbox" checked={premium} onChange={(e) => setState({ spotifyPremium: e.target.checked })} /><span />Mere paas Premium hai, Spotify direct chalao</label>
          <p className="note">Premium off rehne par Spotify ke gaane official YouTube player se chalenge (free).</p>
          <button className="btn" onClick={() => { SP.logout(); setLogged(false); }}>Disconnect</button>
        </> : <button className="btn primary" onClick={() => SP.login().catch(() => {})} disabled={!getConfig().spotifyClientId}>Spotify connect karo</button>}
      </section>
      <section className="panel glass">
        <h3>App install</h3>
        <p className="note">Phone ya PC par app ki tarah install karo (home screen icon, full screen).</p>
        <button className="btn" disabled={!install} onClick={() => install?.prompt()}>{install ? 'Install karo' : 'Browser menu → "Install app" / "Add to Home screen"'}</button>
      </section>
      <section className="panel glass">
        <h3>Keyboard shortcuts</h3>
        <p className="note"><kbd>Space</kbd> play/pause · <kbd>→</kbd>/<kbd>←</kbd> 10 sec · <kbd>Shift</kbd>+<kbd>→</kbd> agla gaana · <kbd>L</kbd> karaoke · <kbd>/</kbd> search</p>
      </section>
    </div>
  );
}
