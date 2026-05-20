function readRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  BACKPACK_KLINES_URL:
    process.env.BACKPACK_KLINES_URL || 'https://api.backpack.exchange/api/v1/klines',
};
