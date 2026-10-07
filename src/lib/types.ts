export type Frequency = 'weekly' | 'fortnightly' | 'monthly';

/**
 * How the pot is calculated each round.
 * - lottery:        everyone pays the same, winner picked by random draw, gets the full pot.
 * - fixed-order:    same money as lottery, but the payout order is agreed up-front.
 * - auction:        members bid a discount ("boli"); highest discount wins, the
 *                   discount is shared back as dividend.
 * - fixed-discount: like auction, but the discount for each round is pre-agreed
 *                   (high early, low late) and the winner is drawn by lottery.
 * - premium:        members who have already won pay an extra premium on every
 *                   later instalment, so later pots grow.
 */
export type Method = 'lottery' | 'fixed-order' | 'auction' | 'fixed-discount' | 'premium';

/** Who receives the dividend (discount) of a round. */
export type DividendMode = 'all' | 'non-winners';

export interface BhishiConfig {
  memberCount: number;
  /** Base instalment each member pays per round. */
  contribution: number;
  /** Organizer commission as % of the chit value (memberCount × contribution). */
  commissionPct: number;
  method: Method;
  dividendMode: DividendMode;
  /** fixed-discount: discount % of chit value in round 1, falling linearly to discountEndPct. */
  discountStartPct: number;
  discountEndPct: number;
  /** auction: projected bid % in round 1, falling linearly to maxBid → minBid (used for projections). */
  maxBidPct: number;
  minBidPct: number;
  /** premium: extra % of the instalment paid by members who already won. */
  premiumPct: number;
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  joinedAt: string;
  active: boolean;
}

export interface Round {
  number: number;
  dueDate: string;
  winnerId: string | null;
  /** Actual winning bid % (auction only). */
  bidPct: number | null;
  /** memberId → paid? */
  payments: Record<string, boolean>;
  drawnAt: string | null;
}

export interface Bhishi {
  id: string;
  name: string;
  organizer: string;
  startDate: string;
  frequency: Frequency;
  config: BhishiConfig;
  members: Member[];
  /** For fixed-order: memberIds in payout order. */
  payoutOrder: string[];
  rounds: Round[];
  createdAt: string;
}
