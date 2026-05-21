import { createServer } from 'node:http';
import { subscriber } from '@exness-v3/redis/pubsub';
import client from '../../../packages/redis/src/index.ts';
import { LATEST_PRICES_KEY, WS_PRICE_UPDATE_CHANNEL } from '../../../packages/redis/src/channels.ts';
import { WebSocketServer, WebSocket } from 'ws';
import './load-env';
import { startPooler } from '../../pooler/src/start-pooler';

const PORT = Number(process.env.WS_PORT || 8080);
const RUN_POOLER = process.env.RUN_POOLER === 'true';
let firstBroadcastLogged = false;
let subscriptionReady = false;

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'ws' }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'NOT_FOUND' }));
});

const wss = new WebSocketServer({ server });

server.on('listening', () => {
  console.log(`WebSocket server is listening on port ${PORT}`);
});

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');
  ws.on('close', () => console.log('Client disconnected'));

  void (async () => {
    try {
      if (!client.isOpen) {
        await client.connect();
      }

      const latestPrices = await client.get(LATEST_PRICES_KEY);
      if (!latestPrices) {
        return;
      }

      ws.send(
        JSON.stringify({
          data: latestPrices,
          type: 'PRICE_UPDATE',
        })
      );

      if (!firstBroadcastLogged) {
        console.log('Broadcasted first quote snapshot to a connected client');
        firstBroadcastLogged = true;
      }
    } catch (error) {
      console.error('Failed to deliver initial quote snapshot to client:', error);
    }
  })();
});

const handlePriceUpdate = (message: string) => {
  if (!subscriptionReady) {
    return;
  }

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }

  if (!firstBroadcastLogged) {
    console.log('Broadcasted first Redis price update to connected clients');
    firstBroadcastLogged = true;
  }
};

const main = async () => {
  try {
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    subscriber.on('error', (err: unknown) => console.error('Redis subscriber error:', err));
    client.on('error', (err: unknown) => console.error('Redis cache client error:', err));

    await subscriber.connect();
    console.log('Connected to Redis subscriber');
    await client.connect();
    console.log('Connected to Redis cache client');

    await subscriber.subscribe(WS_PRICE_UPDATE_CHANNEL, handlePriceUpdate);
    subscriptionReady = true;
    console.log(`Subscribed to Redis channel: '${WS_PRICE_UPDATE_CHANNEL}'`);
  } catch (error) {
    console.error('Failed to start the server:', error);
    process.exit(1);
  }
};

const cleanup = async () => {
  console.log('\n Closing down...');

  try {
    await subscriber.unsubscribe(WS_PRICE_UPDATE_CHANNEL);
    await subscriber.quit();
    if (client.isOpen) {
      await client.quit();
    }
    console.log('Redis connection closed.');
  } catch (err) {
    console.error('Error during Redis cleanup:', err);
  }

  wss.close((err) => {
    if (err) {
      console.error('Error closing WebSocket server:', err);
    }

    server.close((serverError) => {
      if (serverError) {
        console.error('Error closing HTTP server:', serverError);
      }
      console.log('WebSocket server closed.');
      process.exit(0);
    });
  });
};

server.listen(PORT);

if (RUN_POOLER) {
  console.log('RUN_POOLER=true, starting embedded pooler');
  void startPooler().catch((error) => {
    console.error('Embedded pooler failed to start:', error);
    process.exit(1);
  });
}

main();
