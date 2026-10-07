import type { BhishiConfig, Method } from './types';

export const METHOD_LABELS: Record<Method, string> = {
  lottery: 'Lottery (equal pot)',
  'fixed-order': 'Fixed order (turn-wise)',
  auction: 'Auction / bidding (boli)',
  'fixed-discount': 'Fixed discount schedule',
  premium: 'Premium after winning',
};

export const METHOD_DESCRIPTIONS: Record<Method, string> = {
  lottery:
    'Everyone pays the same amount every round. A random draw picks the winner from members who have not won yet. Winner takes the full pot (minus commission).',
  'fixed-order':
    'Same money as lottery, but the order of winners is decided in advance (e.g. by need or seniority). No draws.',
  auction:
    'Members who need money early bid a discount. The highest discount wins; the winner gets the pot minus the discount, and the discount is shared back as a dividend that reduces everyone’s instalment.',
  'fixed-discount':
    'A pre-agreed discount table: early winners give up more, late winners less. Winner is picked by lottery. Predictable like lottery, fair like auction.',
  premium:
    'Members who have already received the pot pay an extra premium on every remaining instalment. Later pots are bigger, rewarding those who wait.',
};

export const DEFAULT_CONFIG: BhishiConfig = {
  memberCount: 10,
  contribution: 5000,
  commissionPct: 0,
  method: 'lottery',
  dividendMode: 'all',
  discountStartPct: 20,
  discountEndPct: 0,
  maxBidPct: 30,
  minBidPct: 2,
  premiumPct: 10,
};

export interface RoundBreakdown {
  round: number;
  /** Members who have won before this round. */
  priorWinners: number;
  /** Chit value: memberCount × contribution. */
  chitValue: number;
  /** Sum of instalments before dividend (includes premiums). */
  grossPool: number;
  discountPct: number;
  discount: number;
  commission: number;
  /** Dividend per receiving member. */
  dividendPerMember: number;
  /** Members sharing the dividend this round. */
  dividendReceivers: number;
  /** Net instalment for a member who has not yet won (before this round). */
  dueNonWinner: number;
  /** Net instalment for a member who has already won. */
  dueWinner: number;
  /** Net amount actually collected. */
  collected: number;
  /** Amount handed to the winner. */
  payout: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Linear interpolation from `start` (round 1) to `end` (last round). */
export function linear(start: number, end: number, round: number, total: number): number {
  if (total <= 1) return start;
  return start + ((end - start) * (round - 1)) / (total - 1);
}

/**
 * The discount % for a round. For auctions, `actualBidPct` (if recorded) wins over
 * the projected bid curve. The last round never has a discount: there is only one
 * eligible member left so nobody bids against them.
 */
export function discountPctFor(cfg: BhishiConfig, round: number, actualBidPct?: number | null): number {
  const n = cfg.memberCount;
  if (round >= n) return 0;
  switch (cfg.method) {
    case 'auction':
      if (actualBidPct != null) return actualBidPct;
      return linear(cfg.maxBidPct, cfg.minBidPct, round, n - 1);
    case 'fixed-discount':
      return linear(cfg.discountStartPct, cfg.discountEndPct, round, n - 1);
    default:
      return 0;
  }
}

/** Compute the money for one round. */
export function computeRound(cfg: BhishiConfig, round: number, actualBidPct?: number | null): RoundBreakdown {
  const n = cfg.memberCount;
  const c = cfg.contribution;
  const priorWinners = round - 1;
  const chitValue = n * c;

  const premium = cfg.method === 'premium' ? (c * cfg.premiumPct) / 100 : 0;
  const grossPool = n * c + priorWinners * premium;

  const discountPct = discountPctFor(cfg, round, actualBidPct);
  const discount = (chitValue * discountPct) / 100;
  const commission = (chitValue * cfg.commissionPct) / 100;

  // Non-winners here = members who had not won before this round (incl. this round's winner).
  const dividendReceivers = cfg.dividendMode === 'all' ? n : n - priorWinners;
  const dividendPerMember = dividendReceivers > 0 ? discount / dividendReceivers : 0;

  const dueNonWinner = c - dividendPerMember;
  const dueWinner = c + premium - (cfg.dividendMode === 'all' ? dividendPerMember : 0);

  const collected = grossPool - discount;
  const payout = collected - commission;

  return {
    round,
    priorWinners,
    chitValue: round2(chitValue),
    grossPool: round2(grossPool),
    discountPct: round2(discountPct),
    discount: round2(discount),
    commission: round2(commission),
    dividendPerMember: round2(dividendPerMember),
    dividendReceivers,
    dueNonWinner: round2(dueNonWinner),
    dueWinner: round2(dueWinner),
    collected: round2(collected),
    payout: round2(payout),
  };
}

/** Full schedule. `bids[i]` overrides the projected bid for round i+1 (auction). */
export function computeSchedule(cfg: BhishiConfig, bids: (number | null | undefined)[] = []): RoundBreakdown[] {
  const rows: RoundBreakdown[] = [];
  for (let r = 1; r <= cfg.memberCount; r++) rows.push(computeRound(cfg, r, bids[r - 1]));
  return rows;
}

export interface PositionOutcome {
  /** Round in which this member wins. */
  winRound: number;
  totalPaid: number;
  received: number;
  net: number;
  /** Net cash flow per round from the member's point of view (+ in, − out). */
  cashflows: number[];
  /** Interest rate per period implied by the cash flows (null if undefined). */
  ratePerPeriod: number | null;
  /** Annualised rate (positive = member earned, negative = member paid interest). */
  annualRate: number | null;
}

export function periodsPerYear(freq: 'weekly' | 'fortnightly' | 'monthly'): number {
  return freq === 'weekly' ? 52 : freq === 'fortnightly' ? 26 : 12;
}

/** What a member who wins in round `winRound` pays and gets overall. */
export function positionOutcome(
  schedule: RoundBreakdown[],
  winRound: number,
  periodsYear = 12,
): PositionOutcome {
  const cashflows = schedule.map((row) => {
    const hasWon = row.round > winRound;
    const due = hasWon ? row.dueWinner : row.dueNonWinner;
    return row.round === winRound ? row.payout - due : -due;
  });
  const totalPaid = schedule.reduce(
    (s, row) => s + (row.round > winRound ? row.dueWinner : row.dueNonWinner),
    0,
  );
  const received = schedule[winRound - 1]?.payout ?? 0;
  const net = received - totalPaid;
  const ratePerPeriod = irr(cashflows);
  // Express the rate from the member's side: positive = earned (like a saver),
  // negative = cost (like a borrower). The sign follows the member's net result.
  const signed = ratePerPeriod == null ? null : Math.abs(ratePerPeriod) * Math.sign(net);
  const annualRate = signed == null ? null : Math.pow(1 + signed, periodsYear) - 1;
  return {
    winRound,
    totalPaid: round2(totalPaid),
    received: round2(received),
    net: round2(net),
    cashflows: cashflows.map(round2),
    ratePerPeriod: signed,
    annualRate,
  };
}

export function allOutcomes(schedule: RoundBreakdown[], periodsYear = 12): PositionOutcome[] {
  return schedule.map((row) => positionOutcome(schedule, row.round, periodsYear));
}

function npv(rate: number, flows: number[]): number {
  return flows.reduce((s, f, t) => s + f / Math.pow(1 + rate, t), 0);
}

/**
 * Internal rate of return per period. Bhishi cash flows can change sign more
 * than once (pay, receive, pay again), so we scan outward from 0 for the
 * nearest bracketing interval and bisect inside it. Returns null when no
 * meaningful rate exists.
 */
export function irr(flows: number[]): number | null {
  const hasPos = flows.some((f) => f > 1e-9);
  const hasNeg = flows.some((f) => f < -1e-9);
  if (!hasPos || !hasNeg) return null;
  if (Math.abs(flows.reduce((a, b) => a + b, 0)) < 1e-6) return 0;
  const bracket = findBracket(flows);
  if (!bracket) return null;
  let [lo, hi] = bracket;
  let fLo = npv(lo, flows);
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, flows);
    if (Math.abs(fMid) < 1e-9) return mid;
    if (fLo * fMid < 0) hi = mid;
    else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

function findBracket(flows: number[]): [number, number] | null {
  const step = 0.0025;
  const f0 = npv(0, flows);
  for (let k = 1; k * step <= 5; k++) {
    const up = k * step;
    if (npv(up, flows) * f0 <= 0) return [up - step, up];
    const down = -k * step;
    if (down > -0.95 && npv(down, flows) * f0 <= 0) return [down, down + step];
  }
  return null;
}

/** Reverse calculator: what instalment gives a target pot with N members? */
export function contributionForPot(targetPot: number, members: number, commissionPct = 0): number {
  if (members <= 0) return 0;
  // payout (no discount) = N·C·(1 − commission%) → C = pot / (N·(1 − commission%))
  return round2(targetPot / (members * (1 - commissionPct / 100)));
}

/** Reverse calculator: how many members are needed for a pot at a given instalment? */
export function membersForPot(targetPot: number, contribution: number): number {
  if (contribution <= 0) return 0;
  return Math.ceil(targetPot / contribution);
}

export interface MethodSummary {
  method: Method;
  schedule: RoundBreakdown[];
  outcomes: PositionOutcome[];
  firstPayout: number;
  lastPayout: number;
  totalCommission: number;
  bestNet: number;
  worstNet: number;
}

/** Run the same group through every method so they can be compared. */
export function compareMethods(base: BhishiConfig, periodsYear = 12): MethodSummary[] {
  const methods: Method[] = ['lottery', 'fixed-order', 'auction', 'fixed-discount', 'premium'];
  return methods.map((method) => {
    const cfg = { ...base, method };
    const schedule = computeSchedule(cfg);
    const outcomes = allOutcomes(schedule, periodsYear);
    const nets = outcomes.map((o) => o.net);
    return {
      method,
      schedule,
      outcomes,
      firstPayout: schedule[0]?.payout ?? 0,
      lastPayout: schedule[schedule.length - 1]?.payout ?? 0,
      totalCommission: round2(schedule.reduce((s, r) => s + r.commission, 0)),
      bestNet: Math.max(...nets),
      worstNet: Math.min(...nets),
    };
  });
}

/** Due dates for each round. */
export function roundDates(startDate: string, frequency: 'weekly' | 'fortnightly' | 'monthly', count: number): string[] {
  const start = new Date(startDate + 'T00:00:00');
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    if (frequency === 'monthly') {
      d.setMonth(start.getMonth() + i);
      // Clamp e.g. Jan 31 → Feb 28 instead of rolling into March.
      if (d.getDate() !== start.getDate()) d.setDate(0);
    } else {
      d.setDate(start.getDate() + i * (frequency === 'weekly' ? 7 : 14));
    }
    out.push(toISODate(d));
  }
  return out;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
