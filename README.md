# Dhun Music 🎧

Ek futuristic music app jisme **YouTube, Spotify aur Audius** ke gaane ek hi jagah chalte hain, **synced lyrics**, **equalizer**, **full-screen karaoke**, aur album ke colour se badalti neon theme ke saath. Web app + installable PWA + Android APK.

## Kya kya hai

| Feature | Kaise kaam karta hai |
|---|---|
| Name se search | Sirf gaane ka naam likho, koi link nahi. Free song catalog (title, artist, cover) + YouTube videos + Audius + Spotify ek saath |
| Free playback | YouTube ke official player se (free, koi Premium nahi). Audius ke full songs bhi free |
| Spotify | Free account: search + gaane ki info Spotify se, play YouTube se (auto match). Premium: Spotify direct (official Web Playback SDK) |
| Kam buffering | Agla gaana 20 sec pehle hi background me load ho jata hai (do players A/B), phir turant switch |
| Synced lyrics | [LRCLIB](https://lrclib.net) se (free). Line pe tap karo to wahan jump |
| Karaoke mode | Full-screen bade lyrics, `L` key ya lyrics button |
| Equalizer | 5 band + presets (Bass Boost, Bass Max, Vocal, Bollywood, Lofi, Club). Audius aur demo gaano par |
| Visualizer | Audius/demo par real audio se; YouTube/Spotify par animated (unki audio browser ko milti nahi) |
| Theme | Settings → Theme colour: Auto (album art se) ya apna fixed colour |
| Queue | Drag karke order badlo, "Play next", remove, shuffle, repeat |
| Liked songs | ♥ dabao, browser me save |
| Lock-screen controls | Media Session API (phone notification / keyboard media keys) |
| Shortcuts | `Space` play/pause, `←/→` 10 sec, `Shift+→` next, `L` karaoke, `/` search |

## Sound quality ke baare me sach

* YouTube music videos aam taur par ~128–160 kbps Opus/AAC me aate hain. "Official Audio" / "Topic" channel wale video sabse saaf hote hain, isliye Spotify-match unko hi pehle dhoondhta hai.
* Spotify Premium ~320 kbps tak deta hai (Spotify khud control karta hai).
* Audius aksar 320 kbps MP3 deta hai.
* App audio ko kabhi download ya rip nahi karta. Sab official players se stream hota hai, isliye app legal rehta hai.

## Setup (5 minute)

```bash
npm install
cp .env.example .env     # keys yahan daalo (ya app ke Settings screen me)
npm run dev              # http://127.0.0.1:5173
```

Bina kisi key ke bhi chalega: **Demo tracks**, **Audius** search/trending, aur **YouTube link paste** karke play.

### 1. YouTube API key (gaane chalane ke liye zaroori, free, card nahi lagta)
App me gaana naam se dhoondhne ke baad usko YouTube par match karke chalaya jata hai, iske liye ye key chahiye. Ek baar daal do, phir kabhi link paste nahi karna padega. Best tarika: key ko GitHub secret `VITE_YOUTUBE_API_KEY` me daalo, to website aur APK dono me pehle se lagi rahegi.

1. https://console.cloud.google.com par jao, naya project banao.
2. "APIs & Services → Library" me **YouTube Data API v3** enable karo.
3. "Credentials → Create credentials → API key".
4. Key ko **restrict** karo: Application restrictions → *Websites* → apni site ka URL (jaise `https://csbvijaypur-cmd.github.io/*` aur `http://127.0.0.1:5173/*`). API restriction → sirf YouTube Data API v3.
5. Free quota: 10,000 units/din, ek search = ~100 units, yaani ~100 search/din. Zyada chahiye to Google se quota badhwa sakte ho.

### 2. Spotify Client ID (Spotify search ke liye, optional)
1. https://developer.spotify.com/dashboard par login karke **Create app**.
2. *Redirect URI* me wahi URL daalo jo app ke Settings screen par dikh raha hai (jaise `http://127.0.0.1:5173/` ya `https://csbvijaypur-cmd.github.io/MUSIC/`). Spotify `localhost` allow nahi karta, `127.0.0.1` use karo.
3. APIs me **Web API** aur **Web Playback SDK** tick karo.
4. Client ID copy karke app ke Settings me daalo, phir "Spotify connect karo".
5. Development mode me sirf wahi log login kar sakte hain jinko aap dashboard ke *User Management* me add karo. Agar Spotify dashboard aapse Premium maange to ye step skip kar do, app YouTube + Audius se pura chalega.

## Website live karna (GitHub Pages, free)
1. Repo → **Settings → Pages → Source: GitHub Actions**. (Free plan par Pages ke liye repo public hona chahiye.)
2. Optional: Repo → Settings → Secrets → Actions me `VITE_YOUTUBE_API_KEY` aur `VITE_SPOTIFY_CLIENT_ID` daalo, taaki keys app me pehle se ho. Dhyan do: web app me key sabko dikhti hai, isliye step 1.4 wala restriction zaroor lagao.
3. `main` par push hote hi site `https://csbvijaypur-cmd.github.io/MUSIC/` par aa jayegi.

## Android app (APK)
* **Bina Android Studio:** `main` par push karo → repo ke **Actions → Android APK** → latest run → `dhun-music-apk` download → phone par install (Unknown sources allow karna padega).
* **Android Studio se:** `npm run android` (build + sync + Android Studio khulega) → Run ▶.
* Note: Android app me Spotify login web jitna smooth nahi hai; Spotify ke liye website version best hai. YouTube ke gaane app band/background hone par ruk sakte hain (YouTube ka rule), Audius ke gaane chalte rehte hain.

## Project structure
```
src/lib/store.js      player engine: queue, A/B preloading, sources, EQ, media session
src/lib/catalog.js    free song search (iTunes Search API, no key)
src/lib/youtube.js    YouTube search + IFrame API + title cleanup
src/lib/spotify.js    PKCE login, search, Web Playback SDK
src/lib/audius.js     Audius free full tracks
src/lib/lyrics.js     LRCLIB synced lyrics + LRC parser
src/lib/color.js      album-art accent colour
src/lib/demo.js       built-in synth demo tracks
src/components/       UI (player bar, now playing, karaoke, equalizer, views)
android/              Capacitor Android project
```
