/**
 * 마이그레이션 실행 스크립트 (Node.js CJS)
 * 사용법: node scripts/run-migration.js <migration-file>
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('사용법: node scripts/run-migration.js <migration-file>');
  process.exit(1);
}

const sqlPath = path.resolve(__dirname, '..', migrationFile);
const sql = fs.readFileSync(sqlPath, 'utf8');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(sql)
  .then(() => {
    console.log('✅ 마이그레이션 완료:', migrationFile);
    return pool.end();
  })
  .catch((err) => {
    console.error('❌ 마이그레이션 실패:', err.message);
    return pool.end().finally(() => process.exit(1));
  });
