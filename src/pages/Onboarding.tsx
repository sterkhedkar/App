import { useMemo, useState } from 'react';
import type { Bhishi, BhishiConfig, Frequency, Member } from '../lib/types';
import { DEFAULT_CONFIG, METHOD_LABELS, allOutcomes, computeSchedule, contributionForPot, periodsPerYear, toISODate } from '../lib/calc';
import { MethodFields, MoneyFields, NumberField } from '../components/ConfigFields';
import { OutcomeTable, ScheduleTable } from '../components/Tables';
import { money, uid } from '../lib/format';
import { buildRounds, useStore } from '../state/store';
import { navigate } from '../App';

const STEPS = ['Basics', 'Money', 'Method', 'Members', 'Review'];

type DraftMember = { id: string; name: string; phone: string };

const newMember = (): DraftMember => ({ id: uid(), name: '', phone: '' });

export default function Onboarding() {
  const { dispatch } = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [startDate, setStartDate] = useState(toISODate(new Date()));
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [cfg, setCfg] = useState<BhishiConfig>(DEFAULT_CONFIG);
  const [members, setMembers] = useState<DraftMember[]>([]);
  const [bulk, setBulk] = useState('');
  const [targetPot, setTargetPot] = useState(0);

  const set = (p: Partial<BhishiConfig>) => setCfg((c) => ({ ...c, ...p }));
  const schedule = useMemo(() => computeSchedule(cfg), [cfg]);
  const outcomes = useMemo(() => allOutcomes(schedule, periodsPerYear(frequency)), [schedule, frequency]);

  // Keep the member list in sync with the chosen member count.
  const syncMembers = () =>
    setMembers((ms) => {
      if (ms.length === cfg.memberCount) return ms;
      if (ms.length > cfg.memberCount) return ms.slice(0, cfg.memberCount);
      return [...ms, ...Array.from({ length: cfg.memberCount - ms.length }, newMember)];
    });

  const errors: string[] = [];
  if (step === 0 && !name.trim()) errors.push('Give your bhishi a name.');
  if (step === 0 && !startDate) errors.push('Pick a start date.');
  if (step === 1 && cfg.contribution <= 0) errors.push('Instalment must be more than 0.');
  if (step === 2 && cfg.method === 'auction' && cfg.minBidPct > cfg.maxBidPct) errors.push('Round-1 bid should be ≥ the end bid.');
  if (step === 3) {
    if (members.some((m) => !m.name.trim())) errors.push('Every member needs a name.');
    const names = members.map((m) => m.name.trim().toLowerCase()).filter(Boolean);
    if (new Set(names).size !== names.length) errors.push('Member names must be unique.');
  }

  const next = () => {
    if (errors.length) return;
    if (step === 2) syncMembers();
    setStep((s) => s + 1);
  };

  const applyBulk = () => {
    const lines = bulk
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const parsed = lines.map((l) => {
      const [n, p = ''] = l.split(/[,\t]/).map((x) => x.trim());
      return { id: uid(), name: n, phone: p };
    });
    setMembers((ms) => {
      const filled = ms.filter((m) => m.name.trim());
      const merged = [...filled, ...parsed].slice(0, cfg.memberCount);
      return [...merged, ...Array.from({ length: cfg.memberCount - merged.length }, newMember)];
    });
    setBulk('');
  };

  const move = (i: number, d: -1 | 1) =>
    setMembers((ms) => {
      const j = i + d;
      if (j < 0 || j >= ms.length) return ms;
      const copy = [...ms];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const create = () => {
    const now = new Date().toISOString();
    const finalMembers: Member[] = members.map((m) => ({
      id: m.id,
      name: m.name.trim(),
      phone: m.phone.trim(),
      email: '',
      notes: '',
      joinedAt: now,
      active: true,
    }));
    const bhishi: Bhishi = {
      id: uid(),
      name: name.trim(),
      organizer: organizer.trim(),
      startDate,
      frequency,
      config: cfg,
      members: finalMembers,
      payoutOrder: finalMembers.map((m) => m.id),
      rounds: [],
      createdAt: now,
    };
    bhishi.rounds = buildRounds(bhishi);
    dispatch({ type: 'create', bhishi });
    navigate(`/bhishi/${bhishi.id}`);
  };

  const periodWord = frequency === 'monthly' ? 'months' : frequency === 'weekly' ? 'weeks' : 'fortnights';

  return (
    <div className="card wizard">
      <h1>Set up a new bhishi</h1>
      <ol className="steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'current' : i < step ? 'done' : ''}>
            <button type="button" disabled={i > step} onClick={() => setStep(i)}>
              <span>{i < step ? '✓' : i + 1}</span> {s}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section>
          <h2>Let’s start with the basics</h2>
          <div className="grid2">
            <label className="field">
              <span>Bhishi name</span>
              <input value={name} placeholder="e.g. Society Ladies Bhishi 2026" onChange={(e) => setName(e.target.value)} autoFocus />
            </label>
            <label className="field">
              <span>Organizer (optional)</span>
              <input value={organizer} placeholder="Who runs it?" onChange={(e) => setOrganizer(e.target.value)} />
            </label>
            <label className="field">
              <span>First round date</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="field">
              <span>How often do members pay?</span>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
                <option value="monthly">Monthly</option>
                <option value="fortnightly">Every 2 weeks</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
          </div>
        </section>
      )}

      {step === 1 && (
        <section>
          <h2>How much money?</h2>
          <p className="muted">Each member pays an instalment every round. There is one round per member, so everybody wins the pot exactly once.</p>
          <MoneyFields cfg={cfg} set={set} />
          <details className="helper">
            <summary>Don’t know the instalment? Work back from the pot you want</summary>
            <div className="grid3">
              <NumberField label="Pot I want" value={targetPot} step={1000} suffix="₹" onChange={setTargetPot} />
              <div className="field">
                <span>Instalment needed</span>
                <strong className="static">{money(contributionForPot(targetPot, cfg.memberCount, cfg.commissionPct))}</strong>
              </div>
              <div className="field">
                <span>&nbsp;</span>
                <button type="button" className="btn btn-ghost" disabled={targetPot <= 0} onClick={() => set({ contribution: Math.ceil(contributionForPot(targetPot, cfg.memberCount, cfg.commissionPct)) })}>
                  Use this
                </button>
              </div>
            </div>
          </details>
          <div className="summary-strip">
            <div>
              <small>Pot each round</small>
              <strong>{money(cfg.memberCount * cfg.contribution)}</strong>
            </div>
            <div>
              <small>Duration</small>
              <strong>
                {cfg.memberCount} {periodWord}
              </strong>
            </div>
            <div>
              <small>Each member pays in total</small>
              <strong>{money(cfg.memberCount * cfg.contribution)}</strong>
            </div>
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <h2>How is the winner decided and paid?</h2>
          <MethodFields cfg={cfg} set={set} />
          <h3>Projected schedule</h3>
          <ScheduleTable rows={schedule} />
        </section>
      )}

      {step === 3 && (
        <section>
          <h2>Add the {cfg.memberCount} members</h2>
          {cfg.method === 'fixed-order' && <p className="muted">This bhishi pays out in a fixed order — arrange members in the order they will receive the pot.</p>}
          <details className="helper">
            <summary>Paste a list (one per line: “Name, phone”)</summary>
            <textarea rows={4} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'Asha Patil, 9876543210\nMeena Joshi, 9822012345'} />
            <button type="button" className="btn btn-ghost" onClick={applyBulk} disabled={!bulk.trim()}>
              Add from list
            </button>
          </details>
          <div className="member-list">
            {members.map((m, i) => (
              <div className="member-row" key={m.id}>
                <span className="num-badge">{i + 1}</span>
                <input
                  placeholder="Name"
                  value={m.name}
                  onChange={(e) => setMembers((ms) => ms.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)))}
                />
                <input
                  placeholder="Phone (optional)"
                  value={m.phone}
                  inputMode="tel"
                  onChange={(e) => setMembers((ms) => ms.map((x) => (x.id === m.id ? { ...x, phone: e.target.value } : x)))}
                />
                {cfg.method === 'fixed-order' && (
                  <span className="reorder">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                      ↑
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === members.length - 1} aria-label="Move down">
                      ↓
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setMembers((ms) => ms.map((m, i) => (m.name.trim() ? m : { ...m, name: `Member ${i + 1}` })))}
          >
            Fill empty names with placeholders
          </button>
        </section>
      )}

      {step === 4 && (
        <section>
          <h2>Review</h2>
          <div className="summary-strip">
            <div>
              <small>Name</small>
              <strong>{name}</strong>
            </div>
            <div>
              <small>Method</small>
              <strong>{METHOD_LABELS[cfg.method]}</strong>
            </div>
            <div>
              <small>Members × instalment</small>
              <strong>
                {cfg.memberCount} × {money(cfg.contribution)}
              </strong>
            </div>
            <div>
              <small>Starts</small>
              <strong>{startDate}</strong>
            </div>
          </div>
          <h3>Round-by-round</h3>
          <ScheduleTable rows={schedule} names={cfg.method === 'fixed-order' ? members.map((m) => m.name) : undefined} />
          <h3>What each position ends up with</h3>
          <OutcomeTable outcomes={outcomes} names={cfg.method === 'fixed-order' ? members.map((m) => m.name) : undefined} />
        </section>
      )}

      {errors.length > 0 && (
        <ul className="errors">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="wizard-nav">
        <button type="button" className="btn btn-ghost" onClick={() => (step === 0 ? navigate('/') : setStep(step - 1))}>
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn" onClick={next} disabled={errors.length > 0}>
            Next
          </button>
        ) : (
          <button type="button" className="btn" onClick={create}>
            Create bhishi
          </button>
        )}
      </div>
    </div>
  );
}
