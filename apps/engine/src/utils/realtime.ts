import { publisher } from '@exness-v3/redis/pubsub';
import { WS_ACCOUNT_UPDATE_CHANNEL } from '@exness-v3/redis/channels';
import type { User } from '../types';

type AccountRealtimeEvent = 'trade_opened' | 'trade_closed' | 'trade_liquidated';

let publisherConnectionPromise: Promise<void> | null = null;

async function ensurePublisherConnected() {
  if (publisher.isOpen) {
    return;
  }

  if (!publisherConnectionPromise) {
    publisherConnectionPromise = publisher
      .connect()
      .then(() => undefined)
      .finally(() => {
        publisherConnectionPromise = null;
      });
  }

  await publisherConnectionPromise;
}

export function publishAccountUpdateInBackground(user: User, event: AccountRealtimeEvent) {
  const openOrders = user.trades.filter((trade) => trade.status === 'OPEN');

  void ensurePublisherConnected()
    .then(() =>
      publisher.publish(
        WS_ACCOUNT_UPDATE_CHANNEL,
        JSON.stringify({
          type: 'ACCOUNT_UPDATE',
          data: JSON.stringify({
            email: user.email,
            event,
            balance: user.balance.amount,
            openOrders,
          }),
        })
      )
    )
    .catch((error) => {
      console.error('[publishAccountUpdateInBackground] Failed to publish account update:', {
        email: user.email,
        event,
        error: error instanceof Error ? error.message : String(error),
      });
    });
}
