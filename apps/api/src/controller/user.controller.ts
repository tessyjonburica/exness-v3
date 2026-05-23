import type { Request, Response } from 'express';
import { getUserBalanceFromEngine } from '../services/engine.service';
import dbClient from '@exness-v3/db';

function syncBalanceFromEngineInBackground(user: {
  email: string;
  password: string;
  balance: number;
}) {
  void getUserBalanceFromEngine(user.email, user.password)
    .then(async (engineBalance) => {
      const normalizedBalance = Number(engineBalance) || 0;
      if (normalizedBalance === Number(user.balance)) {
        return;
      }

      await dbClient.user.update({
        where: { email: user.email },
        data: { balance: normalizedBalance },
      });
    })
    .catch((engineErr) => {
      console.log('[BALANCE] Background engine sync failed:', engineErr);
    });
}

export async function getUserBalance(req: Request, res: Response) {
  try {
    const email = req.user;

    if (!email) {
      res.status(401).json({
        success: false,
        message: null,
        error: 'UNAUTHORIZED_EMAIL',
      });
      return;
    }

    const user = await dbClient.user.findFirst({
      where: {
        email: email as string,
      },
      select: {
        balance: true,
        email: true,
        password: true,
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

    syncBalanceFromEngineInBackground(user);

    return res.status(200).json({
      success: true,
      message: 'BALANCE_FETCHED',
      balance: Number(user.balance) || 0,
      error: null,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: null,
      error: 'INTERNAL_SERVER_ERROR',
    });
    return;
  }
}
