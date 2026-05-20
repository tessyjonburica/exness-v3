import { randomUUID } from "crypto";
import { RedisSubscriber } from "./redis.service" ;
import { httpPusher } from "@exness-v3/redis/streams";

const redisSub = RedisSubscriber.getInstance();

type EngineUser = {
    id: string;
    email: string;
    password: string;
    balance: number;
};

export async function createUserInEngine(user: EngineUser) {
    const requestId = randomUUID();
    
    const payload = {
        type: 'USER_CREATED',
        requestId,
        data: JSON.stringify({
            email: user.email,
            password: user.password,
            id: user.id,
            balance: user.balance,
        }),
    };

    const pending = redisSub.waitForMessage(requestId);
    try {
      await httpPusher.xAdd('stream:engine', '*', payload);
    } catch (e) {
      redisSub.cancelWait(requestId);
      throw e;
    }

    return await pending;
}

export async function ensureUserInEngine(user: EngineUser) {
    try {
      return await createUserInEngine(user);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'reason' in error &&
        (error as { reason?: string }).reason === 'User already exists'
      ) {
        return { status: 'already_exists' };
      }

      throw error;
    }
}

export async function getUserBalanceFromEngine(email: string, password: string) {

    const requestId = randomUUID();

    const payload = {
        type: 'GET_USER_BALANCE',
        requestId,
        data: JSON.stringify({
            email: email,
            password: password,
        }),
    };  

    const balancePending = redisSub.waitForMessage<{ balance: number }>(requestId);
    try {
      await httpPusher.xAdd('stream:engine', '*', payload);
    } catch (e) {
      redisSub.cancelWait(requestId);
      throw e;
    }

    const res = await balancePending;

    return res.balance;
}

export async function updateUserBalanceInEngine(email: string, balance: number) {
    const requestId = randomUUID();

    const payload = {
        type: 'UPDATE_USER_BALANCE',
        requestId,
        data: JSON.stringify({
            email,
            balance,
        }),
    };

    const updatePending = redisSub.waitForMessage<{ balance: number }>(requestId);
    try {
      await httpPusher.xAdd('stream:engine', '*', payload);
    } catch (e) {
      redisSub.cancelWait(requestId);
      throw e;
    }

    return await updatePending;
}
