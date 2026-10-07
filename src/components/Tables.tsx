import type { PositionOutcome, RoundBreakdown } from '../lib/calc';
import { money, pct } from '../lib/format';

export function ScheduleTable({ rows, names }: { rows: RoundBreakdown[]; names?: (string | null)[] }) {
  const showDiscount = rows.some((r) => r.discount > 0);
  const showCommission = rows.some((r) => r.commission > 0);
  const showWinnerDue = rows.some((r) => r.dueWinner !== r.dueNonWinner);
  const max = Math.max(...rows.map((r) => r.payout), 1);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Round</th>
            {names && <th>Winner</th>}
            <th className="num">Pool</th>
            {showDiscount && <th className="num">Discount</th>}
            {showCommission && <th className="num">Commission</th>}
            <th className="num">{showWinnerDue ? 'Due (yet to win)' : 'Due / member'}</th>
            {showWinnerDue && <th className="num">Due (already won)</th>}
            <th className="num">Winner gets</th>
            <th className="bar-col"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.round}>
              <td>{r.round}</td>
              {names && <td>{names[i] ?? <span className="muted">—</span>}</td>}
              <td className="num">{money(r.grossPool)}</td>
              {showDiscount && (
                <td className="num">
                  {money(r.discount)} <small className="muted">({r.discountPct}%)</small>
                </td>
              )}
              {showCommission && <td className="num">{money(r.commission)}</td>}
              <td className="num">{money(r.dueNonWinner)}</td>
              {showWinnerDue && <td className="num">{money(r.dueWinner)}</td>}
              <td className="num strong">{money(r.payout)}</td>
              <td className="bar-col">
                <div className="bar" style={{ width: `${(r.payout / max) * 100}%` }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OutcomeTable({ outcomes, names }: { outcomes: PositionOutcome[]; names?: (string | null)[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Wins in round</th>
            {names && <th>Member</th>}
            <th className="num">Total paid</th>
            <th className="num">Received</th>
            <th className="num">Net gain / loss</th>
            <th className="num" title="Annualised rate implied by the cash flows. Positive = you earned like a saver; negative = you paid like a borrower.">
              Effective yearly rate ⓘ
            </th>
          </tr>
        </thead>
        <tbody>
          {outcomes.map((o, i) => (
            <tr key={o.winRound}>
              <td>{o.winRound}</td>
              {names && <td>{names[i] ?? <span className="muted">—</span>}</td>}
              <td className="num">{money(o.totalPaid)}</td>
              <td className="num">{money(o.received)}</td>
              <td className={`num strong ${o.net > 0.5 ? 'pos' : o.net < -0.5 ? 'neg' : ''}`}>{money(o.net)}</td>
              <td className={`num ${o.annualRate != null && o.annualRate > 0.0005 ? 'pos' : o.annualRate != null && o.annualRate < -0.0005 ? 'neg' : ''}`}>
                {pct(o.annualRate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
