import type { Bhishi, Member } from './types';
import { DEFAULT_CONFIG, toISODate } from './calc';
import { buildRounds } from '../state/store';
import { uid } from './format';

const NAMES: [string, string][] = [
  ['Asha Patil', '98765 43210'],
  ['Meena Joshi', '98220 12345'],
  ['Riya Deshmukh', '99701 55821'],
  ['Sunita Kulkarni', '90110 77432'],
  ['Kavita Shinde', '98500 33190'],
  ['Pooja Gokhale', '97300 66218'],
  ['Neha Bhosale', '88050 41927'],
  ['Shalini More', '95450 20864'],
];

/** An example auction bhishi, three rounds in, for trying the app out. */
export function sampleBhishi(): Bhishi {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 3, 5);
  const members: Member[] = NAMES.map(([name, phone]) => ({
    id: uid(),
    name,
    phone,
    email: '',
    notes: '',
    joinedAt: now.toISOString(),
    active: true,
  }));
  const b: Bhishi = {
    id: uid(),
    name: 'Sample: Society Ladies Bhishi',
    organizer: 'Asha Patil',
    startDate: toISODate(start),
    frequency: 'monthly',
    config: { ...DEFAULT_CONFIG, method: 'auction', memberCount: 8, contribution: 5000, commissionPct: 2, maxBidPct: 25, minBidPct: 3 },
    members,
    payoutOrder: members.map((m) => m.id),
    rounds: [],
    createdAt: now.toISOString(),
  };
  const results: [number, number][] = [
    [2, 24],
    [5, 19],
    [0, 15],
  ];
  b.rounds = buildRounds(b).map((r, i) => {
    const res = results[i];
    const paid = i < 3 ? Object.fromEntries(members.map((m, j) => [m.id, i < 2 || j % 3 !== 0])) : {};
    return res ? { ...r, winnerId: members[res[0]].id, bidPct: res[1], payments: paid, drawnAt: now.toISOString() } : r;
  });
  return b;
}
