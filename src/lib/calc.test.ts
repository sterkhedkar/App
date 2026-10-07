import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, allOutcomes, computeSchedule, contributionForPot, irr, membersForPot, roundDates, compareMethods } from './calc';
import type { BhishiConfig } from './types';

const cfg = (p: Partial<BhishiConfig>): BhishiConfig => ({ ...DEFAULT_CONFIG, ...p });

describe('lottery', () => {
  const s = computeSchedule(cfg({ memberCount: 10, contribution: 5000 }));

  it('pays the full pot every round', () => {
    expect(s).toHaveLength(10);
    expect(s.every((r) => r.payout === 50000 && r.dueNonWinner === 5000 && r.dueWinner === 5000)).toBe(true);
  });

  it('is zero-sum for every member', () => {
    allOutcomes(s).forEach((o) => {
      expect(o.net).toBe(0);
      expect(o.totalPaid).toBe(50000);
    });
  });

  it('deducts commission from the payout', () => {
    const c = computeSchedule(cfg({ memberCount: 10, contribution: 5000, commissionPct: 5 }));
    expect(c[0].commission).toBe(2500);
    expect(c[0].payout).toBe(47500);
  });
});

describe('cash balances in every method', () => {
  for (const method of ['lottery', 'fixed-order', 'auction', 'fixed-discount', 'premium'] as const) {
    for (const dividendMode of ['all', 'non-winners'] as const) {
      it(`${method} / ${dividendMode}: collected = sum of dues, payout = collected − commission`, () => {
        const c = cfg({ method, dividendMode, memberCount: 8, contribution: 2000, commissionPct: 3 });
        computeSchedule(c).forEach((r) => {
          const k = r.priorWinners;
          const sumDues = (c.memberCount - k) * r.dueNonWinner + k * r.dueWinner;
          expect(sumDues).toBeCloseTo(r.collected, 1);
          expect(r.payout).toBeCloseTo(r.collected - r.commission, 1);
        });
      });

      it(`${method} / ${dividendMode}: members' nets sum to −total commission`, () => {
        const c = cfg({ method, dividendMode, memberCount: 8, contribution: 2000, commissionPct: 3 });
        const s = computeSchedule(c);
        const totalNet = allOutcomes(s).reduce((a, o) => a + o.net, 0);
        const totalCommission = s.reduce((a, r) => a + r.commission, 0);
        expect(totalNet).toBeCloseTo(-totalCommission, 0);
      });
    }
  }
});

describe('auction', () => {
  const c = cfg({ method: 'auction', memberCount: 5, contribution: 10000, maxBidPct: 20, minBidPct: 5 });

  it('projects a falling bid curve and no discount in the last round', () => {
    const s = computeSchedule(c);
    expect(s.map((r) => r.discountPct)).toEqual([20, 15, 10, 5, 0]);
    expect(s[0].payout).toBe(40000);
    expect(s[0].dueNonWinner).toBe(8000); // 10,000 discount / 5 members
    expect(s[4].payout).toBe(50000);
  });

  it('uses recorded bids over projections', () => {
    const s = computeSchedule(c, [12]);
    expect(s[0].discountPct).toBe(12);
    expect(s[0].payout).toBe(44000);
  });

  it('rewards late winners and charges early winners', () => {
    const o = allOutcomes(computeSchedule(c));
    expect(o[0].net).toBeLessThan(0);
    expect(o[4].net).toBeGreaterThan(0);
    expect(o[0].annualRate!).toBeLessThan(0);
    expect(o[4].annualRate!).toBeGreaterThan(0);
  });

  it('non-winner dividend mode splits only among those yet to win', () => {
    const s = computeSchedule({ ...c, dividendMode: 'non-winners' });
    // Round 2: 15% of 50,000 = 7,500 shared by 4 members yet to win
    expect(s[1].dividendPerMember).toBe(1875);
    expect(s[1].dueWinner).toBe(10000);
  });
});

describe('premium', () => {
  it('grows the pot as more members win', () => {
    const s = computeSchedule(cfg({ method: 'premium', memberCount: 4, contribution: 1000, premiumPct: 10 }));
    expect(s.map((r) => r.payout)).toEqual([4000, 4100, 4200, 4300]);
    expect(s[1].dueWinner).toBe(1100);
  });
});

describe('helpers', () => {
  it('irr of a simple loan', () => {
    expect(irr([-100, 110])).toBeCloseTo(0.1, 6);
    expect(irr([100, -50, -50])).toBe(0);
    expect(irr([-1, -1])).toBeNull();
  });

  it('reverse calculations', () => {
    expect(contributionForPot(100000, 10)).toBe(10000);
    expect(contributionForPot(95000, 10, 5)).toBe(10000);
    expect(membersForPot(100000, 3000)).toBe(34);
  });

  it('round dates clamp month ends', () => {
    expect(roundDates('2026-01-31', 'monthly', 3)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(roundDates('2026-01-01', 'weekly', 2)).toEqual(['2026-01-01', '2026-01-08']);
  });

  it('compareMethods returns all five methods', () => {
    expect(compareMethods(DEFAULT_CONFIG).map((m) => m.method)).toEqual(['lottery', 'fixed-order', 'auction', 'fixed-discount', 'premium']);
  });
});

describe('effective rate', () => {
  it('gives a rate for every position with a non-zero net, signed like the net', () => {
    const c = cfg({ method: 'auction', memberCount: 5, contribution: 10000, maxBidPct: 30, minBidPct: 2 });
    allOutcomes(computeSchedule(c)).forEach((o) => {
      expect(o.annualRate).not.toBeNull();
      expect(Math.sign(o.annualRate!)).toBe(Math.sign(o.net));
    });
  });
});
