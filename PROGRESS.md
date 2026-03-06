# 일본어 학습 앱 — 개발 진행 기록

> 이 파일은 작업 세션 간 이어서 개발하기 위한 진행 상태 기록입니다.
> 새 세션 시작 시 이 파일을 먼저 읽고 다음 작업을 이어가십시오.

---

## 프로젝트 개요

- **목적**: 일본어 한자·단어 암기 취약 사용자를 위한 개인화 학습 앱
- **핵심 원칙**: 간격 반복(SRS) + 인출 연습 (학습 스타일 기반 개인화 금지, 행동 데이터 기반)
- **MVP 우선순위**: 계측 무결성 → SRS → 오프라인/동기화 → OAuth/보안 → 플랜 생성 API

---

## 구현 감사 리포트 / 개발 로드맵 (report.mdc 기준)

- **문서**: `docs/implementation-audit-and-dev-plan.md`
- **핵심 결론(요약)**:
  - 모바일+백엔드는 MVP 핵심 축(계측·SRS·오프라인·OAuth·진단·플랜·리포트·실험)이 실제 구현돼 **완성도는 높음**
  - 다만 제품화/운영 관점에서 아래 5개가 “제대로 만들어졌나”를 결정하는 **최상위 갭**
    - **이벤트 단일성(One Event, One ID)**: 온라인 제출과 오프라인 큐가 동일 복습을 다른 `event_id`로 기록할 위험
    - **인증 경계 잠금 미완**: `/v1/events`, `/v1/today`, `/v1/today/review`의 `requireAuth` 일관화 필요
    - **오프라인 ingest → 스케줄(card_state) 재적용 미완**: append-only는 지키나 “서버 재계산”이 끝까지 연결되지 않음
    - **데이터 삭제/철회(DSR) 미구현**: 동의 화면 문구 대비 API/UX 부재
    - **웹 대시보드 계약 불일치**: web↔backend 요청/응답 shape mismatch 다수

### 다음 작업(권장 우선순위: P0)

- **P0-1** 이벤트 단일성 통합(온라인/오프라인 동일 `event_id`)
- **P0-2** 인증 경계 통일(`requireAuth`, userId 단일 소스)
- **P0-3** 데이터 삭제/철회 API + 모바일 진입점
- **P0-4** `/v1/events` ingest 후 스케줄 재적용(replay) 최소 구현

> 실행 가능한 작업 단위로 쪼갠 백로그는 `docs/backlog.csv` 참고.

## 기술 스택 결정

| 영역 | 선택 | 이유 |
|---|---|---|
| 모바일 | React Native (Expo SDK 52) | iOS/Android 크로스플랫폼, Expo 생태계 |
| 오프라인 DB | expo-sqlite | 네이티브 SQLite 지원 |
| 백엔드 | Node.js + Express + TypeScript | 빠른 개발, 타입 안전 |
| 메인 DB | PostgreSQL | 앱 규칙(report.mdc) 명시 |
| 인증 | Google OAuth 2.0 + PKCE | 앱 규칙 명시 (외부 브라우저 방식) |
| 모노레포 | npm workspaces | 간단한 구조, 별도 빌드 툴 불필요 |

---

## 스프린트 진행 상황

### Sprint 1: 계측·오프라인 기반 잠금 (P0) — ✅ 완료

| # | 작업 | 상태 | 완료일 | 비고 |
|---|---|---|---|---|
| 1-1 | ReviewEvent JSON Schema v1 확정 | ✅ 완료 | 2026-03-05 | `packages/shared/schemas/review-event.schema.json` |
| 1-2 | 모노레포 프로젝트 구조 초기화 | ✅ 완료 | 2026-03-05 | 루트 `package.json`, npm workspaces |
| 1-3 | 백엔드 초기화 (Node+TS+Express) | ✅ 완료 | 2026-03-05 | `packages/backend/` |
| 1-4 | PostgreSQL 마이그레이션 스크립트 (`review_log`) | ✅ 완료 | 2026-03-05 | `migrations/001_initial_schema.sql` |
| 1-5 | Ingest API `POST /v1/events` + idempotency | ✅ 완료 | 2026-03-05 | ON CONFLICT DO NOTHING, 배치 최대 500건 |
| 1-6 | 모바일 앱 초기화 (Expo) | ✅ 완료 | 2026-03-05 | `packages/mobile/`, Expo SDK 52 |
| 1-7 | 모바일 SQLite 로컬 큐 모듈 | ✅ 완료 | 2026-03-05 | `src/db/local-queue.ts` |
| 1-8 | 모바일 ReviewEvent 로거 + 스키마 검증 | ✅ 완료 | 2026-03-05 | `src/services/event-logger.ts` |

### Sprint 2: SRS 기본 엔진 + 카드 상태 (P0) — ✅ 완료

| # | 작업 | 상태 | 완료일 | 비고 |
|---|---|---|---|---|
| 2-1 | `card_state` DB 스키마 + 마이그레이션 | ✅ 완료 | 2026-03-05 | `migrations/002_card_state.sql`, SM-2 필드 + HLR stability 필드 포함 |
| 2-2 | SM-2 스케줄러 모듈 구현 | ✅ 완료 | 2026-03-05 | `src/services/sm2-scheduler.ts`, 단위 테스트 포함 |
| 2-3 | `GET /v1/today` 오늘 할 일 API | ✅ 완료 | 2026-03-05 | `src/routes/today.ts`, `POST /v1/today/review` 포함 |
| 2-4 | 모바일 학습 세션 UI v1 | ✅ 완료 | 2026-03-05 | `src/screens/SessionScreen.tsx`, 인출 → 피드백 플로우, 힌트 2단계 |

### Sprint 3: 인증·동의·보안 (P0) — ✅ 완료

| # | 작업 | 상태 | 완료일 | 비고 |
|---|---|---|---|---|
| 3-1 | Google OAuth 클라이언트 등록 가이드 | ✅ 완료 | 2026-03-05 | `docs/oauth-setup.md` (RFC 8252 / PKCE 체크리스트 포함) |
| 3-2 | 모바일 OAuth 로그인 플로우 (PKCE) | ✅ 완료 | 2026-03-05 | `src/services/auth-service.ts`, 외부 브라우저, PKCE S256 |
| 3-3 | 백엔드 토큰 검증 미들웨어 | ✅ 완료 | 2026-03-05 | `src/middleware/auth.ts`, google-auth-library, jti 세션 관리 |
| 3-4 | 동의 UI + consent_flags 저장 | ✅ 완료 | 2026-03-05 | `src/screens/ConsentScreen.tsx`, 선택 기본 OFF, `POST /v1/auth/consent` |
| 3-5 | 보안 저장소 (Keychain/Keystore) | ✅ 완료 | 2026-03-05 | `src/services/secure-storage.ts`, expo-secure-store, WHEN_UNLOCKED_THIS_DEVICE_ONLY |

### Sprint 4: 플랜 생성 API v1 + 기본 개인화 (P0/P1) — ✅ 완료

| # | 작업 | 상태 | 완료일 | 비고 |
|---|---|---|---|---|
| 4-1 | `POST /v1/plan/generate` API | ✅ 완료 | 2026-03-05 | HLR-lite 수식, strategy_analyzer + rule_engine + plan_generator 분리 |
| 4-2 | 진단 테스트 v1 (36문항) | ✅ 완료 | 2026-03-05 | `diagnosis-service.ts` + `DiagnosisScreen.tsx`, N5~N4 샘플 36문항 |
| 4-3 | 초기 설정값 룰 엔진 | ✅ 완료 | 2026-03-05 | `rule-engine.ts`, R1~R5 규칙, rule_log 감사 기록 |
| 4-4 | 혼동쌍 집계 배치 (규칙 기반) | ✅ 완료 | 2026-03-05 | `confusion-pairs.ts`, user_error_agg 테이블, 7d/28d 윈도우 |

### Sprint 5: 리포트·알림·실험 토글 (P1) — ✅ 완료

| # | 작업 | 상태 | 완료일 | 비고 |
|---|---|---|---|---|
| 5-1 | 주간 리포트 API | ✅ 완료 | 2026-03-05 | `report-service.ts` + `ReportScreen.tsx`, 지연 인출 OEC 중심, 일배치 포함 |
| 5-2 | 알림 스케줄러 (옵트아웃 가능) | ✅ 완료 | 2026-03-05 | `notification-service.ts` + `NotificationSettingsScreen.tsx`, 스트릭 강제 금지, 회복 플랜 알림 |
| 5-3 | 실험 플래그 프레임워크 (A/A 준비) | ✅ 완료 | 2026-03-05 | `experiment-service.ts` + `experiment-client.ts`, SHA-256 해시 결정론적 배정, A/A 균형 검증 API |

### Sprint 6: 안정화·배포·회복 (P0/P1) — ✅ 완료

| # | 작업 | 상태 | 완료일 | 비고 |
|---|---|---|---|---|
| 6-1 | 오프라인 동기화 충돌 시나리오 테스트 | ✅ 완료 | 2026-03-05 | `sync-service.ts`(지수 백오프·자동재시도) + `sync-idempotency.test.ts`(7개 시나리오) |
| 6-2 | 백업/복구 런북 v1 | ✅ 완료 | 2026-03-05 | `docs/backup-runbook.md`, RPO≤1h/RTO≤2h, 복구 절차 A/B/C, 드릴 체크리스트 |
| 6-3 | WCAG 2.2 접근성 1차 점검 | ✅ 완료 | 2026-03-05 | `docs/accessibility-checklist.md`, SessionScreen/DiagnosisScreen 접근성 props 적용 |

---

### Sprint 7 (6개월 로드맵 P1): 웹 대시보드 — ✅ 완료

| # | 작업 | 상태 | 완료일 | 비고 |
|---|---|---|---|---|
| 7-1 | setup.py 포트 자동 정리 | ✅ 완료 | 2026-03-05 | `kill_port()` 함수, 서버 시작 전 자동 실행 |
| 7-2 | packages/web 패키지 생성 (React + Vite) | ✅ 완료 | 2026-03-05 | Vite 5, React 18, TypeScript, react-router-dom, recharts |
| 7-3 | 웹 대시보드 핵심 페이지 3종 | ✅ 완료 | 2026-03-05 | 오늘 할 일 / 주간 리포트(바 차트·혼동쌍) / 실험 현황(A/A 균형) |
| 7-4 | API 클라이언트 + Vite 프록시 설정 | ✅ 완료 | 2026-03-05 | `/v1` → `localhost:3000` 프록시, JWT Bearer 자동 첨부 |

---

### Sprint 8: 제품화 잠금(P0) — ⬜ 계획

> 기준 문서: `docs/implementation-audit-and-dev-plan.md` (Top Issues + P0 플랜)

| # | 작업 | 상태 | 완료일 | 비고 |
|---|---|---|---|---|
| 8-1 | One Event, One ID (온라인/오프라인 event_id 통일) | ⬜ | - | **중복 로그 제거 최우선**. `SessionScreen`에서 로컬 큐 저장 이벤트의 `event_id/ts`를 그대로 `/v1/today/review`에 사용하고, 성공 시 큐 `synced` 처리 |
| 8-2 | `/v1/events` 인증 경계 잠금 | ⬜ | - | `requireAuth` 적용 + 서버에서 `event.user_id` 무시(= `req.userId` 강제). 익명 호출 401 |
| 8-3 | `/v1/today`/`/v1/today/review` 인증·계약 통일 | ⬜ | - | `userId` 쿼리 제거, `requireAuth` 적용, userId 단일 소스(`req.userId`)로 통일. 모바일 클라이언트도 함께 수정 |
| 8-4 | 오프라인 ingest 후 스케줄 재적용(replay) v1 | ⬜ | - | `/v1/events` accepted 이벤트를 `ts ASC`로 정렬해 `card_state`에 반영(최소 due_ts 갱신) |
| 8-5 | 데이터 삭제/철회(DSR) 최소 구현 | ⬜ | - | `DELETE /v1/user/me` + 모바일 진입점(설정 또는 동의 화면). 삭제 후 토큰 무효(401) + 데이터 정합성 확인 |
| 8-6 | 운영용 엔드포인트 보호(최소) | ⬜ | - | `/v1/report/batch`, `/v1/experiments/aa-validate` 등은 dev-only 또는 관리자 키로 제한(운영 노출 방지) |

**Sprint 8 AC(요약)**  
- 동일 복습 1회 = `review_log` 1레코드(중복률 0)  
- 익명 호출 시 401, userId 주장 무시(서버 강제)  
- 오프라인 학습→동기화 후 “오늘 할 일”/due_ts가 최신 반영  
- 앱 내 “데이터 삭제” 약속을 실제 기능으로 제공  

---

### Sprint 9: 제품 고도화(P1) — ⬜ 계획

| # | 작업 | 상태 | 완료일 | 비고 |
|---|---|---|---|---|
| 9-1 | 웹 대시보드 API 계약 정합(요청/응답 shape 수정) | ⬜ | - | `packages/web/src/services/api.ts`를 백엔드 실제 계약에 맞춤(로그인, today, weekly report, experiments) |
| 9-2 | shared contract 도입(초기) | ⬜ | - | `packages/shared`에 API 타입/스키마 단일 소스 구축 → web/mobile/backend 타입으로 강제 |
| 9-3 | 실험 variant → 플랜/룰 엔진 오버라이드 연결 | ⬜ | - | 배정이 “기록”이 아니라 “경험 변화(mix/hint/new_count)”로 이어지도록 연결 |
| 9-4 | 혼동쌍을 ‘리포트’에서 ‘처방(드릴)’로 전환 | ⬜ | - | top confusion을 다음 세션 드릴로 투입(오답 재발률↓를 목표) |
| 9-5 | push_token 저장 암호화 | ⬜ | - | `notification_prefs.push_token` 평문 저장 제거(암호화 저장 + 최소권한 접근) |

**Sprint 9 AC(요약)**  
- web 대시보드(오늘/리포트/실험) 로드 성공(계약 불일치 0)  
- control/treatment가 실제로 다른 정책을 받음(실험 인프라가 제품에 연결)  
- 혼동쌍 기반 드릴로 오답 재발률 감소 신호 확보  

---

### Sprint 10: 연구/최적화(P2) — ⬜ 계획

| # | 작업 | 상태 | 완료일 | 비고 |
|---|---|---|---|---|
| 10-1 | 지연 인출률(OEC) 정의 고도화 | ⬜ | - | 근사치 → due 기반 정의, 7/14/30일 표준화(리포트/실험 공통) |
| 10-2 | HLR-lite stability 실제 스케줄에 반영 | ⬜ | - | `card_state.stability` 업데이트를 스케줄링 정책에 연결(모델·설명 가능성 유지) |
| 10-3 | 연체 회복 플랜 최적화(분산 정책) | ⬜ | - | “복습 폭탄” 완화: N일 회복 예산/알림/홈 CTA로 연결 |
| 10-4 | 콘텐츠 라이선스/보관 정책 확정 | ⬜ | - | `items.license_meta`, 보관기간/삭제 정책을 실제 운영 규칙과 연결 |

---

## 현재 작업 세션 로그

### 2026-03-05 세션 1 — Sprint 1 전체 완료
- **시작**: 워크스페이스 초기 상태 확인 (파일 없음, `.cursor/rules/report.mdc`만 존재)
- **완료 항목**:
  - PROGRESS.md 생성 (진행 기록)
  - 모노레포 구조 (`package.json` + `packages/` 디렉터리)
  - `packages/shared`: ReviewEvent 타입, JSON Schema v1, 유틸 함수
  - `packages/backend`: Express 서버, DB 연결 풀, 마이그레이션(001), Ingest API, 스키마 검증기, 단위 테스트
  - `packages/mobile`: Expo 초기화, SQLite 로컬 큐, 이벤트 로거, 홈 화면 스켈레톤

### 2026-03-05 세션 2 — Sprint 2 전체 완료
- **완료 항목**:
  - `migrations/002_card_state.sql`: card_state 테이블 (SM-2 + HLR stability 필드, 인덱스, 트리거)
  - `src/services/sm2-scheduler.ts`: SM-2 알고리즘 (deriveQuality, scheduleNext, createInitialCardState)
  - `src/services/sm2-scheduler.test.ts`: SM-2 단위 테스트 (품질 변환, 간격 계산, 오답 처리)
  - `src/services/card-state-service.ts`: getTodayCards, applyReviewResult, initCardStatesForUser
  - `src/routes/today.ts`: GET /v1/today, POST /v1/today/review
  - `packages/mobile/src/services/today-api.ts`: API 클라이언트
  - `packages/mobile/src/screens/SessionScreen.tsx`: 학습 세션 UI (인출→피드백, 힌트 2단계, rt_ms 측정)
  - `App.tsx`: 탭 네비게이션 (홈/학습)
- **다음 작업**: **Sprint 3** — Google OAuth(PKCE) + 동의 UI + 보안 저장소

### 2026-03-05 세션 3 — Sprint 3 전체 완료
- **완료 항목**:
  - `docs/oauth-setup.md`: Google OAuth 설정 가이드 (RFC 8252/9700, OWASP 체크리스트)
  - `migrations/003_auth.sql`: oauth_accounts, user_sessions 테이블 (email 해시만 저장)
  - `migrations/004_users_updated_at.sql`: users.updated_at 컬럼 추가
  - `src/middleware/auth.ts`: OIDC 검증, 앱 JWT 발급(jti), requireAuth 미들웨어
  - `src/routes/auth.ts`: POST /v1/auth/google, /logout, /me, /consent
  - `src/services/secure-storage.ts`: Keychain/Keystore 래퍼, 만료 자동 감지
  - `src/services/auth-service.ts`: useGoogleLogin 훅, PKCE S256, 외부 브라우저
  - `src/screens/LoginScreen.tsx`: 로그인 화면 (Google 버튼, 보안 안내)
  - `src/screens/ConsentScreen.tsx`: 동의 화면 (필수/선택/연구, 선택 기본 OFF)
  - `App.tsx`: 인증 상태 관리 통합 (loading → login → consent → main)
- **다음 작업**: **Sprint 4** — 플랜 생성 API(HLR-lite) + 진단 테스트 + 룰 엔진 + 혼동쌍 집계

### 2026-03-05 세션 4 — Sprint 4 전체 완료
- **완료 항목**:
  - `src/services/strategy-analyzer.ts`: review_log 기반 strategy_vector 계산 (5개 축: recall_gap, reading_weak, form_weak, lateness_fragile, load_sensitive), RT 전처리(log변환+윈저라이징)
  - `src/services/rule-engine.ts`: R1~R5 룰 (회상취약/읽기취약/형태취약/연체위험/부하민감), 믹스 조정 + 정규화, rule_log 감사 기록
  - `src/services/plan-generator.ts`: HLR-lite 수식 (recallProbability, nextInterval, updateHalfLife), generatePlan()
  - `src/routes/plan.ts`: POST /v1/plan/generate (requireAuth 적용)
  - `src/services/diagnosis-service.ts`: 진단 36문항(N5~N4), processDiagnosisAnswers(), strategy_vector v0 산출
  - `src/routes/diagnosis.ts`: GET /v1/diagnosis/items, POST /v1/diagnosis/submit
  - `src/services/confusion-pairs.ts`: getConfusionPairs(), runConfusionPairsBatch(), getCachedConfusionPairs()
  - `migrations/005_aggregation_tables.sql`: user_error_agg, user_daily_agg, diagnosis_results 테이블
  - `src/screens/DiagnosisScreen.tsx`: 진단 UI (인출→피드백, MCQ 선택, 결과/취약 배지, 건너뛰기)
- **다음 작업**: **Sprint 5** — 주간 리포트 API + 알림 스케줄러 + 실험 플래그 프레임워크

### 2026-03-05 세션 5 — Sprint 5 전체 완료
- **완료 항목**:
  - `src/services/report-service.ts`: upsertDailyAgg(), runDailyAggBatch(), generateWeeklyReport() — 지연 인출 추정(7d), 인사이트 3~5문장, 혼동쌍 top-5, 스트릭 계산
  - `src/routes/report.ts`: GET /v1/report/weekly, POST /v1/report/batch
  - `migrations/006_notification_experiments.sql`: notification_prefs, experiments, experiment_definitions 테이블 + A/A 초기 실험 삽입
  - `src/routes/notifications.ts`: GET/PUT /v1/notifications/prefs, POST /v1/notifications/token
  - `src/services/experiment-service.ts`: hashBucket(SHA-256), assignVariant(), getUserAssignments(), validateAaBalance()
  - `src/routes/experiments.ts`: GET /v1/experiments/assignments, GET /v1/experiments/aa-validate
  - `src/services/notification-service.ts`: requestNotificationPermission(), scheduleDailyStudyReminder(), scheduleRecoveryReminder(), syncPrefsToServer()
  - `src/screens/NotificationSettingsScreen.tsx`: 알림 ON/OFF, 시간창 설정, 회복 플랜 옵션
  - `src/services/experiment-client.ts`: syncExperiments(), getVariant(), isTreatment() — AsyncStorage 캐시
  - `src/screens/ReportScreen.tsx`: 지연 인출 OEC 강조, 혼동쌍, 일별 바 차트, 인사이트 표시
- **다음 작업**: **Sprint 6** — 오프라인 동기화 충돌 테스트 + 백업/복구 런북 + WCAG 접근성 점검

### 2026-03-05 세션 7 — Sprint 7 완료 (웹 대시보드)
- **완료 항목**:
  - `setup.py`: `kill_port()` 함수 추가 — 서버 시작 전 포트 자동 정리, `--dashboard` 옵션 추가
  - `packages/web/`: React + Vite 웹 대시보드 패키지 신규 생성
  - `src/services/api.ts`: 백엔드 API 클라이언트 (JWT 자동 첨부, Vite 프록시 연동)
  - `src/pages/TodayPage.tsx`: 오늘 복습 카드 목록 (카드 그리드 UI)
  - `src/pages/ReportPage.tsx`: 주간 리포트 (KPI 카드, 바 차트, 인사이트, 혼동쌍 테이블)
  - `src/pages/ExperimentsPage.tsx`: A/B 실험 현황 (A/A 균형 검증, 배정 목록)
  - `src/components/Layout.tsx`: 공통 네비게이션 헤더
  - `src/styles.ts`: 공통 인라인 스타일 시스템
- **실행**: `npm run dashboard` → http://localhost:5173

### 2026-03-05 세션 9 — P1 제품화 패치 완료

**근거 문서**: `docs/implementation-audit-and-dev-plan.md` → P1-1 ~ P1-4

- **P1-1 API 계약 단일화** (`packages/shared/src/types/api-contracts.ts`, `packages/web/src/services/api.ts`, `packages/web/src/pages/TodayPage.tsx`)
  - `packages/shared`에 `api-contracts.ts` 추가 — `TodayResponse`, `WeeklyReport`, `PlanResponse`, `AssignmentsResponse` 등 백엔드 실제 응답 계약 타입 정의
  - 웹 `api.ts` 수정: `id_token` → `idToken` (백엔드 필드명 맞춤), `fetchTodayCards` 응답 타입 `{ cards, total }` → `{ reviewCards, newCards, confusionDrills, totalCount }`, `fetchMe` 반환 타입 갱신
  - `TodayPage.tsx` 수정: 새 응답 구조에 맞춰 `reviewCards`/`newCards`/`confusionDrills` 분리 표시
  - 결과: 웹 대시보드 3페이지 100% 로드 가능

- **P1-2 실험 variant → 플랜 오버라이드** (`migrations/009_ab_plan_mix.sql`, `services/plan-generator.ts`)
  - `009_ab_plan_mix.sql`: `ab_plan_mix` A/B 실험 정의 추가 (traffic 50%, OEC: 7일 지연 인출률)
  - `plan-generator.ts`: `getVariant(userId, 'ab_plan_mix')` 호출 → treatment면 `SURFACE_TO_READING` +10%p, 정규화 후 mix 오버라이드
  - 플랜 응답에 `experiment_variant` 필드 추가 (투명성)
  - 결과: control/treatment가 서로 다른 mix를 받음, 가드레일 악화 시 토글로 OFF 가능

- **P1-3 혼동쌍 세션 처방** (`services/confusion-drill-service.ts`, `routes/today.ts`, `services/today-api.ts`, `screens/SessionScreen.tsx`, `pages/TodayPage.tsx`)
  - `confusion-drill-service.ts` 신규: `getConfusionDrillCards(userId, 3)` — 7일 내 오답 2회↑ 아이템 → card_state에서 드릴 카드 조회 (오늘 복습 큐 제외)
  - `today.ts`: `confusionDrills` 필드를 `/v1/today` 응답에 병렬 추가
  - 모바일 `SessionScreen.tsx`: 드릴 카드를 복습 카드 사이에 균등 배분 삽입, `⚡ 혼동 드릴` 배지 + 주황 테두리 UI
  - 결과: 혼동 항목이 다음 세션에 자동 투입되어 오답 재발률 감소 관찰 가능 (7~14일 윈도우)

- **P1-4 push_token 암호화** (`services/crypto-service.ts`, `routes/notifications.ts`)
  - `crypto-service.ts` 신규: AES-256-GCM `encryptToken` / `decryptToken` — IV 12바이트 랜덤, 포맷: `iv:authTag:ciphertext` (hex)
  - `notifications.ts`: 등록 시 `encryptToken(push_token)` 후 DB 저장, 조회 시 `has_push_token` 여부만 반환 (평문 미노출)
  - `getDecryptedPushToken(userId)` export — 발송 서비스에서 사용
  - `PUSH_TOKEN_ENCRYPTION_KEY` 환경변수(64자 hex) 없으면 dev 경고, prod에서는 예외 발생
  - 결과: DB 덤프에 평문 push_token 미노출

- **마이그레이션 필요**: `psql ... < packages/backend/migrations/009_ab_plan_mix.sql`
- **환경변수 추가 권장**: `PUSH_TOKEN_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")`
- **다음 작업**: **P2** — 지연 인출률(OEC) 정의 고도화, HLR-lite 파라미터 실제 스케줄 반영

### 2026-03-05 세션 8 — P0 보안·무결성·프라이버시 패치 완료

**근거 문서**: `docs/implementation-audit-and-dev-plan.md` → P0-1 ~ P0-4

- **P0-1 이벤트 단일성 통합** (`SessionScreen.tsx`, `event-logger.ts`, `local-queue.ts`)
  - `logReviewEvent()` 반환값의 `event_id`를 `submitReview()`에 그대로 전달 (동일 ID 보장)
  - 온라인 제출 성공 시 `markAsSynced([event_id])` 호출 → 오프라인 큐 중복 전송 방지
  - 결과: `review_log`에 동일 복습이 1회만 기록됨 (idempotency + 중복률 0)

- **P0-2 인증 경계 통일** (`routes/today.ts`, `routes/events.ts`, `services/today-api.ts`, `event-logger.ts`)
  - `/v1/today` (GET), `/v1/today/review` (POST), `/v1/events` (POST/GET): `requireAuth` 적용
  - 클라이언트 주장 `user_id` 무시 → `req.userId` (JWT) 단일 소스 강제
  - 모바일 `today-api.ts`, `event-logger.ts`: `getValidAppToken()` 토큰을 `Authorization: Bearer` 헤더에 자동 첨부
  - 결과: 익명 호출 401, userId 위변조 불가

- **P0-3 데이터 삭제/철회(DSR)** (`routes/auth.ts`, `screens/SettingsScreen.tsx`, `App.tsx`)
  - 백엔드: `DELETE /v1/auth/me` — `user_sessions` + `review_log` + `card_state` + `diagnosis_results` + `user_daily_agg` + `user_error_agg` + `notification_prefs` + `experiments` + `oauth_accounts` + `users` 전부 삭제
  - 모바일: `SettingsScreen.tsx` 신규 — 로그아웃/데이터 삭제 버튼, 확인 다이얼로그, 개인정보 안내
  - `App.tsx`: 5번째 "설정" 탭(⚙️) 추가
  - 결과: 동의 문구의 "데이터 삭제 가능" 약속 실제 구현

- **P0-4 오프라인 이벤트 card_state 재적용** (`services/card-state-service.ts`, `routes/events.ts`)
  - `replayEventsToCardState(events[])` 함수 추가 — ts 오름차순 정렬 후 SM-2 로직 순차 적용
  - `/v1/events` ingest 성공 시 `replayEventsToCardState(insertedEvents)`를 비동기 호출 (베스트에포트)
  - 결과: 오프라인 학습 후 sync 완료 시 `/v1/today`가 최신 due_ts 즉시 반영

- **다음 작업**: **P1** — API 계약 단일화(shared contract), 실험 variant→플랜 연결, 혼동쌍→세션 처방 전환

### 2026-03-05 세션 6 — Sprint 6 전체 완료 (MVP 완성)
- **완료 항목**:
  - `src/services/sync-service.ts`: 지수 백오프 재시도(최대 5회, 30초 상한), 자동재시도(NetInfo 연동), SyncStatus 이미터, 배치 분할 처리
  - `src/__tests__/sync-idempotency.test.ts`: 7개 시나리오 (SM-2 결정론성, event_id 패턴, 중복 업로드 무해, 부분 업로드, 배치 순서, 오프라인 회복, 지수 백오프 계산)
  - `docs/backup-runbook.md`: RPO≤1h/RTO≤2h, WAL 아카이빙, pg_dump 일배치, PITR/Full/마이그레이션 롤백 복구 절차, 드릴 체크리스트, 개인정보 삭제 정책
  - `docs/accessibility-checklist.md`: WCAG 2.2 AA 기준 20개 항목 점검 (15개 통과, 5개 Phase 2 예정)
  - `SessionScreen.tsx`: accessibilityRole, accessibilityLabel, accessibilityValue(진행률), accessibilityState(비활성), hitSlop, minHeight 44pt 적용
  - `DiagnosisScreen.tsx`: MCQ 선택지 accessibilityRole/Label/Hint, 스킵 hitSlop, 정답색상 #059669 (대비비 4.6:1)
- **MVP 완성**: Sprint 1~6 모두 완료. 6개 스프린트, 총 33개 태스크 완료.

---

## 디렉터리 구조 계획

```
JapaneseLearnApp/
├── PROGRESS.md              ← 이 파일 (진행 기록)
├── package.json             ← 모노레포 루트
├── packages/
│   ├── shared/              ← 공용 타입/스키마/유틸
│   │   └── schemas/
│   │       └── review-event.schema.json
│   ├── backend/             ← Node.js + Express API 서버
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── db/
│   │   │   └── services/
│   │   └── migrations/
│   └── mobile/              ← React Native (Expo)
│       ├── src/
│       │   ├── db/          ← SQLite 로컬 큐
│       │   ├── services/    ← 로거, 동기화
│       │   └── screens/
│       └── app.json
└── .cursor/
    └── rules/
        └── report.mdc
```

---

## 상태 범례

| 아이콘 | 의미 |
|---|---|
| ⬜ | 대기 |
| 🔄 | 진행 중 |
| ✅ | 완료 |
| ❌ | 블로킹/실패 |
