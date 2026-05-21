import { publisher } from '@exness-v3/redis/pubsub';
import { PriceUpdatePusher } from '@exness-v3/redis/streams';
import { LATEST_PRICES_KEY, WS_PRICE_UPDATE_CHANNEL } from '../../../packages/redis/src/channels.ts';

interface Trade {
  A: string;
  B: string;
  E: number;
  T: number;
  a: string;
  b: string;
  e: string;
  s: string;
  u: number;
}

const ENABLE_DEV_QUOTES = process.env.ENABLE_DEV_QUOTES === 'true';
const BACKPACK_WS_URL = process.env.BACKPACK_WS_URL || 'wss://ws.backpack.exchange/';

let poolerStartPromise: Promise<void> | null = null;
let assets: Record<string, { buyPrice: number; sellPrice: number; decimal: number }> = {};
let redisConnected = false;
let firstUpstreamQuoteLogged = false;
let firstPublishedQuoteLogged = false;

function getIntAndDecimal(price: string): [number, number] | [undefined, undefined] {
  const arr = price.split('.');

  if (!arr[1]) {
    return [undefined, undefined];
  }

  const decimal = arr[1].length;
  const integer = Number(arr.join(''));

  return [decimal, integer];
}

function createUpstreamSocket() {
  const ws = new WebSocket(BACKPACK_WS_URL);

  const message = {
    method: 'SUBSCRIBE',
    params: ['bookTicker.BTC_USDC', 'bookTicker.ETH_USDC', 'bookTicker.SOL_USDC'],
    id: 1,
  };

  ws.onopen = () => {
    console.log('Connected to Backpack market data feed');
    ws.send(JSON.stringify(message));
  };

  ws.onmessage = (event) => {
    const parsedMessage = JSON.parse(event.data as string) as { data?: Trade };
    const trade = parsedMessage.data;

    if (!trade?.s || !trade?.a || !trade?.b) {
      return;
    }

    const [askDecimal, askInteger] = getIntAndDecimal(trade.a);
    const [bidDecimal, bidInteger] = getIntAndDecimal(trade.b);

    if (
      askInteger === undefined ||
      askDecimal === undefined ||
      bidInteger === undefined ||
      bidDecimal === undefined
    ) {
      return;
    }

    if (!firstUpstreamQuoteLogged) {
      console.log(`Received first upstream quote for ${trade.s}`);
      firstUpstreamQuoteLogged = true;
    }

    assets[trade.s] = {
      buyPrice: askInteger,
      sellPrice: bidInteger,
      decimal: Math.max(askDecimal, bidDecimal),
    };
  };

  ws.onclose = () => {
    console.log('Backpack market data socket closed. Attempting reconnect in 5 seconds...');
    setTimeout(() => {
      console.log('Restarting pooler process for a clean reconnect...');
      process.exit(1);
    }, 5000);
  };

  ws.onerror = () => {
    console.error('Backpack market data socket emitted an error event');
  };
}

function updateDevQuotes() {
  const now = Date.now();
  const heartbeat = Math.floor(now / 1000);
  const bases = {
    BTC_USDC: 78000,
    ETH_USDC: 2200,
    SOL_USDC: 86,
  } as const;

  for (const [symbol, base] of Object.entries(bases)) {
    const oscillation = Math.sin(heartbeat / 5 + base / 1000) * (base * 0.0015);
    const mid = base + oscillation;
    const ask = mid + base * 0.0002;
    const bid = mid - base * 0.0002;

    assets[symbol] = {
      buyPrice: Math.round(ask * 100),
      sellPrice: Math.round(bid * 100),
      decimal: 2,
    };
  }

  if (!firstUpstreamQuoteLogged) {
    console.log('Development quote generator enabled; publishing local fallback quotes');
    firstUpstreamQuoteLogged = true;
  }
}

async function runPooler() {
  console.log('Connecting to Redis...');
  await publisher.connect();
  await PriceUpdatePusher.connect();
  console.log('Connected to Redis');
  redisConnected = true;

  if (ENABLE_DEV_QUOTES) {
    updateDevQuotes();
    setInterval(updateDevQuotes, 250);
  } else {
    createUpstreamSocket();
  }

  setInterval(() => {
    if (!redisConnected || Object.keys(assets).length === 0) {
      return;
    }

    const data = {
      data: JSON.stringify(assets),
      type: 'PRICE_UPDATE',
    };

    void publisher.publish(WS_PRICE_UPDATE_CHANNEL, JSON.stringify(data));
    void PriceUpdatePusher.set(LATEST_PRICES_KEY, JSON.stringify(assets));
    void PriceUpdatePusher.xAdd('stream:engine', '*', data);

    if (!firstPublishedQuoteLogged) {
      console.log(`Published first quote snapshot to Redis channel '${WS_PRICE_UPDATE_CHANNEL}'`);
      firstPublishedQuoteLogged = true;
    }
  }, 250);
}

export function startPooler() {
  if (poolerStartPromise) {
    console.log('Pooler already started in this process');
    return poolerStartPromise;
  }

  poolerStartPromise = runPooler().catch((error) => {
    poolerStartPromise = null;
    throw error;
  });

  return poolerStartPromise;
}
