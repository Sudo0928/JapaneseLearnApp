# 구현 감사 리포트 + 개발 로드맵 (report.mdc 기준)

> **문서 목적**: `.cursor/rules/report.mdc`(구현 지침서)를 “요구사항 스펙”으로 간주하고, 현재 `packages/*` 구현이 이를 얼마나 충족하는지 **증거 기반으로 점수화**한 뒤, 남은 갭을 메우기 위한 **우선순위 개발 플랜(P0~P2)**을 제시한다.  
> **작성일**: 2026-03-05  
> **스코프**: `packages/backend`, `packages/mobile`, `packages/shared`, `packages/web`

---

## 요약 (Executive Summary)

- **결론**: 모바일+백엔드 중심으로 `report.mdc`의 MVP(P0~P1) 골격(계측 무결성·SRS·오프라인·OAuth·진단·플랜·리포트·실험)이 “실제 코드/스키마”로 구현돼 있어 **전반 완성도는 높음**.  
- **가장 큰 리스크 5개**:  
  - **이벤트 단일성 붕괴 가능성**: 온라인 제출(`/v1/today/review`)과 오프라인 큐(`/v1/events`)가 동일 복습을 **서로 다른 `event_id`로 기록할 가능성**이 있음.  
  - **인증 경계가 완전히 잠기지 않음**: `/v1/events`, `/v1/today`, `/v1/today/review` 등이 인증 없이 동작하거나 `userId` 쿼리 기반.  
  - **오프라인 ingest가 스케줄(card_state)로 재적용되지 않음**: append-only 원칙은 지키지만 “서버 재계산”이 완결되지 않음.  
  - **데이터 삭제/철회(DSR) 기능 미구현**: 동의 UI/문구는 있으나 실제 API/화면이 없음.  
  - **웹 대시보드 계약 불일치**: API 요청/응답 필드가 백엔드와 어긋나 “페이지는 있지만 작동은 불확실”.

---

## 평가 방식(Scoring Rubric)

- **점수 범위**: 0~10
  - **10**: 문서 요구를 거의 그대로 충족(기능·보안·데이터 경로·AC까지 연결)
  - **7~9**: 핵심 구현 존재, 운영 리스크/완결성 일부 미흡
  - **4~6**: 구현은 일부 있으나 요구사항과의 연결/정합성이 약함
  - **0~3**: 구현 흔적이 거의 없거나 핵심 요구 미충족
- **평가 기준(가중치)**: (1) 계측 무결성/동기화/보안(P0) (2) 학습 메커니즘 관통(SRS→세션→리포트) (3) 계약 정합성(클라이언트↔서버) (4) 운영 리스크(삭제권/토큰/실험)

---

## 구현 충족도 점수표 (report.mdc ↔ 실제 코드)

| 영역(문서 축) | 점수 | 구현 증거(대표 파일) | 주요 갭 |
|---|---:|---|---|
| **ReviewEvent 스키마 + 검증(서버 Ajv)** | **9** | `packages/shared/schemas/review-event.schema.json`, `packages/backend/src/services/event-validator.ts` | ingest 인증 경계 미완 |
| **Ingest API + idempotency(append-only)** | **8** | `packages/backend/src/routes/events.ts` (ON CONFLICT DO NOTHING, 202 부분성공) | 이벤트 단일성(중복) 리스크 |
| **오프라인 큐(SQLite) + 동기화(백오프/자동재시도)** | **8** | `packages/mobile/src/db/local-queue.ts`, `packages/mobile/src/services/sync-service.ts` | 동기화 경로 2개(중복 구현) |
| **SRS(SM-2) + card_state + 오늘 할 일** | **8** | `packages/backend/src/services/sm2-scheduler.ts`, `migrations/002_card_state.sql`, `routes/today.ts` | `/today` 인증/요청계약 미정리 |
| **진단(36문항·인출 우선·v0 산출)** | **8.5** | `routes/diagnosis.ts`, `services/diagnosis-service.ts`, `mobile/.../DiagnosisScreen.tsx` | v1/v2 공존 운영 기준 필요 |
| **전략 벡터/취약 플래그(행동 기반, RT 전처리)** | **9** | `packages/backend/src/services/strategy-analyzer.ts` | OEC(지연 인출) 정의 고도화 여지 |
| **룰 엔진 + 플랜 생성 API(HLR-lite 포함)** | **9** | `services/rule-engine.ts`, `services/plan-generator.ts`, `routes/plan.ts` | 실험 variant를 정책에 연결 약함 |
| **리포트(지연 인출 중심) + 혼동쌍 집계** | **8** | `services/report-service.ts`, `services/confusion-pairs.ts`, `routes/report.ts` | 웹 계약 불일치 |
| **실험(A/A→A/B) 프레임워크** | **8** | `services/experiment-service.ts`, `migrations/006_notification_experiments.sql` | 관리자 엔드포인트 보호 필요 |
| **알림(옵트인/시간창/회복플랜/벌점금지)** | **7.5** | `routes/notifications.ts`, `mobile/services/notification-service.ts` | push_token 저장 암호화 미완 |
| **OAuth(PKCE)+세션(jti)+동의 저장** | **7** | `mobile/services/auth-service.ts`, `backend/middleware/auth.ts`, `routes/auth.ts`, `ConsentScreen.tsx` | 핵심 API 인증 경계 일관화 필요 |
| **삭제/철회/내보내기(privacy ops)** | **3** | (동의 문구/룰북에만 존재) | 실제 API/UX 미구현 |
| **웹 대시보드(웹 보조)** | **3** | `packages/web/src/pages/*` | API 계약 불일치 다수 |

---

## 치명 갭(Top Issues) 상세

### 1) 이벤트 단일성(One Event, One ID) 붕괴 가능성

- **현상**: 모바일 세션에서 로컬 큐 저장용 이벤트와, 서버 즉시 제출용 이벤트가 **다른 `event_id`로 생성**될 수 있음.
- **영향**: `review_log` 중복 → 전략 벡터/리포트/OEC/실험 지표 왜곡 → 개인화 룰이 잘못 발동.
- **우선순위**: **P0**

### 2) 인증 경계 미완(중요 엔드포인트가 익명/쿼리 userId 기반)

- **현상**: `/v1/events`, `/v1/today`, `/v1/today/review`가 `requireAuth` 없이 동작하거나 `userId`를 쿼리로 받음.
- **영향**: 위변조/스팸/타 사용자 이벤트 주입 가능성.
- **우선순위**: **P0**

### 3) 오프라인 ingest 후 서버 스케줄 재계산이 완결되지 않음

- **현상**: `/v1/events`로 들어온 오프라인 이벤트가 `card_state` 갱신으로 이어지지 않음.
- **영향**: 오프라인 학습 후 온라인 복귀 시 “오늘 할 일”이 즉시 최신이 아닐 수 있음.
- **우선순위**: **P0~P1**

### 4) 데이터 삭제(철회) 약속 대비 실제 기능 부재

- **현상**: 동의 화면/룰북에 “데이터 삭제”를 안내하나 실제 API/화면은 없음.
- **영향**: 신뢰/준수 리스크(privacy by default) + 운영 부담.
- **우선순위**: **P0**

### 5) 웹 대시보드 API 계약 불일치

- **현상**: 요청 필드명(`id_token` vs `idToken`)·응답 구조(weekly report shape) 등이 백엔드와 불일치.
- **영향**: “구현된 것처럼 보이지만 실제로는 작동하지 않음”.
- **우선순위**: **P1**

---

## 개발 로드맵 (우선순위 P0 → P2)

### P0 (즉시 잠금: 데이터 무결성·보안·삭제권) — 목표: 1~2주

#### P0-1. 이벤트 단일성 통합 (One Event, One ID)
- **목표**: “로컬 큐 저장 이벤트”와 “온라인 즉시 제출 이벤트”가 **동일 `event_id`**를 사용.
- **작업**:
  - 모바일 `SessionScreen`에서 `logReviewEvent()`가 생성한 이벤트(또는 반환값)의 `event_id/ts`를 그대로 `/v1/today/review`에 사용.
  - `/v1/today/review` 성공 시 해당 `event_id`를 로컬 큐에서 `synced` 처리(또는 즉시 큐 저장 자체를 “이미 synced”로 저장).
- **AC**:
  - 동일 카드 1회 제출이 `review_log`에 1회만 기록됨(중복률 0).
  - offline→online 전환 후에도 duplicate 삽입이 무해하며 지표가 왜곡되지 않음.

#### P0-2. 인증 경계 통일
- **목표**: 모든 개인 데이터 API는 `requireAuth` 적용, `userId`는 `req.userId` 단일 소스.
- **작업**:
  - `/v1/events`에 `requireAuth` 적용(서버에서 `event.user_id`는 무시하고 `req.userId`로 강제).
  - `/v1/today`는 쿼리 `userId` 제거, `req.userId` 기반으로 조회.
  - `/v1/today/review`에 `requireAuth` 적용 + `user_id` 강제.
- **AC**:
  - 익명 호출 시 401.
  - userId 파라미터 없이도 모바일/웹이 정상 동작.

#### P0-3. 데이터 삭제/철회(DSR) API + 모바일 진입점
- **목표**: 동의 문구의 약속을 실제 기능으로 제공.
- **작업(최소)**:
  - 백엔드: `DELETE /v1/user/me` (세션 폐기 + users 연쇄삭제 또는 익명화 정책 적용)
  - 모바일: 설정 화면(또는 ConsentScreen 하단)에서 “데이터 삭제” 버튼 → 확인 다이얼로그 → API 호출
- **AC**:
  - 삭제 후 토큰 무효(401), DB에 사용자 데이터가 남지 않음(또는 정책에 따라 익명화).
  - 문서/동의 UI의 “삭제 가능” 안내와 일치.

#### P0-4. 오프라인 ingest의 스케줄 재적용(replay) 최소 구현
- **목표**: `/v1/events`로 수신된 accepted 이벤트를 `card_state`에 반영(최소한 due_ts 갱신).
- **작업**:
  - 서버에서 accepted 이벤트를 `ts ASC`로 정렬해 `applyReviewResult()`와 동일 로직을 배치로 적용.
  - idempotency(event_id) 보장: 이미 처리된 이벤트는 무해.
- **AC**:
  - 오프라인 학습 후 sync 완료 시 `/v1/today`가 최신 due_ts를 반영.

---

### P1 (제품화: 계약 정합·실험 연결·처방 강화) — 목표: 2~6주

#### P1-1. API 계약 단일화(shared contract)
- **목표**: web/mobile/backend 간 필드/응답 구조 불일치 제거.
- **방법**:
  - `packages/shared`에 API 타입/스키마(예: Zod/OpenAPI)를 두고 클라이언트가 타입으로 강제.
  - 특히 `packages/web/src/services/api.ts`를 백엔드 실제 계약에 맞춰 수정.
- **AC**:
  - 대시보드 3페이지(오늘/리포트/실험)가 100% 로드 성공.

#### P1-2. 실험 variant를 rule-engine/플랜에 실제 반영
- **목표**: “배정”이 아니라 “경험 변화”로 연결.
- **작업**:
  - 서버 플랜 생성 시 `experiments` variant를 조회하여 mix/hint_steps/new_count 등을 오버라이드.
- **AC**:
  - control/treatment가 서로 다른 `mix`를 받음.
  - 가드레일(연체/이탈) 악화 시 토글로 즉시 OFF 가능.

#### P1-3. 혼동쌍을 리포트에서 세션 처방으로 전환
- **목표**: top confusion을 다음 세션에 “드릴”로 자동 투입.
- **AC**:
  - 혼동 항목의 오답 재발률 감소가 관찰됨(7~14일 윈도우).

#### P1-4. push_token 저장 암호화(운영 안전장치)
- **목표**: `notification_prefs.push_token`를 암호화 저장 + 최소권한 접근.
- **AC**:
  - DB 덤프에 평문 토큰이 남지 않음.

---

### P2 (고도화: 모델·최적화·정의 기반 OEC) — 목표: 2~6개월

- **지연 인출률(OEC) 정의 고도화**: “근사치” → due 기반 정의, 7/14/30일 표준화.
- **HLR-lite 파라미터 학습**: 사용자별 stability 업데이트를 실제 스케줄에 반영(현재는 필드만 존재).
- **최적화 스케줄/큐잉**: 연체 회복 플랜을 수리 모델로 개선.
- **콘텐츠 라이선스/정책 확정**: `items.license_meta` 운영 정책과 연결.

---

## 실행 체크리스트 (릴리즈 게이트)

- **계측 무결성**: 이벤트 드롭율 < 0.1%, 중복률 상한 설정, 스키마 거부 로그 확인
- **보안**: 익명 호출 401, user_id 클라이언트 주장 무시, 토큰 폐기(jti) 동작
- **오프라인**: 오프라인 학습→재접속→sync→today/plan 반영
- **프라이버시**: 삭제/철회 1버튼, 동의 선택 기본 OFF 유지
- **계약**: web/mobile/backend 계약 불일치 0

---

## 참고(구현 근거 파일 목록)

- 이벤트 스키마: `packages/shared/schemas/review-event.schema.json`, `packages/shared/src/types/review-event.ts`
- ingest: `packages/backend/src/routes/events.ts`
- SRS/오늘할일: `packages/backend/src/services/sm2-scheduler.ts`, `packages/backend/src/services/card-state-service.ts`, `packages/backend/src/routes/today.ts`
- OAuth/동의: `packages/mobile/src/services/auth-service.ts`, `packages/backend/src/middleware/auth.ts`, `packages/backend/src/routes/auth.ts`, `packages/mobile/src/screens/ConsentScreen.tsx`
- 진단/플랜: `packages/backend/src/routes/diagnosis.ts`, `packages/backend/src/services/diagnosis-service.ts`, `packages/backend/src/services/rule-engine.ts`, `packages/backend/src/services/plan-generator.ts`
- 리포트/실험/알림: `packages/backend/src/routes/report.ts`, `packages/backend/src/services/report-service.ts`, `packages/backend/src/services/experiment-service.ts`, `packages/backend/src/routes/notifications.ts`

