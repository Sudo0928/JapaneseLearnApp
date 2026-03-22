import { readdirSync } from 'fs';
import { join } from 'path';
import type { Pool, PoolClient } from 'pg';
import { pool } from '../db/pool';

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

export interface MigrationGuardResult {
  latestFilename: string | null;
  applied: boolean;
  reason: 'ok' | 'missing_migration' | 'missing_table' | 'no_sql_files';
}

export function getLatestSqlMigration(files: string[]): string | null {
  const sqlFiles = files
    .filter((file) => /^\d+.*\.sql$/i.test(file))
    .sort((a, b) => a.localeCompare(b));

  return sqlFiles.at(-1) ?? null;
}

export function isStrictMigrationEnv(nodeEnv = process.env.NODE_ENV ?? 'development'): boolean {
  return nodeEnv === 'production' || nodeEnv === 'staging';
}

export async function getMigrationGuardStatus(
  db: Queryable = pool,
  migrationsDir = join(__dirname, '..', '..', 'migrations'),
): Promise<MigrationGuardResult> {
  const latestFilename = getLatestSqlMigration(readdirSync(migrationsDir));
  if (!latestFilename) {
    return { latestFilename: null, applied: true, reason: 'no_sql_files' };
  }

  try {
    const { rows } = await db.query<{ filename: string }>(
      `SELECT filename FROM migration_log WHERE filename = $1 LIMIT 1`,
      [latestFilename],
    );

    return {
      latestFilename,
      applied: rows.length > 0,
      reason: rows.length > 0 ? 'ok' : 'missing_migration',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('migration_log')) {
      return {
        latestFilename,
        applied: false,
        reason: 'missing_table',
      };
    }
    throw error;
  }
}

export async function ensureLatestMigrationApplied(
  db: Queryable = pool,
  nodeEnv = process.env.NODE_ENV ?? 'development',
  migrationsDir = join(__dirname, '..', '..', 'migrations'),
): Promise<void> {
  const status = await getMigrationGuardStatus(db, migrationsDir);
  if (status.applied || status.reason === 'no_sql_files') {
    return;
  }

  const message = status.reason === 'missing_table'
    ? `[migration-guard] migration_log table is missing; latest required migration is ${status.latestFilename}.`
    : `[migration-guard] latest migration ${status.latestFilename} has not been applied.`;

  if (isStrictMigrationEnv(nodeEnv)) {
    throw new Error(message);
  }

  console.warn(message);
}
