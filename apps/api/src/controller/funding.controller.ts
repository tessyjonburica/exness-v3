import dbClient, { normalizeFiniteNumber } from '@exness-v3/db';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { updateUserBalanceInEngine } from '../services/engine.service';
import { publishAccountUpdate } from '../services/realtime.service';
import { mockFundingSchema } from '../validations/fundingSchema';

function buildReference(prefix: string) {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function sanitizeText(value: string | undefined, fallback: string) {
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

async function getCurrentUser(email: string | undefined) {
  if (!email) {
    return null;
  }

  return dbClient.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      balance: true,
    },
  });
}

export async function fetchTransactions(req: Request, res: Response) {
  try {
    const user = await getCurrentUser(req.user);

    if (!user) {
      res.status(404).json({
        success: false,
        message: null,
        error: 'USER_NOT_FOUND',
      });
      return;
    }

    const transactions = await dbClient.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      message: 'TRANSACTIONS_FETCHED',
      transactions,
      error: null,
    });
  } catch (error) {
    console.error('[fetchTransactions]', error);
    res.status(500).json({
      success: false,
      message: null,
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
}

export async function createMockDeposit(req: Request, res: Response) {
  try {
    const parsed = mockFundingSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: null,
        error: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const user = await getCurrentUser(req.user);
    if (!user) {
      res.status(404).json({
        success: false,
        message: null,
        error: 'USER_NOT_FOUND',
      });
      return;
    }

    const amount = normalizeFiniteNumber('Transaction.amount', parsed.data.amount);
    const nextBalance = normalizeFiniteNumber('User.balance', user.balance + amount);
    const reference = buildReference('DEP');

    const result = await dbClient.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          type: 'DEPOSIT' as const,
          status: 'COMPLETED' as const,
          amount,
          currency: parsed.data.currency,
          reference,
          description: sanitizeText(
            parsed.data.description,
            'Sandbox funding credited to the trading account.'
          ),
          method: sanitizeText(parsed.data.method, 'Sandbox transfer'),
          provider: 'Internal Sandbox',
          accountLabel: sanitizeText(parsed.data.accountLabel, 'Primary trading account'),
          metadata: {
            mode: 'sandbox',
          },
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { balance: nextBalance },
      });

      return transaction;
    });

    await updateUserBalanceInEngine(user.email, nextBalance);
    void publishAccountUpdate({
      email: user.email,
      event: 'funding_updated',
      balance: nextBalance,
      transactionId: result.id,
    });

    res.status(201).json({
      success: true,
      message: 'MOCK_DEPOSIT_COMPLETED',
      balance: nextBalance,
      transaction: result,
      error: null,
    });
  } catch (error) {
    console.error('[createMockDeposit]', error);
    res.status(500).json({
      success: false,
      message: null,
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
}

export async function createMockWithdrawal(req: Request, res: Response) {
  try {
    const parsed = mockFundingSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: null,
        error: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const user = await getCurrentUser(req.user);
    if (!user) {
      res.status(404).json({
        success: false,
        message: null,
        error: 'USER_NOT_FOUND',
      });
      return;
    }

    const amount = normalizeFiniteNumber('Transaction.amount', parsed.data.amount);
    if (user.balance < amount) {
      res.status(422).json({
        success: false,
        message: 'INSUFFICIENT_AVAILABLE_FUNDS',
        error: 'INSUFFICIENT_AVAILABLE_FUNDS',
      });
      return;
    }

    const nextBalance = normalizeFiniteNumber('User.balance', user.balance - amount);
    const reference = buildReference('WDR');

    const result = await dbClient.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          type: 'WITHDRAWAL' as const,
          status: 'COMPLETED' as const,
          amount,
          currency: parsed.data.currency,
          reference,
          description: sanitizeText(
            parsed.data.description,
            'Sandbox withdrawal booked against the trading account.'
          ),
          method: sanitizeText(parsed.data.method, 'Sandbox transfer'),
          provider: 'Internal Sandbox',
          accountLabel: sanitizeText(parsed.data.accountLabel, 'Primary trading account'),
          metadata: {
            mode: 'sandbox',
          },
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { balance: nextBalance },
      });

      return transaction;
    });

    await updateUserBalanceInEngine(user.email, nextBalance);
    void publishAccountUpdate({
      email: user.email,
      event: 'funding_updated',
      balance: nextBalance,
      transactionId: result.id,
    });

    res.status(201).json({
      success: true,
      message: 'MOCK_WITHDRAWAL_COMPLETED',
      balance: nextBalance,
      transaction: result,
      error: null,
    });
  } catch (error) {
    console.error('[createMockWithdrawal]', error);
    res.status(500).json({
      success: false,
      message: null,
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
}
