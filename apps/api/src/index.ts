import './load-env';
import express from 'express';
import cors from 'cors';
import mainRouter from './routes/index';
import cookieParser from 'cookie-parser';
import { httpPusher } from '@exness-v3/redis/streams';
import { env } from './env';

const app = express();

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

app.listen(env.PORT, () => {
  console.log(`API server started on port ${env.PORT}`);
});
