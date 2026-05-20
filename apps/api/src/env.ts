import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  CORS_ORIGINS: z.string().optional(),
});

export const env = envSchema.parse(process.env);
