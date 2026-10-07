import { useStore } from '../state/store';
import { METHOD_LABELS } from '../lib/calc';
import { date, money } from '../lib/format';
import { nextOpenRound } from '../lib/draw';

export default function Home() {
  const { state } = useStore();

  if (state.bhishis.length === 0) {
    return (
      <div className="card empty">
        <h1>Welcome to Bhishi Manager</h1>
        <p>Run your bhishi (chit fund / ROSCA) without the notebook: members, draws, payments and all the math in one place.</p>
        <div className="row">
          <a className="btn" href="#/new">
            Set up your first bhishi
          </a>
          <a className="btn btn-ghost" href="#/calculator">
            Try the calculator
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <h1>My Bhishis</h1>
        <a className="btn" href="#/new">
          + New Bhishi
        </a>
      </div>
      <div className="cards">
        {state.bhishis.map((b) => {
          const done = b.rounds.filter((r) => r.winnerId).length;
          const next = nextOpenRound(b);
          return (
            <a key={b.id} className="card bhishi-card" href={`#/bhishi/${b.id}`}>
              <h2>{b.name}</h2>
              <p className="muted">{METHOD_LABELS[b.config.method]}</p>
              <div className="kv">
                <span>Pot</span>
                <strong>{money(b.config.memberCount * b.config.contribution)}</strong>
              </div>
              <div className="kv">
                <span>Members</span>
                <strong>{b.members.length}</strong>
              </div>
              <div className="kv">
                <span>Next round</span>
                <strong>{next ? `#${next.number} · ${date(next.dueDate)}` : 'Completed 🎉'}</strong>
              </div>
              <div className="progress">
                <div style={{ width: `${(done / b.rounds.length) * 100}%` }} />
              </div>
              <small className="muted">
                {done} of {b.rounds.length} rounds done
              </small>
            </a>
          );
        })}
      </div>
    </div>
  );
}
