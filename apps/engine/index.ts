import './load-env';
import { enginePuller } from '@exness-v3/redis/streams';
import { processMessage } from './src/handler';
import { restoreEngineSnapshot, saveEngineSnapshot } from './src/utils/snapshot';

const STREAM_KEY = 'stream:engine';
const GROUP_NAME = 'group';
const CONSUMER_NAME = 'consumer-1';
const SNAPSHOT_INTERVAL = 15_000;
const READ_BATCH_SIZE = 100;

let lastSnapshotAt: number;
let lastItemReadId = '';

async function restoreSnapshot() {
  const state = await restoreEngineSnapshot();
  if (!state) {
    console.log('No engine snapshot found, starting fresh');
    lastSnapshotAt = Date.now();
    return;
  }

  lastSnapshotAt = state.lastSnapshotAt;
  lastItemReadId = state.lastItemReadId;
  console.log('Restored engine snapshot from PostgreSQL');
}

async function saveSnapshot() {
  const now = Date.now();
  if (now - lastSnapshotAt < SNAPSHOT_INTERVAL) return;

  await saveEngineSnapshot({
    lastSnapshotAt: now,
    lastItemReadId,
  });
  lastSnapshotAt = now;
}

async function startEngine() {
  await enginePuller.connect();

  try {
    await enginePuller.xGroupCreate(STREAM_KEY, GROUP_NAME, '0', {
      MKSTREAM: true,
    });
  } catch (err) {
    console.log('Consumer group exists');
  }

  await restoreSnapshot();
  console.log('Engine connected to Redis and PostgreSQL');

  const groups = await enginePuller.xInfoGroups(STREAM_KEY);
  const lastDeliveredId = groups[0]?.lastDeliveredId?.toString();

  if (
    lastDeliveredId &&
    lastItemReadId !== '' &&
    lastItemReadId !== lastDeliveredId
  ) {
    await replay(lastItemReadId, lastDeliveredId);
  }

  while (true) {
    try {
      const response = (await enginePuller.xReadGroup(
        GROUP_NAME,
        CONSUMER_NAME,
        { key: STREAM_KEY, id: '>' },
        { COUNT: READ_BATCH_SIZE }
      )) as any[];

      if (response) {
        const messages = response[0]?.messages ?? [];
        const latestPriceUpdate = [...messages]
          .reverse()
          .find((entry) => entry?.message?.type === 'PRICE_UPDATE');

        if (latestPriceUpdate) {
          await processMessage(latestPriceUpdate);
        }

        for (const msg of messages) {
          lastItemReadId = msg.id;

          if (msg?.message?.type === 'PRICE_UPDATE') {
            continue;
          }

          await processMessage(msg);
        }

        for (const msg of messages) {
          await enginePuller.xAck(STREAM_KEY, GROUP_NAME, msg.id);
          lastItemReadId = msg.id;
        }

        await saveSnapshot();
      } else {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (err) {
      console.error('xReadGroup error, retrying in 1s:', err);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

async function replay(fromId: string, toId: string) {
  const entries = await enginePuller.xRange(STREAM_KEY, fromId, toId);
  const missed = entries.slice(1);

  for (const entry of missed) {
    try {
      if (entry?.message?.type) {
        await processMessage(entry as Parameters<typeof processMessage>[0]);
      }

      lastItemReadId = entry.id;
    } catch (err) {
      console.error('Replay failed', err);
    }
  }
}

startEngine().catch((error) => {
  console.error('Engine failed to start:', error);
  process.exit(1);
});
