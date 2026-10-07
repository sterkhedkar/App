import { useEffect, useMemo, useRef, useState } from 'react';
import type { Bhishi, Member, Round } from '../lib/types';
import { METHOD_LABELS, allOutcomes, computeSchedule, periodsPerYear, type RoundBreakdown } from '../lib/calc';
import { date, money, uid } from '../lib/format';
import { drawWinner, eligibleMembers, nextOpenRound } from '../lib/draw';
import { useStore } from '../state/store';
import { OutcomeTable, ScheduleTable } from '../components/Tables';
import { navigate } from '../App';
import { ConfirmButton } from '../components/ConfirmButton';

type Tab = 'overview' | 'members' | 'rounds' | 'math' | 'settings';
const TABS: [Tab, string][] = [
  ['overview', 'Overview'],
  ['members', 'Members'],
  ['rounds', 'Draws & payments'],
  ['math', 'Math'],
  ['settings', 'Settings'],
];

export default function BhishiDetail({ id }: { id: string }) {
  const { state } = useStore();
  const b = state.bhishis.find((x) => x.id === id);
  const [tab, setTab] = useState<Tab>('overview');

  const schedule = useMemo(() => (b ? computeSchedule(b.config, b.rounds.map((r) => r.bidPct)) : []), [b]);

  if (!b) {
    return (
      <div className="card empty">
        <h1>Bhishi not found</h1>
        <a className="btn" href="#/">
          Back home
        </a>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{b.name}</h1>
          <p className="muted">
            {METHOD_LABELS[b.config.method]} · {b.config.memberCount} × {money(b.config.contribution)} · {b.frequency}
            {b.organizer && ` · Organizer: ${b.organizer}`}
          </p>
        </div>
      </div>
      <div className="tabs">
        {TABS.map(([t, label]) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview b={b} schedule={schedule} />}
      {tab === 'members' && <Members b={b} />}
      {tab === 'rounds' && <Rounds b={b} schedule={schedule} />}
      {tab === 'math' && <MathTab b={b} schedule={schedule} />}
      {tab === 'settings' && <Settings b={b} />}
    </div>
  );
}

const nameOf = (b: Bhishi, memberId: string | null) => (memberId ? (b.members.find((m) => m.id === memberId)?.name ?? 'Removed member') : null);

/** Round number in which each member won (memberId → round). */
function winRounds(b: Bhishi) {
  const map = new Map<string, number>();
  b.rounds.forEach((r) => r.winnerId && map.set(r.winnerId, r.number));
  return map;
}

/** Instalment a given member owes in a given round. */
function dueFor(b: Bhishi, row: RoundBreakdown, memberId: string) {
  const won = winRounds(b).get(memberId);
  return won != null && won < row.round ? row.dueWinner : row.dueNonWinner;
}

function Overview({ b, schedule }: { b: Bhishi; schedule: RoundBreakdown[] }) {
  const done = b.rounds.filter((r) => r.winnerId);
  const next = nextOpenRound(b);
  const paidOut = done.reduce((s, r) => s + schedule[r.number - 1].payout, 0);
  const collected = b.rounds.reduce(
    (s, r) => s + b.members.filter((m) => r.payments[m.id]).reduce((a, m) => a + dueFor(b, schedule[r.number - 1], m.id), 0),
    0,
  );
  const pending = b.rounds
    .filter((r) => r.number <= (next?.number ?? b.rounds.length))
    .reduce((s, r) => s + b.members.filter((m) => !r.payments[m.id]).length, 0);
  const vacancies = b.config.memberCount - b.members.length;

  return (
    <>
      {vacancies > 0 && <div className="notice">⚠️ {vacancies} slot(s) are empty. Add members so every round has someone to win it.</div>}
      <div className="stats">
        <Stat label="Rounds done" value={`${done.length} / ${b.rounds.length}`} />
        <Stat label="Next round" value={next ? `#${next.number} · ${date(next.dueDate)}` : 'Completed 🎉'} />
        <Stat label="Next pot" value={next ? money(schedule[next.number - 1].payout) : '—'} />
        <Stat label="Paid out so far" value={money(paidOut)} />
        <Stat label="Collected so far" value={money(collected)} />
        <Stat label="Unpaid instalments" value={String(pending)} />
      </div>
      <div className="card">
        <h2>Schedule</h2>
        <ScheduleTable rows={schedule} names={b.rounds.map((r) => nameOf(b, r.winnerId) ?? (b.config.method === 'fixed-order' ? nameOf(b, b.payoutOrder[r.number - 1]) : null))} />
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

/* ---------------- Members (user management) ---------------- */

const emptyMember = (): Member => ({ id: uid(), name: '', phone: '', email: '', notes: '', joinedAt: new Date().toISOString(), active: true });

function Members({ b }: { b: Bhishi }) {
  const { dispatch } = useStore();
  const [editing, setEditing] = useState<Member | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [query, setQuery] = useState('');
  const wins = winRounds(b);
  const canAdd = b.members.length < b.config.memberCount;

  const filtered = b.members.filter((m) => `${m.name} ${m.phone} ${m.email}`.toLowerCase().includes(query.toLowerCase()));

  const save = (m: Member) => {
    dispatch({ type: isNew ? 'addMember' : 'updateMember', id: b.id, member: m });
    setEditing(null);
  };

  return (
    <div className="card">
      <div className="page-head">
        <h2>
          Members ({b.members.length}/{b.config.memberCount})
        </h2>
        <div className="row">
          <input className="search" placeholder="Search name, phone, email" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button
            className="btn"
            disabled={!canAdd}
            title={canAdd ? '' : 'All slots are filled. Remove a member who has not won to free a slot.'}
            onClick={() => {
              setIsNew(true);
              setEditing(emptyMember());
            }}
          >
            + Add member
          </button>
        </div>
      </div>
      {!canAdd && <p className="muted small">All {b.config.memberCount} slots are filled. To swap someone out, edit their details or remove a member who hasn’t won yet.</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className={m.active ? '' : 'inactive'}>
                <td>
                  <strong>{m.name}</strong>
                  {m.notes && <div className="muted small">{m.notes}</div>}
                </td>
                <td>{m.phone || <span className="muted">—</span>}</td>
                <td>{m.email || <span className="muted">—</span>}</td>
                <td>
                  {wins.has(m.id) ? <span className="pill pill-won">Won round {wins.get(m.id)}</span> : m.active ? <span className="pill">Yet to win</span> : <span className="pill pill-off">On hold</span>}
                </td>
                <td className="actions">
                  <button
                    className="link"
                    onClick={() => {
                      setIsNew(false);
                      setEditing(m);
                    }}
                  >
                    Edit
                  </button>
                  {!wins.has(m.id) && (
                    <button className="link" onClick={() => dispatch({ type: 'updateMember', id: b.id, member: { ...m, active: !m.active } })}>
                      {m.active ? 'Hold' : 'Activate'}
                    </button>
                  )}
                  <ConfirmButton
                    className="link danger"
                    disabled={wins.has(m.id)}
                    title={wins.has(m.id) ? 'Members who have won cannot be removed. They still owe instalments.' : ''}
                    question={`Remove ${m.name}?`}
                    confirmLabel="Remove"
                    onConfirm={() => dispatch({ type: 'removeMember', id: b.id, memberId: m.id })}
                  >
                    Remove
                  </ConfirmButton>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No members match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && <MemberForm member={editing} isNew={isNew} others={b.members.filter((m) => m.id !== editing.id)} onSave={save} onCancel={() => setEditing(null)} />}
    </div>
  );
}

function MemberForm({ member, isNew, others, onSave, onCancel }: { member: Member; isNew: boolean; others: Member[]; onSave: (m: Member) => void; onCancel: () => void }) {
  const [m, setM] = useState(member);
  const dup = others.some((o) => o.name.trim().toLowerCase() === m.name.trim().toLowerCase());
  const invalidEmail = m.email.trim() !== '' && !/^\S+@\S+\.\S+$/.test(m.email.trim());
  const error = !m.name.trim() ? 'Name is required.' : dup ? 'Another member already has this name.' : invalidEmail ? 'Email looks invalid.' : '';
  const field = (k: keyof Member) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setM({ ...m, [k]: e.target.value });

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!error) onSave({ ...m, name: m.name.trim(), phone: m.phone.trim(), email: m.email.trim() });
        }}
      >
        <h2>{isNew ? 'Add member' : `Edit ${member.name}`}</h2>
        <label className="field">
          <span>Name</span>
          <input value={m.name} onChange={field('name')} autoFocus />
        </label>
        <label className="field">
          <span>Phone</span>
          <input value={m.phone} onChange={field('phone')} inputMode="tel" />
        </label>
        <label className="field">
          <span>Email</span>
          <input value={m.email} onChange={field('email')} type="email" />
        </label>
        <label className="field">
          <span>Notes</span>
          <textarea rows={2} value={m.notes} onChange={field('notes')} />
        </label>
        {error && <p className="errors">{error}</p>}
        <div className="wizard-nav">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={!!error}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- Draws & payments ---------------- */

function Rounds({ b, schedule }: { b: Bhishi; schedule: RoundBreakdown[] }) {
  const next = nextOpenRound(b);
  const [open, setOpen] = useState<number | null>(next?.number ?? null);

  return (
    <div className="stack">
      {next && <DrawPanel b={b} round={next} row={schedule[next.number - 1]} />}
      <div className="card">
        <h2>Rounds</h2>
        <div className="rounds">
          {b.rounds.map((r) => {
            const row = schedule[r.number - 1];
            const paidCount = b.members.filter((m) => r.payments[m.id]).length;
            return (
              <div key={r.number} className={`round ${r.winnerId ? 'done' : ''}`}>
                <button className="round-head" onClick={() => setOpen(open === r.number ? null : r.number)}>
                  <span className="num-badge">{r.number}</span>
                  <span>{date(r.dueDate)}</span>
                  <span className="grow">{r.winnerId ? <>🏆 {nameOf(b, r.winnerId)}</> : <span className="muted">No winner yet</span>}</span>
                  <span>{money(row.payout)}</span>
                  <span className={`pill ${paidCount === b.members.length ? 'pill-won' : ''}`}>
                    {paidCount}/{b.members.length} paid
                  </span>
                </button>
                {open === r.number && <Payments b={b} round={r} row={row} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Payments({ b, round, row }: { b: Bhishi; round: Round; row: RoundBreakdown }) {
  const { dispatch } = useStore();
  const isLast = b.rounds.filter((r) => r.winnerId).at(-1)?.number === round.number;
  return (
    <div className="payments">
      <ul>
        {b.members.map((m) => (
          <li key={m.id}>
            <label>
              <input type="checkbox" checked={!!round.payments[m.id]} onChange={() => dispatch({ type: 'togglePayment', id: b.id, round: round.number, memberId: m.id })} />
              <span className="grow">{m.name}</span>
              <span>{money(dueFor(b, row, m.id))}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="row">
        <button
          className="btn btn-ghost btn-small"
          onClick={() => b.members.forEach((m) => !round.payments[m.id] && dispatch({ type: 'togglePayment', id: b.id, round: round.number, memberId: m.id }))}
        >
          Mark all paid
        </button>
        {round.winnerId && isLast && (
          <ConfirmButton
            className="btn btn-ghost btn-small danger"
            question={`Undo round ${round.number}'s result?`}
            confirmLabel="Undo"
            onConfirm={() => dispatch({ type: 'setWinner', id: b.id, round: round.number, winnerId: null })}
          >
            Undo winner
          </ConfirmButton>
        )}
      </div>
    </div>
  );
}

function DrawPanel({ b, round, row }: { b: Bhishi; round: Round; row: RoundBreakdown }) {
  const { dispatch } = useStore();
  const eligible = eligibleMembers(b);
  const [spinning, setSpinning] = useState(false);
  const [display, setDisplay] = useState<string | null>(null);
  const [bidWinner, setBidWinner] = useState('');
  const [bidPct, setBidPct] = useState(Math.round(row.discountPct));
  const timer = useRef<number>();

  useEffect(() => () => window.clearInterval(timer.current), []);
  useEffect(() => setBidPct(Math.round(row.discountPct)), [round.number]);

  const method = b.config.method;
  const isLastRound = round.number === b.config.memberCount;

  if (eligible.length === 0) {
    return <div className="notice">No eligible members for round {round.number}. Add or re-activate members.</div>;
  }

  const runDraw = () => {
    const winner = drawWinner(b);
    if (!winner) return;
    setSpinning(true);
    let ticks = 0;
    timer.current = window.setInterval(() => {
      ticks++;
      setDisplay(eligible[ticks % eligible.length].name);
      if (ticks > 18) {
        window.clearInterval(timer.current);
        setDisplay(nameOf(b, winner));
        setSpinning(false);
        dispatch({ type: 'setWinner', id: b.id, round: round.number, winnerId: winner });
      }
    }, 90);
  };

  const orderedNext = b.payoutOrder.find((mid) => eligible.some((e) => e.id === mid)) ?? null;

  return (
    <div className="card draw">
      <h2>
        Round {round.number} · {date(round.dueDate)}
      </h2>
      <p className="muted">
        Pot: <strong>{money(row.grossPool)}</strong>
        {row.discount > 0 && <> · Discount {money(row.discount)}</>}
        {row.commission > 0 && <> · Commission {money(row.commission)}</>} · Winner receives <strong>{money(row.payout)}</strong> · {eligible.length} eligible
      </p>

      {(method === 'lottery' || method === 'fixed-discount' || method === 'premium') && (
        <div className="draw-box">
          <div className={`draw-name ${spinning ? 'spinning' : ''}`}>{display ?? '🎲'}</div>
          <button className="btn btn-big" onClick={runDraw} disabled={spinning}>
            {spinning ? 'Drawing…' : eligible.length === 1 ? `Award to ${eligible[0].name}` : 'Draw winner'}
          </button>
          <details className="helper">
            <summary>Eligible members</summary>
            <p>{eligible.map((e) => e.name).join(', ')}</p>
          </details>
        </div>
      )}

      {method === 'fixed-order' && (
        <div className="draw-box">
          <div className="draw-name">{nameOf(b, orderedNext) ?? '—'}</div>
          <button className="btn btn-big" disabled={!orderedNext} onClick={() => dispatch({ type: 'setWinner', id: b.id, round: round.number, winnerId: orderedNext })}>
            Confirm payout
          </button>
        </div>
      )}

      {method === 'auction' && (
        <form
          className="grid3"
          onSubmit={(e) => {
            e.preventDefault();
            if (bidWinner) dispatch({ type: 'setWinner', id: b.id, round: round.number, winnerId: bidWinner, bidPct: isLastRound ? 0 : bidPct });
            setBidWinner('');
          }}
        >
          <label className="field">
            <span>Highest bidder</span>
            <select value={bidWinner} onChange={(e) => setBidWinner(e.target.value)}>
              <option value="">Select…</option>
              {eligible.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Winning bid (discount %)</span>
            <input type="number" min={0} max={50} step={0.5} value={isLastRound ? 0 : bidPct} disabled={isLastRound} onChange={(e) => setBidPct(Number(e.target.value))} />
            <small>
              = {money((row.chitValue * (isLastRound ? 0 : bidPct)) / 100)} off; winner gets {money(row.grossPool - (row.chitValue * (isLastRound ? 0 : bidPct)) / 100 - row.commission)}
            </small>
          </label>
          <div className="field">
            <span>&nbsp;</span>
            <button className="btn" disabled={!bidWinner}>
              Record auction result
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ---------------- Math ---------------- */

function MathTab({ b, schedule }: { b: Bhishi; schedule: RoundBreakdown[] }) {
  const outcomes = allOutcomes(schedule, periodsPerYear(b.frequency));
  const names = b.rounds.map((r) => nameOf(b, r.winnerId) ?? (b.config.method === 'fixed-order' ? nameOf(b, b.payoutOrder[r.number - 1]) : null));
  const c = b.config;
  return (
    <div className="card">
      <h2>How the numbers work</h2>
      <ul className="formula">
        <li>
          <b>Chit value</b> = members × instalment = {c.memberCount} × {money(c.contribution)} = <b>{money(c.memberCount * c.contribution)}</b>
        </li>
        {c.method === 'premium' && (
          <li>
            <b>Pool</b> in round r = chit value + (r − 1) × {c.premiumPct}% × instalment (members who already won pay the premium)
          </li>
        )}
        {(c.method === 'auction' || c.method === 'fixed-discount') && (
          <li>
            <b>Discount</b> = bid % × chit value, shared as dividend among {c.dividendMode === 'all' ? 'all members' : 'members who haven’t won yet'} → lowers their instalment
          </li>
        )}
        {c.commissionPct > 0 && (
          <li>
            <b>Commission</b> = {c.commissionPct}% × chit value = {money((c.memberCount * c.contribution * c.commissionPct) / 100)} per round
          </li>
        )}
        <li>
          <b>Winner receives</b> = pool − discount − commission
        </li>
        <li>
          <b>Effective yearly rate</b>: the interest rate that makes your payments and the pot you receive balance out (IRR), annualised. Early winners effectively borrow, late winners effectively save.
        </li>
      </ul>
      {c.method === 'auction' && <p className="muted small">Rounds without a recorded bid use the projected bid curve ({c.maxBidPct}% → {c.minBidPct}%).</p>}
      <h3>Outcome by position</h3>
      <OutcomeTable outcomes={outcomes} names={names} />
    </div>
  );
}

/* ---------------- Settings ---------------- */

function Settings({ b }: { b: Bhishi }) {
  const { dispatch } = useStore();
  const [name, setName] = useState(b.name);
  const [organizer, setOrganizer] = useState(b.organizer);
  const wins = winRounds(b);

  const moveOrder = (i: number, d: -1 | 1) => {
    const order = [...b.payoutOrder];
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    dispatch({ type: 'update', id: b.id, patch: { payoutOrder: order } });
  };

  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(b, null, 2);
  const copyJson = () => {
    setShowJson(true);
    navigator.clipboard
      ?.writeText(json)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };

  return (
    <div className="stack">
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) dispatch({ type: 'update', id: b.id, patch: { name: name.trim(), organizer: organizer.trim() } });
        }}
      >
        <h2>Details</h2>
        <div className="grid2">
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>Organizer</span>
            <input value={organizer} onChange={(e) => setOrganizer(e.target.value)} />
          </label>
        </div>
        <button className="btn" disabled={!name.trim()}>
          Save
        </button>
      </form>

      {b.config.method === 'fixed-order' && (
        <div className="card">
          <h2>Payout order</h2>
          <ol className="order-list">
            {b.payoutOrder.map((mid, i) => (
              <li key={mid}>
                <span className="grow">{nameOf(b, mid)}</span>
                {wins.has(mid) ? (
                  <span className="pill pill-won">Paid out</span>
                ) : (
                  <span className="reorder">
                    <button onClick={() => moveOrder(i, -1)} disabled={i === 0 || wins.has(b.payoutOrder[i - 1])}>
                      ↑
                    </button>
                    <button onClick={() => moveOrder(i, 1)} disabled={i === b.payoutOrder.length - 1}>
                      ↓
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="card">
        <h2>Data</h2>
        <div className="row">
          <button className="btn btn-ghost" onClick={copyJson}>
            Copy as JSON
          </button>
          <ConfirmButton
            className="btn btn-ghost danger"
            question={`Delete "${b.name}" permanently?`}
            confirmLabel="Delete"
            onConfirm={() => {
              dispatch({ type: 'delete', id: b.id });
              navigate('/');
            }}
          >
            Delete bhishi
          </ConfirmButton>
        </div>
        {showJson && (
          <>
            <p className="muted small">{copied ? 'Copied to clipboard.' : 'Select the text below and copy it.'}</p>
            <textarea id="export-json" rows={8} readOnly value={json} onFocus={(e) => e.target.select()} />
          </>
        )}
      </div>
    </div>
  );
}
