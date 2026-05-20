import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { Client } from 'pg';

const cwd = process.cwd();
const envPath = path.join(cwd, '.env');
const prismaMigrationsDir = path.join(cwd, 'packages', 'db', 'prisma', 'migrations');

if (!fs.existsSync(envPath)) {
  console.error('Missing .env file. Copy .env.example to .env first.');
  process.exit(1);
}

const envFile = fs.readFileSync(envPath, 'utf8');
for (const line of envFile.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;

  const separatorIndex = trimmed.indexOf('=');
  if (separatorIndex === -1) continue;

  const key = trimmed.slice(0, separatorIndex).trim();
  const value = trimmed.slice(separatorIndex + 1).trim();

  if (!process.env[key]) {
    process.env[key] = value;
  }
}

const requiredVars = [
  'DATABASE_URL',
  'REDIS_URL',
  'PORT',
  'WS_PORT',
  'JWT_SECRET',
  'VITE_API_URL',
  'VITE_WS_URL',
];

const missingVars = requiredVars.filter((name) => !process.env[name]);
const invalidVars = [];

if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 16) {
  invalidVars.push('JWT_SECRET must be at least 16 characters long');
}

function parsePort(value, fallbackPort) {
  if (!value) return fallbackPort;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackPort;
}

function getTcpTarget(rawUrl, fallbackProtocol, fallbackPort) {
  const normalizedUrl = rawUrl.includes('://') ? rawUrl : `${fallbackProtocol}://${rawUrl}`;
  const parsed = new URL(normalizedUrl);
  return {
    host: parsed.hostname || '127.0.0.1',
    port: parsePort(parsed.port, fallbackPort),
  };
}

async function canConnect({ host, port }) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });

    const finish = (success) => {
      socket.destroy();
      resolve(success);
    };

    socket.setTimeout(2000);
    socket.on('connect', () => finish(true));
    socket.on('timeout', () => finish(false));
    socket.on('error', () => finish(false));
  });
}

const checks = [];

if (process.env.DATABASE_URL) {
  checks.push({
    label: 'Postgres',
    target: getTcpTarget(process.env.DATABASE_URL, 'postgresql', 5432),
  });
}

if (process.env.REDIS_URL) {
  checks.push({
    label: 'Redis',
    target: getTcpTarget(process.env.REDIS_URL, 'redis', 6379),
  });
}

if (missingVars.length > 0) {
  console.error(`Missing required env vars: ${missingVars.join(', ')}`);
}

for (const message of invalidVars) {
  console.error(`FAIL ${message}`);
}

let failedChecks = missingVars.length + invalidVars.length;

for (const check of checks) {
  const ok = await canConnect(check.target);
  if (ok) {
    console.log(`OK ${check.label} reachable at ${check.target.host}:${check.target.port}`);
  } else {
    console.error(`FAIL ${check.label} unreachable at ${check.target.host}:${check.target.port}`);
    failedChecks += 1;
  }
}

if (process.env.DATABASE_URL) {
  const pgClient = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await pgClient.connect();

    const requiredTables = ['User', 'ExistingTrade'];
    const requiredTableResult = await pgClient.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `, [requiredTables]);

    const existingTables = new Set(requiredTableResult.rows.map((row) => row.table_name));
    const missingTables = requiredTables.filter((tableName) => !existingTables.has(tableName));
    if (missingTables.length > 0) {
      console.error(
        `FAIL Missing required Postgres tables: ${missingTables.join(', ')}`
      );
      failedChecks += 1;
    }

    const balanceColumnResult = await pgClient.query(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'User'
        AND column_name = 'balance'
      LIMIT 1
    `);

    const balanceDataType = balanceColumnResult.rows[0]?.data_type;
    if (balanceDataType && balanceDataType !== 'double precision') {
      console.error(
        `FAIL Schema drift detected: public.\"User\".\"balance\" is ${balanceDataType}, expected double precision. Apply packages/db/prisma/migrations/20260515190000_balance_precision/migration.sql.`
      );
      failedChecks += 1;
    }

    const migrationTableResult = await pgClient.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = '_prisma_migrations'
      ) AS exists
    `);

    if (!migrationTableResult.rows[0]?.exists) {
      console.error(
        'FAIL Prisma migration baseline missing: public."_prisma_migrations" does not exist. Future prisma migrate deploy runs will fail until the database is baselined.'
      );
      failedChecks += 1;
    } else if (fs.existsSync(prismaMigrationsDir)) {
      const migrationDirs = fs
        .readdirSync(prismaMigrationsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();

      const appliedResult = await pgClient.query(`
        SELECT migration_name
        FROM public."_prisma_migrations"
        WHERE rolled_back_at IS NULL
      `);

      const appliedMigrations = appliedResult.rows
        .map((row) => row.migration_name)
        .sort();

      const missingAppliedMigrations = migrationDirs.filter(
        (migrationName) => !appliedMigrations.includes(migrationName)
      );

      if (missingAppliedMigrations.length > 0) {
        console.error(
          `FAIL Prisma migration baseline incomplete: missing applied migration records for ${missingAppliedMigrations.join(', ')}`
        );
        failedChecks += 1;
      }
    }
  } catch (error) {
    console.error(`FAIL Postgres schema check failed: ${error instanceof Error ? error.message : String(error)}`);
    failedChecks += 1;
  } finally {
    await pgClient.end().catch(() => {});
  }
}

if (failedChecks > 0) {
  process.exit(1);
}

console.log('Environment looks ready for the core stack.');
