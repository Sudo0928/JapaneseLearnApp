"use strict";
/**
 * 마이그레이션 실행기
 * 실행: npm run migrate --workspace=packages/backend
 *
 * 전략: 순번 기반 SQL 파일 순차 실행 + migration_log 테이블로 이력 관리
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function runMigrations() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL 환경변수가 필요합니다.');
    }
    const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();
    try {
        // migration_log 테이블이 없으면 생성
        await client.query(`
      CREATE TABLE IF NOT EXISTS migration_log (
        id          SERIAL      PRIMARY KEY,
        filename    TEXT        UNIQUE NOT NULL,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
        // 이미 적용된 마이그레이션 목록 조회
        const { rows: applied } = await client.query('SELECT filename FROM migration_log ORDER BY id');
        const appliedSet = new Set(applied.map((r) => r.filename));
        // 마이그레이션 파일 목록 (순번 오름차순)
        const migrationsDir = (0, path_1.join)(__dirname, '.');
        const files = (0, fs_1.readdirSync)(migrationsDir)
            .filter((f) => f.endsWith('.sql'))
            .sort();
        let ran = 0;
        for (const file of files) {
            if (appliedSet.has(file)) {
                console.log(`[migrate] 건너뜀 (이미 적용): ${file}`);
                continue;
            }
            console.log(`[migrate] 적용 중: ${file}`);
            const sql = (0, fs_1.readFileSync)((0, path_1.join)(migrationsDir, file), 'utf-8');
            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query('INSERT INTO migration_log (filename) VALUES ($1)', [file]);
                await client.query('COMMIT');
                console.log(`[migrate] 완료: ${file}`);
                ran++;
            }
            catch (err) {
                await client.query('ROLLBACK');
                throw new Error(`마이그레이션 실패 (${file}): ${err}`);
            }
        }
        if (ran === 0) {
            console.log('[migrate] 적용할 새 마이그레이션이 없습니다.');
        }
        else {
            console.log(`[migrate] 총 ${ran}개 마이그레이션 적용 완료.`);
        }
    }
    finally {
        client.release();
        await pool.end();
    }
}
runMigrations().catch((err) => {
    console.error('[migrate] 오류:', err);
    process.exit(1);
});
//# sourceMappingURL=run.js.map