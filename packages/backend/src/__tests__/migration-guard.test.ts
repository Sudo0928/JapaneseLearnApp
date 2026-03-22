import { mkdtempSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  ensureLatestMigrationApplied,
  getLatestSqlMigration,
  isStrictMigrationEnv,
} from '../services/migration-guard';

describe('migration-guard', () => {
  it('selects the latest numeric sql migration file', () => {
    expect(getLatestSqlMigration(['001_initial.sql', '015_shadow.sql', 'run.ts', 'abc.sql'])).toBe('015_shadow.sql');
  });

  it('treats staging and production as strict environments', () => {
    expect(isStrictMigrationEnv('production')).toBe(true);
    expect(isStrictMigrationEnv('staging')).toBe(true);
    expect(isStrictMigrationEnv('development')).toBe(false);
    expect(isStrictMigrationEnv('test')).toBe(false);
  });

  it('throws in strict environments when the latest migration is missing', async () => {
    const migrationsDir = mkdtempSync(join(tmpdir(), 'migration-guard-'));
    writeFileSync(join(migrationsDir, '014_alignment_v3.sql'), 'select 1;');
    writeFileSync(join(migrationsDir, '015_diagnosis_v4_shadow_gate.sql'), 'select 1;');

    const db = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };

    await expect(
      ensureLatestMigrationApplied(db, 'production', migrationsDir),
    ).rejects.toThrow('015_diagnosis_v4_shadow_gate.sql');
  });

  it('warns instead of throwing in non-strict environments', async () => {
    const migrationsDir = mkdtempSync(join(tmpdir(), 'migration-guard-'));
    writeFileSync(join(migrationsDir, '015_diagnosis_v4_shadow_gate.sql'), 'select 1;');

    const db = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      ensureLatestMigrationApplied(db, 'development', migrationsDir),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
