export interface Candlestick {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

type TimeframeMs = {
  '1m': number;
  '5m': number;
  '30m': number;
  '1h': number;
  '6h': number;
  '1d': number;
  '3d': number;
};

export type CandleTimeframe = keyof TimeframeMs;

const TIMEFRAME_MS: TimeframeMs = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
};

export const candleStore: Record<string, Record<string, Candlestick[]>> = {};

function isValidCandle(candle: Candlestick): boolean {
  return (
    Number.isFinite(candle.time) &&
    candle.time > 0 &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close)
  );
}

function normalizeCandles(candles: Candlestick[]): Candlestick[] {
  const deduped = new Map<number, Candlestick>();

  for (const candle of candles) {
    if (!isValidCandle(candle)) {
      continue;
    }

    const existing = deduped.get(candle.time);
    if (!existing) {
      deduped.set(candle.time, { ...candle });
      continue;
    }

    deduped.set(candle.time, {
      time: candle.time,
      open: existing.open,
      high: Math.max(existing.high, candle.high),
      low: Math.min(existing.low, candle.low),
      close: candle.close,
    });
  }

  return [...deduped.values()].sort((left, right) => left.time - right.time);
}

function getCandleTime(timestamp: number, intervalMs: number): number {
  return Math.floor(timestamp / intervalMs) * intervalMs;
}

function updateCandleForTimeframe(
  symbol: string,
  timeframe: CandleTimeframe,
  price: number,
  timestamp: number
) {
  const intervalMs = TIMEFRAME_MS[timeframe];
  const candleTime = getCandleTime(timestamp, intervalMs);
  const candleTimeSec = Math.floor(candleTime / 1000);

  if (!candleStore[symbol]) {
    candleStore[symbol] = {};
  }

  if (!candleStore[symbol][timeframe]) {
    candleStore[symbol][timeframe] = [];
  }

  const candles = candleStore[symbol][timeframe];
  const lastCandle = candles[candles.length - 1];

  if (!lastCandle || lastCandle.time < candleTimeSec) {
    const newCandle: Candlestick = {
      time: candleTimeSec,
      open: price,
      high: price,
      low: price,
      close: price,
    };
    candles.push(newCandle);

    if (candles.length > 1000) {
      candles.shift();
    }
  } else if (lastCandle.time === candleTimeSec) {
    lastCandle.high = Math.max(lastCandle.high, price);
    lastCandle.low = Math.min(lastCandle.low, price);
    lastCandle.close = price;
  }
}

export function updateCandlesticks(symbol: string, price: number, timestamp: number) {
  const timeframes: CandleTimeframe[] = ['1m', '5m', '30m', '1h', '6h', '1d', '3d'];

  timeframes.forEach((timeframe) => {
    updateCandleForTimeframe(symbol, timeframe, price, timestamp);
  });
}

export function replaceCandlesticks(
  symbol: string,
  timeframe: CandleTimeframe,
  candles: Candlestick[]
) {
  if (!candleStore[symbol]) {
    candleStore[symbol] = {};
  }

  candleStore[symbol][timeframe] = normalizeCandles(candles).slice(-1000);
}

export function buildCandlesticksFromTicks(
  symbol: string,
  timeframe: CandleTimeframe,
  ticks: Array<{ price: number; timestamp: number }>
) {
  replaceCandlesticks(symbol, timeframe, []);

  ticks
    .sort((left, right) => left.timestamp - right.timestamp)
    .forEach((tick) => {
      updateCandleForTimeframe(symbol, timeframe, tick.price, tick.timestamp);
    });
}

export function getTimeframeMs(timeframe: CandleTimeframe): number {
  return TIMEFRAME_MS[timeframe];
}

export function getCandlesticks(symbol: string, timeframe: CandleTimeframe): Candlestick[] {
  if (!candleStore[symbol] || !candleStore[symbol][timeframe]) {
    return [];
  }

  return candleStore[symbol][timeframe];
}

export function clearCandlesticks(symbol: string, timeframe: CandleTimeframe) {
  if (candleStore[symbol] && candleStore[symbol][timeframe]) {
    candleStore[symbol][timeframe] = [];
  }
}

// Process price tick and update all timeframes
export function processPriceTickForCandles(symbol: string, price: number, timestamp: number) {
  updateCandlesticks(symbol, price, timestamp);
}
