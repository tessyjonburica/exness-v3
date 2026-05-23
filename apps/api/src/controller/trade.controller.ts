import type { Request, Response } from 'express';
import { RedisSubscriber } from '../services/redis.service';
import { closeOrderSchema, openOrderSchema } from '../validations/orderSchema';
import { randomUUID } from 'crypto';
import dbClient from '@exness-v3/db';
import { httpPusher } from '@exness-v3/redis/streams';
import { ensureUserInEngine } from '../services/engine.service';

export const CREATE_ORDER_QUEUE = 'stream:engine';

const redisSubscriber = RedisSubscriber.getInstance();

type CreateOrderPayload = {
  asset: string;
  leverage: number;
  quantity: number;
  slippage: number;
  side: string;
  stopLoss?: number;
  takeProfit?: number;
  tradeOpeningPrice: number;
};

async function dispatchCreateOrder(
  email: string,
  payload: CreateOrderPayload
): Promise<{ tradeDetails: unknown; balance?: number }> {
  const requestId = randomUUID();
  const tradePayload = {
    id: randomUUID(),
    asset: payload.asset,
    quantity: payload.quantity,
    side: payload.side,
    leverage: payload.leverage,
    slippage: payload.slippage,
    tradeOpeningPrice: payload.tradeOpeningPrice,
    ...(typeof payload.stopLoss === 'number' ? { stopLoss: payload.stopLoss } : {}),
    ...(typeof payload.takeProfit === 'number' ? { takeProfit: payload.takeProfit } : {}),
  };

  const enginePayload = {
    type: 'CREATE_ORDER',
    requestId,
    data: JSON.stringify({
      email,
      trade: tradePayload,
    }),
  };

  const openPending = redisSubscriber.waitForMessage<{ tradeDetails: unknown; balance?: number }>(requestId);
  try {
    await httpPusher.xAdd(CREATE_ORDER_QUEUE, '*', enginePayload);
  } catch (e) {
    redisSubscriber.cancelWait(requestId);
    throw e;
  }

  return await openPending;
}

function persistBalanceInBackground(userId: string, balance: number | undefined) {
  if (typeof balance !== 'number') {
    return;
  }

  void dbClient.user
    .update({
      where: { id: userId },
      data: { balance },
    })
    .catch((error) => {
      console.error('[createOrder] Failed to persist balance in background:', {
        userId,
        balance,
        error: error instanceof Error ? error.message : String(error),
      });
    });
}

export async function createOrder(req: Request, res: Response) {
  const { success, data, error } = openOrderSchema.safeParse(req.body);

  if (!success) {
    res.status(400).json({
      success: false,
      message: null,
      error: error.flatten().fieldErrors 
    })
    return;
  }

  const { asset, leverage, quantity, slippage, side, stopLoss, takeProfit, tradeOpeningPrice } = data;
  try {
    const user = await dbClient.user.findFirst({
      where: { email: req.user as string },
      select: {
        id: true,
        email: true,
        password: true,
        balance: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: null,
        error: 'USER_NOT_FOUND',
      });
      return;
    }

    const createOrderPayload: CreateOrderPayload = {
      asset,
      quantity,
      side,
      leverage,
      slippage,
      tradeOpeningPrice,
      ...(typeof stopLoss === 'number' ? { stopLoss } : {}),
      ...(typeof takeProfit === 'number' ? { takeProfit } : {}),
    };

    let tradeDetails: unknown;
    let balance: number | undefined;

    try {
      ({ tradeDetails, balance } = await dispatchCreateOrder(req.user as string, createOrderPayload));
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'reason' in err && (err as { reason?: string }).reason === 'User not found') {
        await ensureUserInEngine(user);
        ({ tradeDetails, balance } = await dispatchCreateOrder(req.user as string, createOrderPayload));
      } else {
        throw err;
      }
    }

    persistBalanceInBackground(user.id, balance);

    res.status(201).json({
      success: true,
      message: 'ORDER_PLACED',
      error: null,
      trade: tradeDetails,
      ...(typeof balance === 'number' ? { balance } : {}),
    })

  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'reason' in err) {
      const body = err as { reason?: string; detail?: string; marginRequired?: number; availableBalance?: number };
      const reason = body.reason ?? 'ORDER_REJECTED';

      let status = 422;
      if (reason === 'User not found') {
        status = 404;
      } else if (reason === 'PRICE_UNAVAILABLE') {
        status = 503;
      } else if (reason === 'SLIPPAGE_EXCEEDED') {
        status = 422;
      }

      res.status(status).json({
        success: false,
        message: reason,
        error: reason,
        detail: body.detail,
        marginRequired: body.marginRequired,
        availableBalance: body.availableBalance,
      });
      return;
    }

    const message = err instanceof Error ? err.message : String(err);
    console.error('[createOrder]', message, err);

    res.status(500).json({
      success: false,
      message: null,
      error: 'INTERNAL_SERVER_ERROR',
      detail: message,
    })
    return;
  }
}

export async function closeOrder(req: Request, res: Response) {
  const { success, data } = closeOrderSchema.safeParse(req.body);

  if (!success) {
    res.status(400).json({
      success: false, 
      message: null,
      error: 'ORDER_DETAILS_MISSING',
    })
    return;
  }

  const { orderId } = data;

  const requestId = randomUUID();

  const payload = {
    type: 'CLOSE_ORDER',
    requestId: requestId,
    data: JSON.stringify({
      email: req.user,
      orderId: orderId,
    }),
  };

  const closePending = redisSubscriber.waitForMessage<{ status: string; reason?: string; balance?: number }>(requestId);
  try {
    await httpPusher.xAdd(CREATE_ORDER_QUEUE, '*', payload);
  } catch (e) {
    redisSubscriber.cancelWait(requestId);
    
    console.error('[closeOrder] Failed to push to engine stream:', e);
    res.status(500).json({
      success: false,
      message: null,
      error: 'INTERNAL_SERVER_ERROR',
    });
    return;
  }

  try {
    const { balance } = await closePending;

    return res.status(201).json({
      success: true,
      message: 'ORDER_CLOSED_SUCCESSFULLY',
      error: null,
      ...(typeof balance === 'number' ? { balance } : {}),
    });

  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'reason' in err) {
      const body = err as { reason?: string; detail?: string };
      console.warn('[closeOrder] Engine rejected:', body.reason, body.detail ?? '');
      res.status(422).json({
        success: false,
        message: body.reason ?? 'CLOSE_REJECTED',
        error: body.reason ?? 'CLOSE_REJECTED',
        detail: body.detail,
      });
      return;
    }

    const msg = err instanceof Error ? err.message : String(err);
    console.error('[closeOrder]', msg, err);

    res.status(500).json({
      success: false,
      message: null,
      error: 'INTERNAL_SERVER_ERROR',
      detail: msg,
    });
    return;
  }
}

export async function fetchCloseOrders(req: Request, res: Response) {
  try {
    const email = req.user;

    const user = await dbClient.user.findFirst({
      where: { email: email as string },
    });

    if (!user) {
      res.status(404).json({ 
        success: false,
        message: null,
        error: "USER_NOT_FOUND"
      })
      return;
    }

    const orders = await dbClient.existingTrade.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.status(200).json({
      success: true,
      message: 'CLOSED_ORDERS_FETCHED',
      orders,
      error: null,
    });

  } catch (err) {
    console.error('[fetchCloseOrders]', err);
    res.status(500).json({ 
      success: false,
      message: null,
      error: "INTERNAL_SERVER_ERROR"
    })
    return;
  }
}

export async function fetchOpenOrders(req: Request, res: Response) {
  try {
    const email = req.user;

    const requestId = randomUUID();

    const payload = {
      type: 'FETCH_OPEN_ORDERS',
      requestId: requestId,
      data: JSON.stringify({
        email: email,
      }),
    };

    const openOrdersPending = redisSubscriber.waitForMessage<{ orders: unknown }>(requestId);
    try {
      await httpPusher.xAdd(CREATE_ORDER_QUEUE, '*', payload);
    } catch (e) {
      redisSubscriber.cancelWait(requestId);
      throw e;
    }

    const { orders } = await openOrdersPending;

    return res.status(200).json({
      success: true, 
      message: 'OPEN_ORDERS_FETCHED',
      orders,
      error: null,
    });

  } catch (err) {
    console.error('[fetchOpenOrders]', err);
    res.status(500).json({
      success: false,
      message: null,
      error: 'INTERNAL_SERVER_ERROR'
    })
    return;
  }
}

export async function fetchCandlesticks(req: Request, res: Response) {
  try {
    const { symbol, timeframe, limit } = req.query;

    if (!symbol || !timeframe) {
      res.status(400).json({
        success: false,
        message: null,
        error: 'SYMBOL_AND_TIMEFRAME_REQUIRED' 
      })
      return;
    }

    const requestId = randomUUID();

    const payload = {
      type: 'FETCH_CANDLESTICKS',
      requestId: requestId,
      data: JSON.stringify({
        symbol: symbol as string,
        timeframe: timeframe as string,
        limit:
          typeof limit === 'string' && Number.isFinite(Number(limit))
            ? Number(limit)
            : undefined,
      }),
    };

    const candlesPending = redisSubscriber.waitForMessage<{ candlesticks: unknown }>(requestId);
    try {
      await httpPusher.xAdd(CREATE_ORDER_QUEUE, '*', payload);
    } catch (e) {
      redisSubscriber.cancelWait(requestId);
      throw e;
    }

    const { candlesticks } = await candlesPending;

    res.status(200).json({ 
      success: true,
      candlesticks,
      message: candlesticks,
      error: null,
    });

  } catch (err) {
    console.error('Error fetching candlesticks:', err);
    res.status(500).json({
      success: false,
      message: null,
      error: 'INTERNAL_SERVER_ERROR'
    })
    return;
  }
}
