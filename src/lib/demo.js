// Built-in demo tracks: synthesized live with Web Audio, so the app works with zero setup
// (and inside sandboxed previews). Lyrics are original placeholder lines.
const art = (a, b, c) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><radialGradient id="g" cx=".3" cy=".3" r="1"><stop offset="0" stop-color="${a}"/><stop offset=".6" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient></defs><rect width="400" height="400" fill="url(#g)"/><g fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3">${[0, 1, 2, 3, 4].map((i) => `<circle cx="200" cy="200" r="${60 + i * 34}"/>`).join('')}</g></svg>`);

const lrc = (lines, step, start = 2) => lines.map((l, i) => {
  const t = start + i * step, m = Math.floor(t / 60), s = (t % 60).toFixed(2).padStart(5, '0');
  return `[${String(m).padStart(2, '0')}:${s}]${l}`;
}).join('\n');

export const DEMO_TRACKS = [
  { id: 'demo:1', source: 'demo', title: 'Neon Monsoon', artist: 'Lehar Demo', album: 'Synth Sessions', bpm: 96, key: 0, duration: 48,
    art: art('#ff8a5c', '#d6246e', '#2b0f3a'), color: 'rgb(255 99 120)',
    lrc: lrc(['Baarish ki boondein, neon ki roshni', 'Sheher so raha hai, hum jaag rahe', 'Har dhadkan mein ek naya sur', 'Chalo aaj raat bas yahi gaana', 'Lehar uthi hai, rukna nahi', 'Neon Monsoon, phir se ek baar', '(instrumental)'], 6.4) },
  { id: 'demo:2', source: 'demo', title: 'Chai at Midnight', artist: 'Lehar Demo', album: 'Synth Sessions', bpm: 82, key: 5, duration: 52,
    art: art('#ffd36e', '#e2833a', '#3a1d10'), color: 'rgb(244 170 70)',
    lrc: lrc(['Kettle ki seeti, khidki pe chaand', 'Dheere dheere ghoonth, dheere se baat', 'Kal ki fikar ko kal pe chhodo', 'Abhi bas yeh pal, yeh garam haath', 'Chai at midnight, sab theek lage', '(instrumental)'], 7.6) },
  { id: 'demo:3', source: 'demo', title: 'Ocean Drive 2049', artist: 'Lehar Demo', album: 'Synth Sessions', bpm: 118, key: 7, duration: 44,
    art: art('#6ef3ff', '#3a6df0', '#0d1240'), color: 'rgb(80 170 255)',
    lrc: lrc(['Full speed, khule raaste', 'Samandar ke saath saath', 'Headlights mein sapne chamke', 'Volume upar, haath hawa mein', 'Ocean Drive, kabhi khatam na ho', '(instrumental)'], 6.2) },
];

// --- tiny synth engine ---
const NOTE = (n) => 220 * 2 ** (n / 12);
const PROG = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]];

export function createSynth(ctx, out) {
  let timer = null, startAt = 0, offset = 0, track = null, nodes = [];
  const sched = (t0, from, to) => {
    const beat = 60 / track.bpm;
    for (let b = Math.ceil(from / beat); b * beat < to; b++) {
      const when = t0 + b * beat;
      const chord = PROG[Math.floor(b / 4) % 4];
      // kick
      if (b % 2 === 0) blip(when, 'sine', 120, 40, 0.5, 0.25);
      // hat
      blip(when + beat / 2, 'square', 8000, 6000, 0.03, 0.05);
      // pad
      if (b % 4 === 0) chord.forEach((n) => blip(when, 'sawtooth', NOTE(n + track.key - 12), null, 0.05, beat * 4));
      // arp
      const n = chord[b % 3] + track.key + 12 * (b % 8 < 4 ? 0 : 1);
      blip(when, 'triangle', NOTE(n), null, 0.12, beat * 0.9);
    }
  };
  function blip(when, type, f1, f2, vol, dur) {
    if (when < ctx.currentTime - 0.05) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, when);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(out); o.start(when); o.stop(when + dur + 0.05);
    nodes.push(o);
  }
  let scheduledTo = 0;
  const tick = () => {
    const pos = ctx.currentTime - startAt;
    if (pos + 1.5 > scheduledTo) { sched(startAt, scheduledTo, Math.min(scheduledTo + 2, track.duration)); scheduledTo += 2; }
  };
  return {
    play(t, from = 0) {
      this.stop(); track = t; offset = from; startAt = ctx.currentTime - from + 0.05; scheduledTo = from;
      tick(); timer = setInterval(tick, 250);
    },
    stop() { clearInterval(timer); timer = null; nodes.forEach((n) => { try { n.stop(); } catch {} }); nodes = []; },
    position: () => (timer ? ctx.currentTime - startAt : offset),
    pauseAt() { offset = ctx.currentTime - startAt; this.stop(); return offset; },
  };
}
