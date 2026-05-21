import './load-env';
import express from 'express';
import cors from 'cors';
import mainRouter from './routes/index';
import cookieParser from 'cookie-parser';
import { httpPusher } from '@exness-v3/redis/streams';
import { env } from './env';
import { startEngine } from '../../engine/src/start-engine';

const app = express();
const RUN_ENGINE = process.env.RUN_ENGINE === 'true';

const ALLOWED_ORIGINS = (env.CORS_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

await httpPusher.connect();

app.use(express.json());
app.use(cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  })
);

app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'api',
  });
});

app.use('/api/v1', mainRouter);

if (RUN_ENGINE) {
  console.log('RUN_ENGINE=true, starting embedded engine');
  void startEngine().catch((error) => {
    console.error('Embedded engine failed to start:', error);
    process.exit(1);
  });
}

app.listen(env.PORT, () => {
  console.log(`API server started on port ${env.PORT}`);
});
