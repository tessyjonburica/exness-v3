import { publisher } from '@exness-v3/redis/pubsub';
import { WS_ACCOUNT_UPDATE_CHANNEL } from '@exness-v3/redis/channels';

export type AccountRealtimeEvent =
  | 'trade_opened'
  | 'trade_closed'
  | 'trade_liquidated'
  | 'funding_updated';

export type AccountRealtimePayload = {
  email: string;
  event: AccountRealtimeEvent;
  balance?: number;
  openOrders?: unknown[];
  transactionId?: string;
};

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

export async function publishAccountUpdate(payload: AccountRealtimePayload) {
  await ensurePublisherConnected();

  await publisher.publish(
    WS_ACCOUNT_UPDATE_CHANNEL,
    JSON.stringify({
      type: 'ACCOUNT_UPDATE',
      data: JSON.stringify(payload),
    })
  );
}
