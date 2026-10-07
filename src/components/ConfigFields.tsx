import type { BhishiConfig, Method } from '../lib/types';
import { METHOD_DESCRIPTIONS, METHOD_LABELS } from '../lib/calc';

const METHODS = Object.keys(METHOD_LABELS) as Method[];

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-suffix">
        <input
          type="number"
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        />
        {suffix && <em>{suffix}</em>}
      </div>
      {hint && <small>{hint}</small>}
    </label>
  );
}

/** Basic money settings: members, instalment, commission. */
export function MoneyFields({ cfg, set, lockMembers }: { cfg: BhishiConfig; set: (p: Partial<BhishiConfig>) => void; lockMembers?: boolean }) {
  return (
    <div className="grid3">
      {lockMembers ? (
        <div className="field">
          <span>Members</span>
          <strong className="static">{cfg.memberCount}</strong>
        </div>
      ) : (
        <NumberField label="Members (= rounds)" value={cfg.memberCount} min={2} max={100} onChange={(v) => set({ memberCount: Math.max(2, Math.min(100, Math.round(v))) })} />
      )}
      <NumberField label="Instalment per round" value={cfg.contribution} step={100} suffix="₹" onChange={(v) => set({ contribution: Math.max(0, v) })} />
      <NumberField
        label="Organizer commission"
        value={cfg.commissionPct}
        step={0.5}
        max={20}
        suffix="%"
        hint="% of pot kept by organizer each round"
        onChange={(v) => set({ commissionPct: Math.max(0, Math.min(20, v)) })}
      />
    </div>
  );
}

/** Method picker plus the parameters for the chosen method. */
export function MethodFields({ cfg, set }: { cfg: BhishiConfig; set: (p: Partial<BhishiConfig>) => void }) {
  const usesDividend = cfg.method === 'auction' || cfg.method === 'fixed-discount';
  return (
    <>
      <div className="method-grid">
        {METHODS.map((m) => (
          <button type="button" key={m} className={`method-card ${cfg.method === m ? 'selected' : ''}`} onClick={() => set({ method: m })}>
            <strong>{METHOD_LABELS[m]}</strong>
            <span>{METHOD_DESCRIPTIONS[m]}</span>
          </button>
        ))}
      </div>

      {cfg.method === 'auction' && (
        <div className="grid3">
          <NumberField label="Expected bid in round 1" value={cfg.maxBidPct} max={50} suffix="%" onChange={(v) => set({ maxBidPct: v })} hint="Used only for projections" />
          <NumberField label="Expected bid near the end" value={cfg.minBidPct} max={50} suffix="%" onChange={(v) => set({ minBidPct: v })} hint="Actual bids are entered each round" />
        </div>
      )}
      {cfg.method === 'fixed-discount' && (
        <div className="grid3">
          <NumberField label="Discount in round 1" value={cfg.discountStartPct} max={50} suffix="%" onChange={(v) => set({ discountStartPct: v })} />
          <NumberField label="Discount in 2nd-last round" value={cfg.discountEndPct} max={50} suffix="%" onChange={(v) => set({ discountEndPct: v })} hint="Falls linearly; last round is always 0%" />
        </div>
      )}
      {cfg.method === 'premium' && (
        <div className="grid3">
          <NumberField label="Premium after winning" value={cfg.premiumPct} max={100} suffix="%" onChange={(v) => set({ premiumPct: v })} hint="Extra % on each instalment after you win" />
        </div>
      )}
      {usesDividend && (
        <div className="field">
          <span>Who shares the discount (dividend)?</span>
          <div className="segmented">
            <button type="button" className={cfg.dividendMode === 'all' ? 'on' : ''} onClick={() => set({ dividendMode: 'all' })}>
              All members
            </button>
            <button type="button" className={cfg.dividendMode === 'non-winners' ? 'on' : ''} onClick={() => set({ dividendMode: 'non-winners' })}>
              Only members yet to win
            </button>
          </div>
        </div>
      )}
    </>
  );
}
