import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import type { Bhishi, Member, Round } from '../lib/types';
import { roundDates } from '../lib/calc';

const STORAGE_KEY = 'bhishi-app:v1';

type State = { bhishis: Bhishi[] };

type Action =
  | { type: 'create'; bhishi: Bhishi }
  | { type: 'delete'; id: string }
  | { type: 'update'; id: string; patch: Partial<Pick<Bhishi, 'name' | 'organizer' | 'payoutOrder'>> }
  | { type: 'addMember'; id: string; member: Member }
  | { type: 'updateMember'; id: string; member: Member }
  | { type: 'removeMember'; id: string; memberId: string }
  | { type: 'setWinner'; id: string; round: number; winnerId: string | null; bidPct?: number | null }
  | { type: 'togglePayment'; id: string; round: number; memberId: string }
  | { type: 'import'; state: State };

export function buildRounds(b: Pick<Bhishi, 'startDate' | 'frequency' | 'config'>): Round[] {
  return roundDates(b.startDate, b.frequency, b.config.memberCount).map((dueDate, i) => ({
    number: i + 1,
    dueDate,
    winnerId: null,
    bidPct: null,
    payments: {},
    drawnAt: null,
  }));
}

function mapBhishi(state: State, id: string, fn: (b: Bhishi) => Bhishi): State {
  return { bhishis: state.bhishis.map((b) => (b.id === id ? fn(b) : b)) };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'create':
      return { bhishis: [...state.bhishis, action.bhishi] };
    case 'delete':
      return { bhishis: state.bhishis.filter((b) => b.id !== action.id) };
    case 'update':
      return mapBhishi(state, action.id, (b) => ({ ...b, ...action.patch }));
    case 'addMember':
      return mapBhishi(state, action.id, (b) => ({
        ...b,
        members: [...b.members, action.member],
        payoutOrder: [...b.payoutOrder, action.member.id],
      }));
    case 'updateMember':
      return mapBhishi(state, action.id, (b) => ({
        ...b,
        members: b.members.map((m) => (m.id === action.member.id ? action.member : m)),
      }));
    case 'removeMember':
      return mapBhishi(state, action.id, (b) => ({
        ...b,
        members: b.members.filter((m) => m.id !== action.memberId),
        payoutOrder: b.payoutOrder.filter((x) => x !== action.memberId),
        rounds: b.rounds.map((r) => {
          const payments = { ...r.payments };
          delete payments[action.memberId];
          return { ...r, payments };
        }),
      }));
    case 'setWinner':
      return mapBhishi(state, action.id, (b) => ({
        ...b,
        rounds: b.rounds.map((r) =>
          r.number === action.round
            ? {
                ...r,
                winnerId: action.winnerId,
                bidPct: action.winnerId ? (action.bidPct ?? null) : null,
                drawnAt: action.winnerId ? new Date().toISOString() : null,
              }
            : r,
        ),
      }));
    case 'togglePayment':
      return mapBhishi(state, action.id, (b) => ({
        ...b,
        rounds: b.rounds.map((r) =>
          r.number === action.round
            ? { ...r, payments: { ...r.payments, [action.memberId]: !r.payments[action.memberId] } }
            : r,
        ),
      }));
    case 'import':
      return action.state;
  }
}

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.bhishis)) return parsed;
    }
  } catch {
    /* ignore corrupt / unavailable storage */
  }
  return { bhishis: [] };
}

const Ctx = createContext<{ state: State; dispatch: (a: Action) => void } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage may be full or blocked */
    }
  }, [state]);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
