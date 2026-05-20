import { PrismaClient } from '@prisma/client';
export {
  normalizeDate,
  normalizeFiniteNumber,
  summarizeForLog,
} from './src/persistence';

const client = new PrismaClient();

export default client;
