import type { AsksBids, Trade, User } from '../types';
import prisma, { normalizeDate, normalizeFiniteNumber, summarizeForLog } from '@exness-v3/db';
import { publishAccountUpdateInBackground } from './realtime';

export function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export type ClosedTradeState = {
  closedTrade: Trade;
  closePrice: number;
  roundedPnl: number;
  newBalance: number;
};

export function removeAndCloseTradeInMemory(
  user: User,
  orderId: string,
  realizedPnl: number,
  currentPrice: AsksBids
): ClosedTradeState | null {
  const tradeIndex = user.trades.findIndex((trade) => trade.id === orderId);
  if (tradeIndex === -1) {
    return null;
  }

  const [closedTrade] = user.trades.splice(tradeIndex, 1);
  if (!closedTrade) {
    throw new Error('Tried to close a trade that does not exist');
  }

  const closePrice =
    closedTrade.side === 'LONG'
      ? currentPrice.sellPrice / 10 ** currentPrice.decimal
      : currentPrice.buyPrice / 10 ** currentPrice.decimal;

  const roundedPnl = roundToCents(realizedPnl);
  const newBalance = normalizeFiniteNumber(
    'User.balance',
    roundToCents(user.balance.amount + (closedTrade.margin ?? 0) + roundedPnl)
  );

  user.balance.amount = newBalance;
  closedTrade.status = 'CLOSED';
  closedTrade.closePrice = closePrice;
  closedTrade.pnl = roundedPnl;
  closedTrade.closedAt = new Date();

  return {
    closedTrade,
    closePrice,
    roundedPnl,
    newBalance,
  };
}

async function persistClosedTradeResult(
  user: User,
  closure: ClosedTradeState,
  reason: string
) {
  const { closedTrade, closePrice, roundedPnl, newBalance } = closure;
  const { asset, side, openPrice, quantity, leverage, slippage } = closedTrade;

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
  });
  if (!dbUser) {
    throw new Error(`Liquidation: no DB user for ${user.email}`);
  }

  const closedTradePayload = {
    quantity: normalizeFiniteNumber('ExistingTrade.quantity', quantity),
    side,
    userId: dbUser.id,
    asset,
    openPrice: normalizeFiniteNumber('ExistingTrade.openPrice', openPrice),
    closePrice: normalizeFiniteNumber('ExistingTrade.closePrice', closePrice),
    leverage: normalizeFiniteNumber('ExistingTrade.leverage', leverage),
    pnl: normalizeFiniteNumber('ExistingTrade.pnl', roundedPnl),
    liquidated: reason === 'Liquidation',
    createdAt: normalizeDate('ExistingTrade.createdAt', new Date()),
    slippage: normalizeFiniteNumber('ExistingTrade.slippage', slippage),
    reason,
  };
  const tradePnlTransactionPayload = {
    userId: dbUser.id,
    type: 'TRADE_PNL' as const,
    status: 'COMPLETED' as const,
    amount: normalizeFiniteNumber('Transaction.amount', roundedPnl),
    currency: 'USD',
    reference: `PNL-${closedTrade.id}`,
    description: `${asset.replace('_', '/')} ${side} position closed (${reason}).`,
    method: 'Trading ledger',
    provider: 'Internal Matching Engine',
    accountLabel: 'Primary trading account',
    metadata: {
      asset,
      side,
      reason,
    },
  };

  console.debug('[liquidation.closeOrder] Persisting close payload:', summarizeForLog({
    userId: dbUser.id,
    email: user.email,
    newBalance,
    closedTradePayload,
    tradePnlTransactionPayload,
  }));

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
}

export function persistClosedTradeResultInBackground(
  user: User,
  closure: ClosedTradeState,
  reason: string
) {
  void persistClosedTradeResult(user, closure, reason).catch((dbErr: unknown) => {
    const message = dbErr instanceof Error ? dbErr.message : String(dbErr);
    console.error('[persistClosedTradeResultInBackground] Persist failed:', summarizeForLog({
      email: user.email,
      orderId: closure.closedTrade.id,
      reason,
      newBalance: closure.newBalance,
      message,
    }));
  });
}

export async function closeOrder(
  user: User,
  orderId: string,
  realizedPnl: number,
  reason: string,
  currentPrice: AsksBids
) {
  const closure = removeAndCloseTradeInMemory(user, orderId, realizedPnl, currentPrice);
  if (!closure) {
    return;
  }

  persistClosedTradeResultInBackground(user, closure, reason);
  publishAccountUpdateInBackground(user, reason === 'Liquidation' ? 'trade_liquidated' : 'trade_closed');
}

export function calculatePnl(order: Trade, closePrice: number): number {
  const { side, openPrice, quantity } = order;
  if (side === 'LONG') {
    return roundToCents((closePrice - openPrice) * quantity);
  } else {
    return roundToCents((openPrice - closePrice) * quantity);
  }
}
