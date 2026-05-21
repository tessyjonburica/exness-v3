import prisma, { normalizeDate, normalizeFiniteNumber, summarizeForLog } from '@exness-v3/db';
import { enginePuller } from '@exness-v3/redis/streams';
import { prices, users } from '../../memoryDb';
import { calculatePnl, closeOrder, roundToCents } from '../utils/liquidation.utils';
import { sendAcknowledgement } from '../utils/send-ack';
import { env } from '../utils/env';
import {
  buildCandlesticksFromTicks,
  getCandlesticks,
  processPriceTickForCandles,
  replaceCandlesticks,
} from '../utils/candlestick.utils';
import type { CandleTimeframe } from '../utils/candlestick.utils';

import type { PriceStore, Trade } from '../types';
import type {
  CloseOrderPayload,
  FetchOpenOrdersPayload,
  OpenTradePayload,
  FetchCandlesticksPayload,
} from '../types/handler.type';

const LATEST_PRICES_KEY = 'prices:latest';
const ENGINE_STREAM_KEY = 'stream:engine';
const PRICE_HISTORY_SCAN_COUNT = 30000;
const MINIMUM_HISTORY_CANDLES = 100;
const MAX_UPSTREAM_CANDLE_LIMIT = 1000;
const emptyCandlesLogged = new Set<string>();
const upstreamCandlesLogged = new Set<string>();
const MAX_HISTORY_GAP_MULTIPLIER = 2;

function buildClosedTradePersistencePayload(input: {
  userId: string;
  asset: string;
  openPrice: number;
  closePrice: number;
  leverage: number;
  pnl: number;
  liquidated: boolean;
  createdAt: Date;
  slippage: number;
  side: string;
  reason: string;
  quantity: number;
}) {
  return {
    userId: input.userId,
    asset: input.asset,
    openPrice: normalizeFiniteNumber('ExistingTrade.openPrice', input.openPrice),
    closePrice: normalizeFiniteNumber('ExistingTrade.closePrice', input.closePrice),
    leverage: normalizeFiniteNumber('ExistingTrade.leverage', input.leverage),
    pnl: normalizeFiniteNumber('ExistingTrade.pnl', input.pnl),
    liquidated: input.liquidated,
    createdAt: normalizeDate('ExistingTrade.createdAt', input.createdAt),
    slippage: normalizeFiniteNumber('ExistingTrade.slippage', input.slippage),
    side: input.side,
    reason: input.reason,
    quantity: normalizeFiniteNumber('ExistingTrade.quantity', input.quantity),
  };
}

function buildTradePnlTransactionPayload(input: {
  userId: string;
  asset: string;
  pnl: number;
  side: string;
  reason: string;
  reference: string;
}) {
  return {
    userId: input.userId,
    type: 'TRADE_PNL' as const,
    status: 'COMPLETED' as const,
    amount: normalizeFiniteNumber('Transaction.amount', input.pnl),
    currency: 'USD',
    reference: input.reference,
    description: `${input.asset.replace('_', '/')} ${input.side} position closed (${input.reason}).`,
    method: 'Trading ledger',
    provider: 'Internal Matching Engine',
    accountLabel: 'Primary trading account',
    metadata: {
      asset: input.asset,
      side: input.side,
      reason: input.reason,
    },
  };
}

async function hydrateLatestPrices(): Promise<void> {
  try {
    const latestPrices = await enginePuller.get(LATEST_PRICES_KEY);

    if (!latestPrices) {
      return;
    }

    const parsedPrices = JSON.parse(latestPrices) as PriceStore;
    Object.assign(prices, parsedPrices);
  } catch (error) {
    console.error('[ENGINE] Failed to hydrate latest prices from Redis:', error);
  }
}

function extractStreamTimestamp(streamId: string): number | null {
  const [rawTimestamp] = streamId.split('-');
  const parsed = Number(rawTimestamp);
  return Number.isFinite(parsed) ? parsed : null;
}

type StreamPriceSnapshot = Record<string, { buyPrice: number; sellPrice: number; decimal: number }>;
type BackpackKline = {
  start: string;
  open: string;
  high: string;
  low: string;
  close: string;
};

function getMidPrice(priceData: { buyPrice: number; sellPrice: number; decimal: number }): number {
  return (priceData.buyPrice + priceData.sellPrice) / (2 * Math.pow(10, priceData.decimal));
}

function parseBackpackCandleTime(start: string): number | null {
  const timestamp = Date.parse(start.replace(' ', 'T') + 'Z');
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return Math.floor(timestamp / 1000);
}

function getTimeframeSeconds(timeframe: CandleTimeframe): number {
  return {
    '1m': 60,
    '5m': 5 * 60,
    '30m': 30 * 60,
    '1h': 60 * 60,
    '6h': 6 * 60 * 60,
    '1d': 24 * 60 * 60,
    '3d': 3 * 24 * 60 * 60,
  }[timeframe];
}

function hasDiscontinuousCandles(candles: Array<{ time: number }>, timeframe: CandleTimeframe): boolean {
  if (candles.length < 2) {
    return false;
  }

  const timeframeSeconds = getTimeframeSeconds(timeframe);
  const maxGap = timeframeSeconds * MAX_HISTORY_GAP_MULTIPLIER;

  for (let index = 1; index < candles.length; index += 1) {
    const previous = candles[index - 1];
    const current = candles[index];

    if (!previous || !current) {
      continue;
    }

    if (current.time - previous.time > maxGap) {
      return true;
    }
  }

  return false;
}

async function fetchCandlesFromBackpack(
  symbol: string,
  timeframe: CandleTimeframe,
  limit: number
): Promise<number> {
  const safeLimit = Math.min(Math.max(limit, MINIMUM_HISTORY_CANDLES), MAX_UPSTREAM_CANDLE_LIMIT);
  const timeframeMs = {
    '1m': 60_000,
    '5m': 5 * 60_000,
    '30m': 30 * 60_000,
    '1h': 60 * 60_000,
    '6h': 6 * 60 * 60_000,
    '1d': 24 * 60 * 60_000,
    '3d': 3 * 24 * 60 * 60_000,
  }[timeframe];

  const endTime = Math.floor(Date.now() / 1000);
  const startTime = endTime - Math.ceil((safeLimit + 5) * (timeframeMs / 1000));
  const params = new URLSearchParams({
    symbol,
    interval: timeframe,
    startTime: String(startTime),
    endTime: String(endTime),
  });

  const response = await fetch(`${env.BACKPACK_KLINES_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Backpack klines request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as BackpackKline[];
  if (!Array.isArray(payload) || payload.length === 0) {
    return 0;
  }

  const candles = payload
    .map((entry) => {
      const time = parseBackpackCandleTime(entry.start);
      const open = Number(entry.open);
      const high = Number(entry.high);
      const low = Number(entry.low);
      const close = Number(entry.close);

      if (
        time === null ||
        !Number.isFinite(open) ||
        !Number.isFinite(high) ||
        !Number.isFinite(low) ||
        !Number.isFinite(close)
      ) {
        return null;
      }

      return { time, open, high, low, close };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .slice(-safeLimit);

  if (candles.length === 0) {
    return 0;
  }

  replaceCandlesticks(symbol, timeframe, candles);
  return candles.length;
}

async function rebuildCandlesFromStreamHistory(
  symbol: string,
  timeframe: CandleTimeframe
): Promise<number> {
  const entries = (await enginePuller.xRevRange(
    ENGINE_STREAM_KEY,
    '+',
    '-',
    { COUNT: PRICE_HISTORY_SCAN_COUNT }
  )) as Array<{ id: string; message: Record<string, string> }>;

  const ticks: Array<{ price: number; timestamp: number }> = [];

  for (const entry of [...entries].reverse()) {
    if (entry.message.type !== 'PRICE_UPDATE' || typeof entry.message.data !== 'string') {
      continue;
    }

    const entryTimestamp = extractStreamTimestamp(entry.id);
    if (entryTimestamp === null) {
      continue;
    }

    try {
      const parsed = JSON.parse(entry.message.data) as
        | StreamPriceSnapshot
        | { data?: string };

      const snapshots =
        parsed && typeof parsed === 'object' && 'data' in parsed && typeof parsed.data === 'string'
          ? (JSON.parse(parsed.data) as StreamPriceSnapshot)
          : (parsed as StreamPriceSnapshot);
      const symbolSnapshot = snapshots[symbol];
      if (!symbolSnapshot) {
        continue;
      }

      ticks.push({
        price: getMidPrice(symbolSnapshot),
        timestamp: entryTimestamp,
      });
    } catch {
      continue;
    }
  }

  if (ticks.length === 0) {
    return 0;
  }

  buildCandlesticksFromTicks(symbol, timeframe, ticks);
  return getCandlesticks(symbol, timeframe).length;
}

export async function handlePriceUpdateEntry(payload: PriceStore) {

  // update in memory price
  Object.assign(prices, payload);

  // Update candlesticks for all symbols in the price update
  const currentTime = Date.now();
  Object.entries(payload).forEach(([symbol, priceData]) => {
    // Use mid price for candlesticks (average of buy and sell)
    const midPrice = (priceData.buyPrice + priceData.sellPrice) / (2 * Math.pow(10, priceData.decimal));
    processPriceTickForCandles(symbol, midPrice, currentTime);
  });

  for (const user of Object.values(users)) {
    for (const order of [...user.trades]) {
      const currentPrices = prices[order.asset];
      if (!currentPrices?.buyPrice || !currentPrices?.sellPrice) {
        continue;
      }

      const { id, side, stopLoss, takeProfit, margin } = order;
      let pnlToRealize: number | null = null;
      let closeReason: string | null = null;

      const relevantPrice =
        side === 'LONG'
          ? currentPrices.sellPrice / 10 ** currentPrices.decimal
          : currentPrices.buyPrice / 10 ** currentPrices.decimal;
      if (side === 'LONG') {
        if (stopLoss && relevantPrice <= stopLoss) {
          pnlToRealize = calculatePnl(order, stopLoss);
          closeReason = 'Stop Loss';
        } else if (takeProfit && relevantPrice >= takeProfit) {
          pnlToRealize = calculatePnl(order, takeProfit);
          closeReason = 'Take Profit';
        }
      } else {
        // SHORT
        if (stopLoss && relevantPrice >= stopLoss) {
          pnlToRealize = calculatePnl(order, stopLoss);
          closeReason = 'Stop Loss';
        } else if (takeProfit && relevantPrice <= takeProfit) {
          pnlToRealize = calculatePnl(order, takeProfit);
          closeReason = 'Take Profit';
        }
      }

      if (!closeReason) {
        const unrealizedPnl = calculatePnl(order, relevantPrice);
        if (margin && unrealizedPnl < 0 && Math.abs(unrealizedPnl) >= margin) {
          pnlToRealize = unrealizedPnl;
          closeReason = 'Liquidation';
        }
      }

      if (closeReason && pnlToRealize !== null) {
        await closeOrder(user, id, pnlToRealize, closeReason, currentPrices);
      }
    }
  }
}

export async function handleOpenTrade(
  payload: OpenTradePayload,
  requestId: string
) {
  try {
    const { email, trade } = payload;

    const user = users[email];

    if (!user) {
      console.log(`Attempted to open trade for non-existent user: ${email}`);
      await sendAcknowledgement(requestId, 'TRADE_OPEN_FAILED', {
        reason: 'User not found',
      });
      return;
    }
    const {
      asset,
      leverage,
      side,
      quantity,
      id,
      stopLoss,
      takeProfit,
      slippage,
      tradeOpeningPrice,
    } = trade;

    const currentPrice = prices[asset];
    if (!currentPrice) {
      await hydrateLatestPrices();
    }

    const hydratedPrice = prices[asset];
    if (!hydratedPrice) {
      console.log(`Price not available for asset: ${asset}`);
      await sendAcknowledgement(requestId, 'TRADE_OPEN_FAILED', {
        reason: 'PRICE_UNAVAILABLE',
        detail: `Price for asset ${asset} is not available.`,
      });
      return;
    }

    const openPrice =
      side === 'LONG'
        ? hydratedPrice.buyPrice / 10 ** hydratedPrice.decimal
        : hydratedPrice.sellPrice / 10 ** hydratedPrice.decimal;

    const slippedFraction = Math.abs(
      (tradeOpeningPrice - openPrice) / openPrice
    );
    const maxSlippageFraction = slippage / 100;

    if (maxSlippageFraction > 0 && slippedFraction > maxSlippageFraction) {
      await sendAcknowledgement(requestId, 'TRADE_SLIPPAGE_MAX_EXCEEDED', {
        reason: 'SLIPPAGE_EXCEEDED',
        detail: `Requested price ${tradeOpeningPrice} deviates from market price ${openPrice} by ${(slippedFraction * 100).toFixed(2)}%, above allowed ${slippage.toFixed(2)}%.`,
      });
      return;
    }
    if (!leverage || leverage <= 0) {
      await sendAcknowledgement(requestId, 'TRADE_OPEN_FAILED', {
        reason: 'Invalid leverage',
      });
      return;
    }
    const marginRequired = roundToCents((quantity * openPrice) / leverage);

    if (user.balance.amount < marginRequired) {
      await sendAcknowledgement(requestId, 'TRADE_OPEN_FAILED', {
        reason: 'Insufficient balance',
        marginRequired: marginRequired,
        availableBalance: user.balance.amount,
      });
      return;
    }

    user.balance.amount = roundToCents(user.balance.amount - marginRequired);
    const newTrade: Trade = {
      id,
      asset,
      leverage,
      side,
      quantity,
      margin: marginRequired,
      status: 'OPEN',
      openPrice,
      createdAt: new Date(),
      tradeOpeningPrice,
      slippage: slippage / 100,
      ...(stopLoss !== undefined ? { stopLoss } : {}),
      ...(takeProfit !== undefined ? { takeProfit } : {}),
    };

    user.trades.push(newTrade);

    await sendAcknowledgement(requestId, 'TRADE_OPEN_ACKNOWLEDGEMENT', {
      status: 'success',
      tradeDetails: newTrade,
    });
  } catch (err) {
    console.error('Error in handleOpenTrade:', err);
    await sendAcknowledgement(requestId, 'TRADE_OPEN_ERROR', { message: err });
  }
}

// Handles close trade in engine
export async function handleCloseTrade(
  payload: CloseOrderPayload,
  requestId: string
) {
  try {
    const { email, orderId } = payload;
    const user = users[email];

    if (!user) {
      console.log(`Attempted to close trade for non-existent user: ${email}`);

      await sendAcknowledgement(requestId, 'TRADE_CLOSE_FAILED', {
        reason: 'User not found',
      });
      return;
    }
    const tradeToClose = user.trades.find(
      (trade: any) => trade.id === orderId && trade.status === 'OPEN'
    );

    if (!tradeToClose) {
      await sendAcknowledgement(requestId, 'TRADE_CLOSE_FAILED', {
        reason: 'Open trade not found',
      });
      return;
    }

    const { asset, side, openPrice, quantity, margin, leverage, slippage } =
      tradeToClose;

    const currentPrice = prices[asset];
    if (!currentPrice) {
      await sendAcknowledgement(requestId, 'TRADE_CLOSE_FAILED', {
        reason: `Cannot close trade, price for asset ${asset} is not available.`,
      });
      return;
    }

    const closePrice =
      side === 'LONG'
        ? currentPrice.sellPrice / 10 ** currentPrice.decimal
        : currentPrice.buyPrice / 10 ** currentPrice.decimal;

    const pnl = calculatePnl(tradeToClose, closePrice);

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!dbUser) {
      console.error('[handleCloseTrade] No DB user for email:', user.email);
      await sendAcknowledgement(requestId, 'TRADE_CLOSE_FAILED', {
        reason: 'User not found in database',
      });
      return;
    }

    const newBalance = normalizeFiniteNumber(
      'User.balance',
      roundToCents(user.balance.amount + margin + pnl)
    );

    const closedTradePayload = buildClosedTradePersistencePayload({
      userId: dbUser.id,
      asset,
      openPrice,
      closePrice,
      leverage,
      pnl,
      liquidated: false,
      createdAt: new Date(),
      slippage,
      side,
      reason: 'Closed by user',
      quantity,
    });
    const tradePnlTransactionPayload = buildTradePnlTransactionPayload({
      userId: dbUser.id,
      asset,
      pnl,
      side,
      reason: 'Closed by user',
      reference: `PNL-${orderId}`,
    });

    console.debug('[handleCloseTrade] Persisting close payload:', summarizeForLog({
      userId: dbUser.id,
      email: user.email,
      newBalance,
      closedTradePayload,
      tradePnlTransactionPayload,
    }));

    try {
      await prisma.$transaction([
        prisma.existingTrade.create({
          data: closedTradePayload,
        }),
        prisma.transaction.create({
          data: tradePnlTransactionPayload,
        }),
        prisma.user.update({
          where: { id: dbUser.id },
          data: { balance: newBalance },
        }),
      ]);
    } catch (dbErr: unknown) {
      const message = dbErr instanceof Error ? dbErr.message : String(dbErr);
      console.error('[handleCloseTrade] DB persist failed:', summarizeForLog({
        message,
        userId: dbUser.id,
        email: user.email,
        newBalance,
        closedTradePayload,
        tradePnlTransactionPayload,
      }));
      await sendAcknowledgement(requestId, 'TRADE_CLOSE_FAILED', {
        reason: 'Failed to persist closed trade',
        detail: message,
      });
      return;
    }

    user.balance.amount = newBalance;

    tradeToClose.status = 'CLOSED';
    tradeToClose.closePrice = closePrice;
    tradeToClose.pnl = pnl;
    tradeToClose.closedAt = new Date();
    user.trades = user.trades.filter((trade: any) => trade.id !== orderId);

    console.log(`Successfully closed trade ${orderId}. PnL: ${pnl}`);
    console.log('User balance after close:', user.balance.amount);

    await sendAcknowledgement(requestId, 'TRADE_CLOSE_ACKNOWLEDGEMENT', {
      status: 'success',
    });
  } catch (err) {
    console.error('Error in closing trade:', err);
    await sendAcknowledgement(requestId, 'TRADE_CLOSE_ERROR', {
      message: err,
    });
  }
}

export async function handleFetchOpenOrders(
  payload: FetchOpenOrdersPayload,
  requestId: string
) {
  try {
    const { email } = payload;
    const user = users[email];
    if (!user) {
      console.log(
        `Attempted to fetch open trades for non-existent user: ${email}`
      );
      await sendAcknowledgement(requestId, 'TRADE_FETCH_FAILED', {
        reason: 'User not found',
      });
      return;
    }

    const orders = user.trades.filter((trade: any) => trade.status === 'OPEN');
    await sendAcknowledgement(requestId, 'TRADE_FETCH_ACKNOWLEDGEMENT', {
      status: 'success',
      orders: orders,
    });
  } catch (err) {
    console.error('Error in handleFetchOpenOrders:', err);
    await sendAcknowledgement(requestId, 'SOMETHING_WENT_WRONG', {
      message: err,
    });
  }
}

export async function handleFetchCandlesticks(
  payload: FetchCandlesticksPayload,
  requestId: string
) {
  try {
    const { symbol, timeframe, limit } = payload;
    const normalizedLimit =
      typeof limit === 'number' && Number.isFinite(limit) && limit > 0
        ? Math.min(Math.floor(limit), MAX_UPSTREAM_CANDLE_LIMIT)
        : undefined;

    // Convert frontend symbol format to backend format
    const backendSymbol = symbol.replace('USDT', '_USDC');
    const normalizedTimeframe = timeframe as CandleTimeframe;

    let candlesticks = getCandlesticks(backendSymbol, normalizedTimeframe);
    if (candlesticks.length === 0) {
      const rebuiltCount = await rebuildCandlesFromStreamHistory(backendSymbol, normalizedTimeframe);
      candlesticks = getCandlesticks(backendSymbol, normalizedTimeframe);

      const logKey = `${backendSymbol}:${normalizedTimeframe}`;
      if (candlesticks.length === 0) {
        if (!emptyCandlesLogged.has(logKey)) {
          console.warn(
            `[candlesticks] No historical candles available for ${backendSymbol} ${normalizedTimeframe} after scanning stream history.`
          );
          emptyCandlesLogged.add(logKey);
        }
      } else {
        emptyCandlesLogged.delete(logKey);
        console.log(
          `[candlesticks] Rebuilt ${rebuiltCount} candles for ${backendSymbol} ${normalizedTimeframe} from Redis stream history.`
        );
      }
    }

    const historyTarget = Math.max(normalizedLimit ?? MINIMUM_HISTORY_CANDLES, MINIMUM_HISTORY_CANDLES);
    if (
      candlesticks.length < historyTarget ||
      hasDiscontinuousCandles(candlesticks.slice(-historyTarget), normalizedTimeframe)
    ) {
      try {
        const fetchedCount = await fetchCandlesFromBackpack(
          backendSymbol,
          normalizedTimeframe,
          historyTarget
        );
        candlesticks = getCandlesticks(backendSymbol, normalizedTimeframe);

        const logKey = `${backendSymbol}:${normalizedTimeframe}`;
        if (fetchedCount > 0 && !upstreamCandlesLogged.has(logKey)) {
          console.log(
            `[candlesticks] Seeded ${fetchedCount} candles for ${backendSymbol} ${normalizedTimeframe} from Backpack klines.`
          );
          upstreamCandlesLogged.add(logKey);
        }
      } catch (error) {
        const logKey = `${backendSymbol}:${normalizedTimeframe}`;
        if (!emptyCandlesLogged.has(`${logKey}:upstream`)) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(
            `[candlesticks] Backpack klines unavailable for ${backendSymbol} ${normalizedTimeframe}: ${message}`
          );
          emptyCandlesLogged.add(`${logKey}:upstream`);
        }
      }
    }

    if (normalizedLimit) {
      candlesticks = candlesticks.slice(-normalizedLimit);
    }

    await sendAcknowledgement(requestId, 'CANDLESTICK_FETCH_ACKNOWLEDGEMENT', {
      status: 'success',
      candlesticks: candlesticks,
    });
  } catch (err) {
    await sendAcknowledgement(requestId, 'CANDLESTICK_FETCH_ERROR', {
      message: err,
    });
  }
}
