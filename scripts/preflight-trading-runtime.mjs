import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const cwd = process.cwd();
const envPath = path.join(cwd, ".env");
const redisRequire = createRequire(path.join(cwd, "packages", "redis", "package.json"));
const { createClient } = redisRequire("redis");
const REQUIRED_SYMBOLS = ["BTC_USDC", "ETH_USDC", "SOL_USDC"];
const PRICE_UPDATE_CHANNEL = "ws:price:update";
const LATEST_PRICES_KEY = "prices:latest";
const DEFAULT_TIMEOUT_MS = 8000;

function logPass(message) {
  console.log(`PASS ${message}`);
}

function logInfo(message) {
  console.log(`INFO ${message}`);
}

function logFail(message) {
  console.error(`FAIL ${message}`);
}

function loadEnvFile() {
  if (!fs.existsSync(envPath)) {
    throw new Error("Missing .env file. Copy .env.example to .env first.");
  }

  const envFile = fs.readFileSync(envPath, "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function parsePort(rawValue, fallbackPort) {
  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackPort;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function validatePriceMap(priceMap) {
  if (!priceMap || typeof priceMap !== "object") {
    throw new Error("Quote payload is not an object.");
  }

  for (const symbol of REQUIRED_SYMBOLS) {
    const quote = priceMap[symbol];
    if (!quote || typeof quote !== "object") {
      throw new Error(`Quote payload missing symbol ${symbol}.`);
    }

    if (!isFiniteNumber(quote.buyPrice)) {
      throw new Error(`${symbol}.buyPrice is not a finite number.`);
    }

    if (!isFiniteNumber(quote.sellPrice)) {
      throw new Error(`${symbol}.sellPrice is not a finite number.`);
    }

    if (!isFiniteNumber(quote.decimal)) {
      throw new Error(`${symbol}.decimal is not a finite number.`);
    }
  }
}

function validateEnvelope(rawPayload) {
  const parsedPayload = JSON.parse(rawPayload);
  if (parsedPayload?.type !== "PRICE_UPDATE") {
    throw new Error("Payload does not include type === PRICE_UPDATE.");
  }

  const data = JSON.parse(String(parsedPayload.data));
  validatePriceMap(data);
  return data;
}

async function checkRedisPing(redisUrl) {
  const client = createClient({ url: redisUrl });

  try {
    await client.connect();
    const response = await client.ping();
    if (response !== "PONG") {
      throw new Error(`Unexpected Redis PING response: ${String(response)}`);
    }
  } finally {
    if (client.isOpen) {
      await client.quit();
    }
  }
}

async function checkLatestPrices(redisUrl) {
  const client = createClient({ url: redisUrl });

  try {
    await client.connect();
    const response = await client.get(LATEST_PRICES_KEY);
    if (!response) {
      throw new Error(`${LATEST_PRICES_KEY} does not exist or is empty.`);
    }

    const parsed = JSON.parse(response);
    validatePriceMap(parsed);
    return parsed;
  } finally {
    if (client.isOpen) {
      await client.quit();
    }
  }
}

async function checkPubSub(redisUrl) {
  const subscriber = createClient({ url: redisUrl });

  try {
    await subscriber.connect();
    await new Promise(async (resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        reject(new Error(`No ${PRICE_UPDATE_CHANNEL} message received within ${DEFAULT_TIMEOUT_MS}ms.`));
      }, DEFAULT_TIMEOUT_MS);

      try {
        await subscriber.subscribe(PRICE_UPDATE_CHANNEL, (message) => {
          if (settled) {
            return;
          }

          try {
            validateEnvelope(message);
            settled = true;
            clearTimeout(timeout);
            resolve(undefined);
          } catch (error) {
            settled = true;
            clearTimeout(timeout);
            reject(error);
          }
        });
      } catch (error) {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        reject(error);
      }
    });
  } finally {
    if (subscriber.isOpen) {
      await subscriber.quit();
    }
  }
}

async function checkApiHealth(port) {
  const response = await fetch(`http://localhost:${port}/health`);
  if (!response.ok) {
    throw new Error(`API /health returned HTTP ${response.status}.`);
  }
}

async function checkWebSocketPayload(wsUrl) {
  const socket = new WebSocket(wsUrl);

  const payload = await new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        socket.close();
        reject(new Error(`No WebSocket quote payload received from ${wsUrl} within ${DEFAULT_TIMEOUT_MS}ms.`));
      }
    }, DEFAULT_TIMEOUT_MS);

    socket.addEventListener(
      "open",
      () => {
        logPass(`WebSocket connected at ${wsUrl}`);
      },
      { once: true }
    );

    socket.addEventListener(
      "message",
      (event) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        socket.close();
        resolve(String(event.data));
      },
      { once: true }
    );

    socket.addEventListener(
      "error",
      () => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        reject(new Error(`WebSocket connection failed at ${wsUrl}.`));
      },
      { once: true }
    );
  });

  validateEnvelope(payload);
}

async function main() {
  loadEnvFile();

  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const wsUrl = process.env.VITE_WS_URL || `ws://localhost:${process.env.WS_PORT || "8080"}`;
  const apiPort = parsePort(process.env.PORT, 3000);

  logInfo(`Checking Redis at ${redisUrl}`);
  await checkRedisPing(redisUrl);
  logPass("Redis connection works");

  const latestPrices = await checkLatestPrices(redisUrl);
  logPass(`prices:latest contains ${REQUIRED_SYMBOLS.join(", ")}`);
  logInfo(
    `Latest BTC_USDC quote snapshot: buyPrice=${latestPrices.BTC_USDC.buyPrice} sellPrice=${latestPrices.BTC_USDC.sellPrice} decimal=${latestPrices.BTC_USDC.decimal}`
  );

  await checkPubSub(redisUrl);
  logPass(`${PRICE_UPDATE_CHANNEL} published a valid PRICE_UPDATE payload`);

  await checkWebSocketPayload(wsUrl);
  logPass("WebSocket client received a valid PRICE_UPDATE payload");

  if (process.env.PORT) {
    await checkApiHealth(apiPort);
    logPass(`API health check succeeded at http://localhost:${apiPort}/health`);
  } else {
    logInfo("Skipping API health check because PORT is not configured.");
  }

  console.log("Trading runtime preflight completed successfully.");
}

main().catch((error) => {
  logFail(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
