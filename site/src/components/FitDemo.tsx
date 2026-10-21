import { useId, useState, type CSSProperties } from 'react';
import { Check, TriangleAlert } from 'lucide-react';

const GIB = 1024 ** 3;
// Illustrative inputs: a dense 8B-parameter Llama-style model at Q4_K_M on a 16 GB laptop.
const sample = {
  layers: 32,
  kvHeads: 8,
  keyDim: 128,
  valueDim: 128,
  weights: Math.round(4.58 * GIB),
  free: Math.round(11.2 * GIB),
};
const contexts = [2048, 4096, 8192, 16384, 32768, 65536, 131072];
const shortContext = (tokens: number) => `${tokens / 1024}K`;
const gib = (bytes: number) =>
  `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(bytes / GIB)} GiB`;

/** Same estimate as the Model & Context Checker: weights + FP16 KV cache + runtime allowance. */
function estimate(context: number) {
  const cache = sample.layers * sample.kvHeads * (sample.keyDim + sample.valueDim) * context * 2;
  const runtime = Math.max(512 * 1024 ** 2, Math.ceil(sample.weights * 0.15));
  return { cache, runtime, total: sample.weights + cache + runtime };
}

export default function FitDemo() {
  const [index, setIndex] = useState(3);
  const id = useId();
  const context = contexts[index];
  const { cache, runtime, total } = estimate(context);
  const budget = Math.floor(sample.free * 0.85);
  const fits = total <= budget;
  const scale = Math.max(sample.free, total);
  const segments = [
    ['weights', 'Model weights', sample.weights],
    ['cache', `KV cache for ${context.toLocaleString('en-US')} tokens`, cache],
    ['runtime', 'Runtime allowance', runtime],
  ] as const;

  return (
    <figure className="fit-demo" aria-labelledby={`${id}-title`}>
      <div className="fit-head">
        <div>
          <p className="fit-tool">Model &amp; Context Checker</p>
          <p id={`${id}-title`} className="fit-title">
            Will it fit?
          </p>
        </div>
        <span className="sample-tag">Sample data</span>
      </div>
      <dl className="fit-setup">
        <div>
          <dt>Model</dt>
          <dd>8B dense, Q4_K_M</dd>
        </div>
        <div>
          <dt>Device</dt>
          <dd>16 GB laptop, 11.2 GiB free</dd>
        </div>
      </dl>
      <div className="fit-control">
        <div className="fit-label-row">
          <label htmlFor={`${id}-context`}>Context length</label>
          <span className="fit-readout" aria-hidden="true">
            {context.toLocaleString('en-US')} tokens
          </span>
        </div>
        <input
          id={`${id}-context`}
          type="range"
          min={0}
          max={contexts.length - 1}
          step={1}
          value={index}
          aria-valuetext={`${context.toLocaleString('en-US')} tokens`}
          style={{ '--fill': `${(index / (contexts.length - 1)) * 100}%` } as CSSProperties}
          onChange={(event) => setIndex(Number(event.target.value))}
        />
        <div className="fit-ticks" aria-hidden="true">
          {contexts.map((tokens) => (
            <span key={tokens}>{shortContext(tokens)}</span>
          ))}
        </div>
      </div>
      <div className="fit-result" data-fit={fits ? 'fits' : 'exceeds'}>
        <p className="fit-total">
          <span className="fit-number">{gib(total)}</span>
          <span className="fit-caption">estimated memory</span>
        </p>
        <p className="fit-verdict" aria-live="polite">
          {fits ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <TriangleAlert size={16} aria-hidden="true" />
          )}
          {fits ? 'Fits' : 'Exceeds'} the {gib(budget)} budget
        </p>
      </div>
      <div className="fit-track" aria-hidden="true">
        {segments.map(([kind, , bytes], position) => (
          <span
            key={kind}
            className={`fit-segment ${kind}${position === segments.length - 1 ? ' end' : ''}`}
            style={{ flexGrow: bytes / scale }}
          />
        ))}
        {scale > total && (
          <span className="fit-rest" style={{ flexGrow: (scale - total) / scale }} />
        )}
        <span className="fit-budget" style={{ left: `${(budget / scale) * 100}%` }} />
      </div>
      <ul className="fit-legend">
        {segments.map(([kind, label, bytes]) => (
          <li key={kind}>
            <span className={`fit-swatch ${kind}`} aria-hidden="true" />
            <span>{label}</span>
            <span className="fit-value">{gib(bytes)}</span>
          </li>
        ))}
        <li>
          <span className="fit-swatch budget" aria-hidden="true" />
          <span>Budget: 85% of free memory</span>
          <span className="fit-value">{gib(budget)}</span>
        </li>
      </ul>
      <figcaption className="fit-note">
        Illustrative numbers from the checker’s own formula. DeviceBench reads your model’s metadata
        and your device’s free memory.
      </figcaption>
    </figure>
  );
}
