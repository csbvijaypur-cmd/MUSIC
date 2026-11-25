import Icon from './Icon.jsx';
import { useStore, setEq, EQ_BANDS, EQ_PRESETS } from '../lib/store.js';

export default function Equalizer({ onClose }) {
  const eq = useStore((s) => s.eq);
  const preset = useStore((s) => s.eqPreset);
  const kind = useStore((s) => s.activeKind);
  const works = !kind || kind === 'audius' || kind === 'demo';
  return (
    <div className="modal-back" onClick={onClose}>
      <section className="modal glass" onClick={(e) => e.stopPropagation()} aria-label="Equalizer">
        <header><h3>Equalizer</h3><button className="ib" onClick={onClose} aria-label="Close"><Icon name="close" /></button></header>
        <div className="presets">
          {Object.keys(EQ_PRESETS).map((p) => (
            <button key={p} className={'chip' + (preset === p ? ' on' : '')} onClick={() => setEq(EQ_PRESETS[p], p)}>{p}</button>
          ))}
        </div>
        <div className="eq">
          {EQ_BANDS.map((b, i) => (
            <label key={b.key}>
              <output>{eq[i] > 0 ? '+' : ''}{eq[i]} dB</output>
              <input type="range" min="-12" max="12" step="1" value={eq[i]} aria-label={b.label}
                onChange={(e) => { const n = [...eq]; n[i] = +e.target.value; setEq(n); }} />
              <span>{b.label}</span>
            </label>
          ))}
        </div>
        <p className={'note' + (works ? '' : ' warn')}>
          {works
            ? 'Equalizer Audius aur demo gaano par live kaam karta hai.'
            : 'Ye gaana YouTube/Spotify player ke andar chal raha hai, unki audio browser ko milti nahi, isliye EQ is gaane par nahi lagega. Audius gaano par lagega.'}
        </p>
      </section>
    </div>
  );
}
