import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL
  ?? (process.env.NODE_ENV === 'test' ? 'postgresql://localhost/japanese_learn_test' : null);

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required. See packages/backend/.env.');
}

export const pool = new Pool({
  connectionString: databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[db] unexpected error:', err);
});

export async function checkDbConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('[db] connection verified');
  } finally {
    client.release();
  }
}
