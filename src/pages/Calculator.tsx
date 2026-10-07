import { useMemo, useState } from 'react';
import type { BhishiConfig, Frequency, Method } from '../lib/types';
import { DEFAULT_CONFIG, METHOD_LABELS, compareMethods, contributionForPot, membersForPot, periodsPerYear } from '../lib/calc';
import { MethodFields, MoneyFields, NumberField } from '../components/ConfigFields';
import { OutcomeTable, ScheduleTable } from '../components/Tables';
import { money, pct } from '../lib/format';

export default function Calculator() {
  const [cfg, setCfg] = useState<BhishiConfig>(DEFAULT_CONFIG);
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [focus, setFocus] = useState<Method>('lottery');
  const [targetPot, setTargetPot] = useState(100000);
  const set = (p: Partial<BhishiConfig>) => setCfg((c) => ({ ...c, ...p }));

  const ppy = periodsPerYear(frequency);
  const summaries = useMemo(() => compareMethods(cfg, ppy), [cfg, ppy]);
  const focused = summaries.find((s) => s.method === focus)!;

  return (
    <div className="stack">
      <div className="card">
        <h1>Bhishi calculator</h1>
        <p className="muted">Enter your numbers once and see how every way of running a bhishi works out — for the organizer, early winners and late winners.</p>
        <MoneyFields cfg={cfg} set={set} />
        <label className="field narrow">
          <span>Frequency</span>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
            <option value="monthly">Monthly</option>
            <option value="fortnightly">Every 2 weeks</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>
      </div>

      <div className="card">
        <h2>Work backwards from a target pot</h2>
        <div className="grid3">
          <NumberField label="Target pot" value={targetPot} step={1000} suffix="₹" onChange={setTargetPot} />
          <div className="field">
            <span>With {cfg.memberCount} members, each pays</span>
            <strong className="static">{money(contributionForPot(targetPot, cfg.memberCount, cfg.commissionPct))}</strong>
          </div>
          <div className="field">
            <span>At {money(cfg.contribution)} each, members needed</span>
            <strong className="static">{membersForPot(targetPot, cfg.contribution)}</strong>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Compare all methods</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th className="num">Round 1 winner gets</th>
                <th className="num">Last winner gets</th>
                <th className="num">Best net</th>
                <th className="num">Worst net</th>
                <th className="num">1st winner rate / yr</th>
                <th className="num">Last winner rate / yr</th>
                <th className="num">Organizer earns</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.method} className={s.method === focus ? 'highlight' : ''} onClick={() => setFocus(s.method)} style={{ cursor: 'pointer' }}>
                  <td>{METHOD_LABELS[s.method]}</td>
                  <td className="num">{money(s.firstPayout)}</td>
                  <td className="num">{money(s.lastPayout)}</td>
                  <td className={`num ${s.bestNet > 0.5 ? "pos" : ""}`}>{money(s.bestNet)}</td>
                  <td className={`num ${s.worstNet < -0.5 ? "neg" : ""}`}>{money(s.worstNet)}</td>
                  <td className="num">{pct(s.outcomes[0]?.annualRate ?? null)}</td>
                  <td className="num">{pct(s.outcomes[s.outcomes.length - 1]?.annualRate ?? null)}</td>
                  <td className="num">{money(s.totalCommission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">Click a row to see its full breakdown below. Rates: positive = you earned like a saver, negative = you paid like a borrower.</p>
      </div>

      <div className="card">
        <h2>Tune a method</h2>
        <MethodFields
          cfg={{ ...cfg, method: focus }}
          set={(p) => {
            if (p.method) setFocus(p.method);
            const { method: _ignored, ...rest } = p;
            set(rest);
          }}
        />
        <h3>Round-by-round · {METHOD_LABELS[focus]}</h3>
        <ScheduleTable rows={focused.schedule} />
        <h3>Outcome by winning position</h3>
        <OutcomeTable outcomes={focused.outcomes} />
      </div>
    </div>
  );
}
