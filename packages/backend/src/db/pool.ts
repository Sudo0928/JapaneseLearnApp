import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL 환경변수가 설정되지 않았습니다. .env.example을 참고하세요.');
}

/**
 * PostgreSQL 연결 풀
 * 앱 전체에서 단일 풀을 공유한다.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] 예기치 않은 오류 발생:', err);
});

export async function checkDbConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('[DB] 데이터베이스 연결 확인 완료');
  } finally {
    client.release();
  }
}
