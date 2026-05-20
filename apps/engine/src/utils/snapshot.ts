import prisma from '@exness-v3/db';
import { prices, users } from '../../memoryDb';
import { candleStore } from './candlestick.utils';
import type { PriceStore, Trade, UserStore } from '../types';

const ENGINE_SNAPSHOT_KIND = 'engine-runtime';

type SerializedTrade = Omit<Trade, 'createdAt' | 'closedAt'> & {
  createdAt: string;
  closedAt?: string;
};

type SerializedUserStore = Record<
  string,
  {
    id: string;
    email: string;
    balance: {
      amount: number;
      currency: string;
    };
    trades: SerializedTrade[];
  }
>;

type EngineSnapshotState = {
  prices: PriceStore;
  users: SerializedUserStore;
  candleStore: typeof candleStore;
  lastSnapshotAt: number;
  lastItemReadId: string;
};

function serializeUsers(store: UserStore): SerializedUserStore {
  return Object.fromEntries(
    Object.entries(store).map(([email, user]) => [
      email,
      {
        ...user,
        trades: user.trades.map((trade) => ({
          ...trade,
          createdAt: trade.createdAt.toISOString(),
          closedAt: trade.closedAt?.toISOString(),
        })),
      },
    ])
  );
}

function deserializeUsers(store: SerializedUserStore): UserStore {
  return Object.fromEntries(
    Object.entries(store).map(([email, user]) => [
      email,
      {
        ...user,
        trades: user.trades.map((trade) => ({
          ...trade,
          createdAt: new Date(trade.createdAt),
          closedAt: trade.closedAt ? new Date(trade.closedAt) : undefined,
        })),
      },
    ])
  );
}

export async function restoreEngineSnapshot() {
  const snapshot = await prisma.engineSnapshot.findUnique({
    where: { kind: ENGINE_SNAPSHOT_KIND },
  });

  if (!snapshot) {
    return null;
  }

  const state = snapshot.state as unknown as EngineSnapshotState;
  Object.assign(prices, state.prices);
  Object.assign(users, deserializeUsers(state.users));
  if (state.candleStore) {
    Object.assign(candleStore, state.candleStore);
  }

  return {
    lastSnapshotAt: state.lastSnapshotAt,
    lastItemReadId: state.lastItemReadId,
  };
}

export async function saveEngineSnapshot(input: {
  lastSnapshotAt: number;
  lastItemReadId: string;
}) {
  const state = JSON.parse(
    JSON.stringify({
      prices,
      users: serializeUsers(users),
      candleStore,
      lastSnapshotAt: input.lastSnapshotAt,
      lastItemReadId: input.lastItemReadId,
    })
  );

  await prisma.engineSnapshot.upsert({
    where: { kind: ENGINE_SNAPSHOT_KIND },
    create: {
      kind: ENGINE_SNAPSHOT_KIND,
      state,
    },
    update: {
      state,
    },
  });
}
