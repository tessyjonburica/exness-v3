import { enginePusher } from '@exness-v3/redis/streams';

let enginePusherConnectionPromise: Promise<void> | null = null;

async function ensureEnginePusherConnected() {
  if (enginePusher.isOpen) {
    return;
  }

  if (!enginePusherConnectionPromise) {
    enginePusherConnectionPromise = enginePusher
      .connect()
      .then(() => undefined)
      .finally(() => {
        enginePusherConnectionPromise = null;
      });
  }

  await enginePusherConnectionPromise;
}

export const ACKNOWLEDGEMENT_STREAM = 'stream:engine:acknowledgement';

export async function sendAcknowledgement(
  requestId: string,
  type: string,
  payload: Record<string, any> = {}
) {
  try {
    await ensureEnginePusherConnected();

    const message = {
      payload: JSON.stringify({
        ...payload,
      }),
      type,
      requestId,
    };

    await enginePusher.xAdd(ACKNOWLEDGEMENT_STREAM, '*', message);
  } catch (err) {
    console.error(
      `[Acknowledgement Error] Failed to send ACK for request ID ${requestId}:`,
      err
    );
  }
}
