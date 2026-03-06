# 백업 및 복구 런북 v1

> **버전**: 1.0.0 | **작성일**: 2026-03-05 | **검토 주기**: 분기 1회

---

## 1. 목표 (RTO / RPO)

| 지표 | 목표값 | 설명 |
|---|---|---|
| **RPO** (Recovery Point Objective) | **≤ 1시간** | 최대 1시간 데이터 손실 허용 |
| **RTO** (Recovery Time Objective) | **≤ 2시간** | 장애 발생 후 2시간 내 서비스 복구 |
| **백업 주기** | 1시간 (WAL 연속) + 1일 (Full) | WAL 아카이빙 + 일별 전체 백업 |
| **백업 보관** | 7일 일별 + 4주 주별 | 최소 보관 기간 (미지정 → 운영 정책 확정 필요) |

---

## 2. 백업 아키텍처

```
PostgreSQL (Primary)
  │
  ├─ WAL Archiving ──→ Object Storage (S3/GCS)
  │   (연속 아카이빙, RPO ≤ 1h)
  │
  └─ pg_dump (Full) ──→ Object Storage
      (일 1회 새벽 3시 KST)
```

### 2.1 WAL 아카이빙 설정 (`postgresql.conf`)

```conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /mnt/wal-archive/%f && aws s3 cp /mnt/wal-archive/%f s3://BUCKET/wal/%f'
archive_timeout = 3600   # 최대 1시간마다 강제 아카이빙
```

### 2.2 일별 전체 백업 스크립트

```bash
#!/bin/bash
# /scripts/backup-daily.sh
# 크론: 0 18 * * * (UTC 18:00 = KST 03:00)

set -e

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_full_${DATE}.sql.gz"
S3_BUCKET="s3://japanese-learn-backups/daily"

# 1) pg_dump
pg_dump \
  --host="${DB_HOST}" \
  --port="${DB_PORT:-5432}" \
  --username="${DB_USER}" \
  --dbname="${DB_NAME}" \
  --format=custom \
  --compress=9 \
  --file="/tmp/${BACKUP_FILE}"

# 2) S3 업로드
aws s3 cp "/tmp/${BACKUP_FILE}" "${S3_BUCKET}/${BACKUP_FILE}"

# 3) 로컬 임시 파일 삭제
rm "/tmp/${BACKUP_FILE}"

# 4) 7일 이상 된 백업 삭제
aws s3 ls "${S3_BUCKET}/" | awk '{print $4}' | while read -r file; do
  file_date=$(echo "$file" | grep -oP '\d{8}')
  if [ "$(date -d "${file_date}" +%s)" -lt "$(date -d '7 days ago' +%s)" ]; then
    aws s3 rm "${S3_BUCKET}/${file}"
  fi
done

echo "[backup] 완료: ${BACKUP_FILE}"
```

---

## 3. 복구 절차

### 3.1 장애 분류

| 장애 유형 | 예시 | 복구 방법 |
|---|---|---|
| 데이터 부분 손상 | 단일 테이블 손상 | PITR (특정 시점 복구) |
| DB 전체 손실 | 디스크 장애 | Full 백업 + WAL 재적용 |
| 앱 배포 실수 | 마이그레이션 오류 | 마이그레이션 롤백 |
| 이벤트 로그 손실 | review_log 삭제 | append-only 설계로 불가 (삭제 차단) |

### 3.2 복구 절차 A: PITR (특정 시점 복구)

```bash
# 목표: 2026-03-05 09:30:00 KST (00:30:00 UTC)로 복구

# 1) 새 DB 인스턴스 준비
pg_basebackup -h "${DB_HOST}" -U replicator -D /var/lib/pgsql/recovery

# 2) recovery.conf 작성
cat > /var/lib/pgsql/recovery/recovery.conf << EOF
restore_command = 'aws s3 cp s3://BUCKET/wal/%f %p'
recovery_target_time = '2026-03-05 00:30:00 UTC'
recovery_target_action = 'promote'
EOF

# 3) WAL 복원 실행
pg_ctl start -D /var/lib/pgsql/recovery

# 4) 복구 완료 확인
psql -h localhost -U "${DB_USER}" -c "SELECT NOW();"

# 5) 애플리케이션 DB 연결 전환
```

### 3.3 복구 절차 B: Full 백업에서 복구

```bash
# 1) 최신 Full 백업 다운로드
aws s3 ls s3://japanese-learn-backups/daily/ --recursive | sort | tail -1
aws s3 cp "s3://japanese-learn-backups/daily/backup_full_YYYYMMDD_HHMMSS.sql.gz" /tmp/

# 2) 새 DB에 복원
pg_restore \
  --host="${DB_HOST}" \
  --username="${DB_USER}" \
  --dbname="${DB_NAME}" \
  --clean \
  --if-exists \
  "/tmp/backup_full_YYYYMMDD_HHMMSS.sql.gz"

# 3) WAL 재적용 (Full 백업 이후 변경사항)
# recovery.conf에 restore_command 설정 후 pg_ctl start

# 4) 마이그레이션 상태 확인
psql -c "SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 5;"
```

### 3.4 복구 절차 C: 마이그레이션 롤백

```bash
# 롤백 원칙:
# - 각 마이그레이션 파일은 UP / DOWN 쌍으로 관리한다.
# - review_log는 append-only로 DELETE/TRUNCATE 차단 (행 레벨 보안 또는 트리거)

# 예: migration 006 롤백
psql -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" << EOF
BEGIN;
DROP TABLE IF EXISTS experiment_definitions;
DROP TABLE IF EXISTS experiments;
DROP TABLE IF EXISTS notification_prefs;
COMMIT;
EOF
```

---

## 4. 모니터링 및 알림

### 4.1 필수 모니터링 항목

| 항목 | 임계값 | 알림 방법 |
|---|---|---|
| 백업 성공 여부 | 일 1회 확인 | 슬랙/이메일 |
| WAL 아카이빙 지연 | > 2시간 | PagerDuty |
| DB 디스크 사용량 | > 80% | PagerDuty |
| review_log 이벤트 드롭율 | > 0.1% | 알림 |
| 동기화 실패율 | > 5% | 알림 |

### 4.2 백업 상태 확인 스크립트

```bash
#!/bin/bash
# /scripts/backup-health-check.sh

# 최신 백업 파일 날짜 확인
LATEST=$(aws s3 ls s3://japanese-learn-backups/daily/ | sort | tail -1 | awk '{print $1}')
TODAY=$(date +%Y-%m-%d)

if [ "$LATEST" != "$TODAY" ]; then
  echo "ERROR: 오늘 백업 없음. 최신: ${LATEST}"
  exit 1
fi

echo "OK: 백업 정상 (${LATEST})"
```

---

## 5. 복구 리허설 (드릴) 체크리스트

> **빈도**: 분기 1회 | **담당**: 백엔드 엔지니어

### 드릴 절차

- [ ] 스테이징 환경에 최신 Full 백업 복원
- [ ] WAL 재적용으로 특정 시점(RPO 기준) 복구 검증
- [ ] 복구 완료 후 API 헬스체크 (`GET /health`)
- [ ] review_log 레코드 수 비교 (원본 vs 복구본)
- [ ] 마이그레이션 버전 일치 확인
- [ ] RTO 측정 및 기록 (목표 ≤ 2시간)
- [ ] 드릴 결과 문서화 (날짜, 소요 시간, 이슈)

### 드릴 결과 기록 템플릿

```
날짜: YYYY-MM-DD
담당자:
복구 시나리오: [ ] PITR  [ ] Full 백업  [ ] 마이그레이션 롤백
복구 시작: HH:MM
복구 완료: HH:MM
실제 RTO: XX분
RPO 만족: [ ] 예  [ ] 아니오 (실제 손실: XX분)
발견된 이슈:
개선 사항:
```

---

## 6. 데이터 삭제 정책 (개인정보 보호)

> GDPR Art.5, PIPA, APPI 준거 원칙 (rules/report.mdc)

| 데이터 | 보관 기간 | 삭제 방법 |
|---|---|---|
| review_log (원천 이벤트) | **미지정** (운영 정책 확정 필요) | 사용자 요청 시 pseudo anonymize 또는 삭제 |
| user_daily_agg (집계) | 집계 생성 후 90일 | 배치 자동 삭제 |
| diagnosis_results | 계정 삭제 시 연쇄 삭제 | ON DELETE CASCADE |
| oauth_accounts | 계정 연결 해제 시 삭제 | 수동 또는 API |
| push_token | 앱 삭제 또는 옵트아웃 시 | 알림 설정 OFF 시 NULL 처리 |

### 사용자 데이터 삭제 API (미구현 → Phase 2)

```
DELETE /v1/user/me  — 계정 및 모든 데이터 삭제
GET    /v1/user/export  — 데이터 내보내기 (GDPR 이식권)
```

---

## 7. 비상 연락처 (미지정 — 운영팀 확정 필요)

| 역할 | 담당자 | 연락처 |
|---|---|---|
| DB 관리자 | 미지정 | 미지정 |
| 인프라 담당 | 미지정 | 미지정 |
| 보안 담당 | 미지정 | 미지정 |
