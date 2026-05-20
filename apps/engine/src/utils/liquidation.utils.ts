import type { AsksBids, Trade, User } from '../types';
import prisma, { normalizeDate, normalizeFiniteNumber, summarizeForLog } from '@exness-v3/db';

export function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function closeOrder(
  user: User,
  orderId: string,
  realizedPnl: number,
  reason: string,
  currentPrice: AsksBids
) {
  const tradeIndex = user.trades.findIndex((trade) => trade.id === orderId);
  if (tradeIndex === -1) {
    return;
  }

  const [closedTrade] = user.trades.splice(tradeIndex, 1);
  if (!closedTrade) {
    throw new Error('Tried to close a trade that does not exist');
  }
  const { asset, side, openPrice, quantity, margin, leverage, slippage } = closedTrade;

  const closePrice =
    side === 'LONG'
      ? currentPrice.sellPrice / 10 ** currentPrice.decimal
      : currentPrice.buyPrice / 10 ** currentPrice.decimal;

  const roundedPnl = roundToCents(realizedPnl);
  const newBalance = normalizeFiniteNumber(
    'User.balance',
    roundToCents(user.balance.amount + margin + roundedPnl)
  );

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
    reference: `PNL-${orderId}`,
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
    console.error('[liquidation.closeOrder] DB persist failed:', summarizeForLog({
      message,
      userId: dbUser.id,
      email: user.email,
      newBalance,
      closedTradePayload,
      tradePnlTransactionPayload,
    }));
    throw dbErr;
  }

  user.balance.amount = newBalance;
  closedTrade.status = 'CLOSED';
  closedTrade.closePrice = closePrice;
  closedTrade.pnl = roundedPnl;
  closedTrade.closedAt = new Date();
}

export function calculatePnl(order: Trade, closePrice: number): number {
  const { side, openPrice, quantity } = order;
  if (side === 'LONG') {
    return roundToCents((closePrice - openPrice) * quantity);
  } else {
    return roundToCents((openPrice - closePrice) * quantity);
  }
}
