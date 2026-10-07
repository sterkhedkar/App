import type { Bhishi } from './types';

/** Unbiased random integer in [0, max) using the Web Crypto API. */
export function secureRandomInt(max: number): number {
  if (max <= 0) throw new Error('max must be positive');
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

/** Active members who have not yet received a pot. */
export function eligibleMembers(b: Bhishi) {
  const won = new Set(b.rounds.map((r) => r.winnerId).filter(Boolean));
  return b.members.filter((m) => m.active && !won.has(m.id));
}

/** The next round that has no winner yet, or null if the bhishi is complete. */
export function nextOpenRound(b: Bhishi) {
  return b.rounds.find((r) => !r.winnerId) ?? null;
}

export function drawWinner(b: Bhishi, random: (max: number) => number = secureRandomInt): string | null {
  const pool = eligibleMembers(b);
  if (pool.length === 0) return null;
  return pool[random(pool.length)].id;
}
