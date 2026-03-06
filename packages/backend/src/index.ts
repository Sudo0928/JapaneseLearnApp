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

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

// CORS 미들웨어 (패키지 없이 직접 구현 — 개발 환경 허용 출처 목록)
const ALLOWED_ORIGINS = [
  'http://localhost:8081',  // Expo Web
  'http://localhost:8082',
  'http://localhost:5173',  // Vite 대시보드
  'http://localhost:5174',
  'http://localhost:5200',
  'http://localhost:19006', // Expo Dev Tools
];

app.use((req, res, next) => {
  const origin = req.headers.origin ?? '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// 미들웨어
app.use(express.json({ limit: '2mb' }));

// 헬스체크
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// API 라우터
app.use('/v1/auth', authRouter);
app.use('/v1/events', eventsRouter);
app.use('/v1/today', todayRouter);
app.use('/v1/plan', planRouter);
app.use('/v1/diagnosis', diagnosisRouter);
app.use('/v1/report', reportRouter);
app.use('/v1/notifications', notificationsRouter);
app.use('/v1/experiments', experimentsRouter);

// 404 처리
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// 글로벌 에러 핸들러
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] 처리되지 않은 오류:', err);
  res.status(500).json({ error: '서버 내부 오류' });
});

async function start(): Promise<void> {
  await checkDbConnection();
  app.listen(PORT, () => {
    console.log(`[server] 서버 시작: http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('[server] 시작 실패:', err);
  process.exit(1);
});

export default app;
