// Lyrics language helpers:
// - toRoman: Devanagari (Hindi) -> Hinglish-style Roman letters, done locally, no network.
// - translate: any language -> English via the free MyMemory API (no key), cached.
const V = { 'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o', 'ऍ': 'e' };
const M = { 'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e' };
const C = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh',
  'ष': 'sh', 'स': 's', 'ह': 'h', 'ळ': 'l', 'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'ड़': 'd', 'ढ़': 'rh', 'फ़': 'f', 'य़': 'y',
};
const NUKTA = { 'क': 'q', 'ख': 'kh', 'ग': 'gh', 'ज': 'z', 'ड': 'd', 'ढ': 'rh', 'फ': 'f' };
const DIGITS = '०१२३४५६७८९';

export const hasDevanagari = (s) => /[ऀ-ॿ]/.test(s);

function word(w) {
  // 1) split into units: { c: consonant sound, v: vowel sound, inh: inherent 'a' }
  const ch = [...w], u = [];
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    if (C[c] !== undefined) {
      let base = C[c];
      if (ch[i + 1] === '़') { base = NUKTA[c] || base; i++; }
      const nx = ch[i + 1];
      if (nx === '्') { u.push({ c: base, v: '' }); i++; }
      else if (M[nx] !== undefined) { u.push({ c: base, v: M[nx] }); i++; }
      else u.push({ c: base, v: 'a', inh: true });
    } else if (V[c] !== undefined) u.push({ c: '', v: V[c] });
    else if (c === 'ं' || c === 'ँ') u.push({ nasal: true });
    else if (c === 'ः') u.push({ c: 'h', v: '' });
    else if (DIGITS.includes(c)) u.push({ raw: String(DIGITS.indexOf(c)) });
    else if (c === '।' || c === '॥') u.push({ raw: '.' });
  }
  const syl = u.filter((x) => x.c !== undefined);
  // 2) Hindi schwa deletion: drop the final inherent 'a', and an inherent 'a'
  //    sitting between a vowel-carrying syllable and a consonant+vowel syllable.
  const last = syl[syl.length - 1];
  if (last?.inh && syl.length > 1) last.v = '';
  for (let i = syl.length - 2; i >= 1; i--) {
    const p = syl[i - 1], x = syl[i], n = syl[i + 1];
    if (x.inh && x.c && p.v && n.c && n.v && !p.dropped) { x.v = ''; x.dropped = true; i--; }
  }
  // 3) join, with a few Hinglish spellings for word endings
  let out = u.map((x) => x.raw ?? (x.nasal ? 'n' : x.c + x.v)).join('');
  out = out.replace(/aa$/, 'a').replace(/ee$/, 'i').replace(/en$/, 'ein').replace(/oon$/, 'oon');
  return out;
}

export const toRoman = (s) => (hasDevanagari(s) ? s.replace(/[ऀ-ॿ]+/g, word) : s);

// ---------- English translation ----------
const KEY = 'dhun.tr.';
const mem = new Map();
const looksEnglish = (s) => !hasDevanagari(s) && /^[\x00-\x7F’'‘“”…]*$/.test(s) && /\b(the|you|and|my|is|in|to|of|me|I)\b/i.test(s);

async function one(text) {
  const k = KEY + text;
  try { const c = localStorage.getItem(k); if (c) return c; } catch {}
  const src = hasDevanagari(text) ? 'hi' : 'autodetect';
  const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 450))}&langpair=${src}|en`);
  const d = await r.json();
  let t = d?.responseData?.translatedText || '';
  if (!t || /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(t)) throw new Error('limit');
  t = t.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  try { localStorage.setItem(k, t); } catch {}
  return t;
}

/** Translates unique lines with small concurrency; calls onLine(text, translation) as they arrive. */
export async function translateLines(lines, onLine, signal) {
  const todo = [...new Set(lines.map((l) => l.trim()).filter(Boolean))];
  let i = 0, failed = 0;
  const worker = async () => {
    while (i < todo.length && !signal?.aborted) {
      const text = todo[i++];
      if (looksEnglish(text)) { onLine(text, text); continue; }
      if (mem.has(text)) { onLine(text, mem.get(text)); continue; }
      try { const t = await one(text); mem.set(text, t); onLine(text, t); } catch { failed++; }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return failed;
}
