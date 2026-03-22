import express from 'express';
import dotenv from 'dotenv';
import { checkDbConnection } from './db/pool';
import eventsRouter from './routes/events';
import todayRouter from './routes/today';
import authRouter from './routes/auth';
import planRouter from './routes/plan';
import diagnosisRouter from './routes/diagnosis';
import reportRouter from './routes/report';
import notificationsRouter from './routes/notifications';
import experimentsRouter from './routes/experiments';
import userRouter from './routes/user';
import { ensureLatestMigrationApplied } from './services/migration-guard';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

const ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5200',
  'http://localhost:19006',
];

app.use((req, res, next) => {
  const origin = req.headers.origin ?? '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  }

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

app.use('/v1/auth', authRouter);
app.use('/v1/events', eventsRouter);
app.use('/v1/today', todayRouter);
app.use('/v1/plan', planRouter);
app.use('/v1/diagnosis', diagnosisRouter);
app.use('/v1/report', reportRouter);
app.use('/v1/notifications', notificationsRouter);
app.use('/v1/experiments', experimentsRouter);
app.use('/v1/user', userRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

async function start(): Promise<void> {
  await checkDbConnection();
  await ensureLatestMigrationApplied();
  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});

export default app;
