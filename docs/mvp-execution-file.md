# JapaneseLearnApp MVP 실행 파일

> 목적: 차기 개발 지침서를 실제 구현 작업으로 변환하기 위한 실행 문서
> 성격: 스프린트 계획서 + 이슈 실행 파일 + 검증 기준
> 원칙: 기능 추가보다 먼저 데이터 무결성, 학습 효과, 검증 가능성, 사용자 신뢰를 잠근다

---

## 1. 이번 MVP의 정의

이번 MVP는 “기능이 많아 보이는 앱”이 아니라 아래 조건을 만족하는 앱으로 정의한다.

- 신규 사용자가 로그인 직후 실제 학습을 시작할 수 있다.
- 동일 학습 이벤트는 한 번만 의미 있게 반영된다.
- 개인화 플랜이 실제 세션 구성에 반영된다.
- 리포트가 실제 장기 기억 지표를 기반으로 동작한다.
- 사용자는 왜 이런 학습 플랜을 받았는지 이해할 수 있다.

이번 MVP 완료의 기준은 다음 다섯 줄이다.

1. `One Event, One ID`
2. `Google login -> initial cards -> first session` 경로 완성
3. `Plan -> Today queue -> Session UI` 연결
4. `True OEC` 초안 구현
5. `Shared contract` 기반으로 web/mobile/backend 정합성 확보

---

## 현재 진행 상태

- `Sprint A / 0단계 제품 잠금`: 1차 구현 완료
- `Sprint B / 1단계 실행 연결`: 1차 구현 완료
- `Sprint C / 2단계 측정 잠금`: 1차 구현 완료
- 완료된 항목:
  - `MVP-A1` `/today/review` idempotency 보강
  - `MVP-A2` 신규 사용자 bootstrap 연결
  - `MVP-A3` `dev-init` production 차단
  - `MVP-A4` `review_log` 이벤트 시점 상태 스냅샷 저장
  - `MVP-A5` 사용자별 진단 완료 상태 분리
  - `MVP-A6` 관리자/배치 엔드포인트 보호
  - `MVP-B1` `PlanScreen` 서버 플랜 연결
  - `MVP-B2` 플랜 기반 `today` 큐 컴파일러 연결
  - `MVP-B3` `SessionScreen`의 `ui_policy` 반영
  - `MVP-C1` `true OEC` 초안 구현 (`7d/14d/30d due-based recall`)
  - `MVP-C2` 리포트 계약 재설계 (`retention_metrics`, `confusion_metrics`, `recovery_metrics`)
- 후속 확인 필요:
  - 신규 마이그레이션 `010_review_log_snapshot.sql` 적용
  - 실사용 E2E(신규 로그인 -> 진단 -> 세션 시작) 수동 검증
  - 실제 사용자별 세션 카드 mix가 의도대로 분포하는지 API/E2E 검증
  - `MVP-B4` 문항 유형 확장(`MCQ`, `CLOZE`, `LISTENING`)
  - `MVP-B5` 오류 유형별 혼동 드릴 2차 고도화
  - `MVP-C3` 실험 운영 로그 구조화
  - `MVP-C4` 회복 지표 정교화와 운영 기준 확정

---

## 2. 우선순위 체계

### P0

앱이 “믿을 수 있는가”를 결정하는 작업

### P1

앱이 “개인화 학습 앱처럼 실제로 작동하는가”를 결정하는 작업

### P2

앱이 “연구 기반 최적화 시스템으로 진화하는가”를 결정하는 작업

---

## 3. 스프린트 구조

### Sprint A. 무결성 잠금

기간: 1~2주
목표: 상태 오염과 잘못된 개인화를 막는다.

### Sprint B. 실행 연결

기간: 2주
목표: 플랜과 세션을 실제로 연결한다.

### Sprint C. 측정 잠금

기간: 2주
목표: true OEC와 리포트를 통일한다.

### Sprint D. 연구형 확장

기간: 2~4주
목표: HLR-lite, 연체 회복, 문항 다양성으로 고도화한다.

---

## 4. 실행 이슈 목록

## Sprint A. 무결성 잠금

### MVP-A1. `/today/review` 완전 idempotency

- 목적: 같은 `event_id` 재전송 시 `card_state`가 두 번 갱신되지 않도록 한다.
- 우선순위: `P0`
- 변경 대상:
  - `packages/backend/src/services/card-state-service.ts`
  - `packages/backend/src/routes/today.ts`
- 구현 방식:
  - 트랜잭션 시작 후 `review_log`에서 `event_id` 존재 여부를 먼저 확인한다.
  - 이미 존재하면 기존 결과를 반환하고 상태 갱신을 건너뛴다.
  - 또는 `review_log` insert 성공 시에만 `card_state` 갱신이 발생하도록 순서를 바꾼다.
- 수용 기준:
  - 같은 payload를 10번 보내도 최종 `card_state`는 1회 반영 결과와 동일하다.
  - `review_log`는 1행만 남는다.
- 테스트:
  - integration test: same `event_id` repeated post
  - manual test: network retry simulation
- 리스크:
  - 응답 재구성이 어색하면 클라이언트 UX가 흔들릴 수 있음

### MVP-A2. 신규 사용자 bootstrap 완성

- 목적: `POST /v1/auth/google`로 가입한 사용자가 즉시 학습할 수 있게 한다.
- 우선순위: `P0`
- 변경 대상:
  - `packages/backend/src/routes/auth.ts`
  - `packages/backend/src/services/card-state-service.ts`
  - 필요 시 `migrations/*` seed 관련 파일
- 구현 방식:
  - 신규 사용자 생성 시점에 초기 카드 상태를 자동 생성한다.
  - 최소 N5 시드 카드가 존재하지 않으면 의미 있는 에러를 반환한다.
  - 로그인 응답에 `needsDiagnosis`, `needsBootstrap`, `readyForStudy` 같은 상태를 포함한다.
- 수용 기준:
  - 신규 사용자 첫 로그인 후 `GET /v1/today`가 빈 목록이 아닌 학습 가능한 목록을 반환한다.
- 테스트:
  - integration test: new user login -> today available
  - manual E2E: login -> diagnosis -> session

### MVP-A3. `dev-init` 운영 차단

- 목적: 개발용 백도어가 production 경로에 남지 않게 한다.
- 우선순위: `P0`
- 변경 대상:
  - `packages/backend/src/routes/auth.ts`
- 구현 방식:
  - `NODE_ENV !== 'development'`에서 404 또는 403 반환
  - 가능하면 build flag로 라우트 자체를 제외
- 수용 기준:
  - production 환경에서 `/v1/auth/dev-init`이 동작하지 않는다.
- 테스트:
  - environment-based route test

### MVP-A4. 이벤트 시점 상태 스냅샷 저장

- 목적: 과거 이벤트 분석이 현재 상태에 오염되지 않게 한다.
- 우선순위: `P0`
- 변경 대상:
  - `migrations/*`
  - `packages/backend/src/services/card-state-service.ts`
  - `packages/backend/src/services/report-service.ts`
  - `packages/backend/src/services/strategy-analyzer.ts`
- 추가 컬럼 예시:
  - `due_ts_at_review`
  - `repetitions_at_review`
  - `interval_days_at_review`
  - `ease_factor_at_review`
  - `state_at_review`
  - `is_new_at_review`
- 수용 기준:
  - `lateness`, `new_cards`, `due-based metrics`를 `review_log` 단독으로 재현 가능하다.
- 테스트:
  - migration test
  - batch recomputation test

### MVP-A5. 사용자별 진단 상태 분리

- 목적: 기기 공용 `DIAGNOSIS_DONE`으로 인한 개인화 오염을 막는다.
- 우선순위: `P0`
- 변경 대상:
  - `packages/mobile/App.tsx`
  - `packages/mobile/src/services/secure-storage.ts`
- 구현 방식:
  - 키를 `diagnosis_done:${userId}` 형태로 저장
  - 로그아웃 시 현재 사용자 키만 정리
- 수용 기준:
  - 같은 기기에서 사용자 A와 B의 진단 상태가 섞이지 않는다.
- 테스트:
  - manual multi-account test

### MVP-A6. 관리자/배치 엔드포인트 보호

- 목적: 운영용 엔드포인트가 일반 사용자에게 노출되지 않게 한다.
- 우선순위: `P0`
- 변경 대상:
  - `packages/backend/src/routes/report.ts`
  - `packages/backend/src/routes/experiments.ts`
- 구현 방식:
  - admin token 또는 internal key 기반 보호
  - production에서 비공개
- 수용 기준:
  - 일반 사용자 토큰으로 접근 불가
- 테스트:
  - 권한 integration test

---

## Sprint B. 실행 연결

### MVP-B1. 플랜 API를 실제 모바일 플랜 화면에 연결

- 목적: `PlanScreen`이 로컬 휴리스틱이 아니라 서버 플랜을 사용하게 한다.
- 우선순위: `P1`
- 변경 대상:
  - `packages/mobile/src/screens/PlanScreen.tsx`
  - `packages/mobile/src/services/*`
  - `packages/backend/src/routes/plan.ts`
- 구현 방식:
  - 진단 결과 조회 후 `/v1/plan/generate` 호출
  - 서버 `mix`, `daily_budget`, `ui_policy`, `notes`를 그대로 렌더링
- 수용 기준:
  - 플랜 화면의 수치가 서버 응답과 일치한다.
- 테스트:
  - manual API/UI compare

### MVP-B2. `mix` 기반 오늘의 큐 컴파일러

- 목적: 플랜의 문항 비율이 실제 세션 큐를 바꾸게 한다.
- 우선순위: `P1`
- 변경 대상:
  - `packages/backend/src/routes/today.ts`
  - `packages/backend/src/services/card-state-service.ts`
  - 필요 시 신규 서비스 `queue-compiler.ts`
- 구현 방식:
  - `today` 응답 전에 플랜 또는 전략 벡터를 읽어 문항 비율에 맞게 카드 조합
  - `review/new/drill` 우선순위와 비율을 함께 제어
- 수용 기준:
  - 읽기 취약 사용자와 균형형 사용자의 세션 카드 조합이 다르다.
- 테스트:
  - deterministic fixture test

### MVP-B3. `ui_policy` 실제 연결

- 목적: `hint_steps`, `session_chunk_min`, `mini_handwriting`, `show_example_by_default`가 말뿐이 아니게 한다.
- 우선순위: `P1`
- 변경 대상:
  - `packages/mobile/src/screens/SessionScreen.tsx`
- 구현 방식:
  - 힌트 버튼 상한을 정책값으로 제어
  - 세션 길이 초과 시 chunk 종료 또는 휴식 UI 노출
  - `mini_handwriting`이면 형태 취약 카드에 짧은 필기형 입력 추가
- 수용 기준:
  - 플랜 정책값을 바꾸면 세션 UI도 즉시 달라진다.
- 테스트:
  - manual scenario test

### MVP-B4. 실제 `MCQ`, `CLOZE`, `LISTENING` 세션 구현

- 목적: 문서와 타입에 있는 문항 유형을 실제 학습 세션으로 확장한다.
- 우선순위: `P1`
- 변경 대상:
  - `packages/mobile/src/screens/SessionScreen.tsx`
  - `packages/backend` 카드 공급 로직
  - `packages/shared/src/types/*`
- 구현 방식:
  - 문항 renderer를 타입별로 분기
  - 최소 구현 범위: `MCQ`, `CLOZE`
  - `LISTENING`은 콘텐츠 준비 상태를 보고 별도 단계로 분리 가능
- 수용 기준:
  - 세션에서 최소 5개 prompt type을 실제 수행 가능하다.
- 테스트:
  - UI component tests
  - manual learning flow

### MVP-B5. 혼동쌍 드릴 2차 고도화

- 목적: 단순 삽입이 아니라 “왜 틀렸는지”에 맞는 드릴을 제공한다.
- 우선순위: `P1`
- 구현 예시:
  - `READING_CONFUSION` -> 표기→읽기 비교형
  - `FORM_SIMILAR` -> 유사 형태 비교형
  - `MEANING_NEAR` -> 문맥 선택형
- 수용 기준:
  - 드릴은 단순 반복이 아니라 오류 유형별 다른 형식으로 나온다.

---

## Sprint C. 측정 잠금

### MVP-C1. True OEC 정의

- 목적: 리포트와 실험이 같은 장기 기억 지표를 쓰게 한다.
- 우선순위: `P1`
- 정의 초안:
  - `7d_due_recall_rate`
  - `14d_due_recall_rate`
  - `30d_due_recall_rate`
  - `overdue_adjusted_recall_rate`
- 계산 원칙:
  - 카드가 실제 due 된 뒤에 수행된 첫 리뷰를 기준
  - 복습 성공/실패를 구간별로 기록
  - 연체된 리뷰는 별도 보정 지표로 분리
- 수용 기준:
  - 리포트와 실험 대시보드가 동일 필드명을 사용한다.

### MVP-C2. 리포트 스키마 재설계

- 목적: 현재 proxy형 리포트를 운영/실험에서 같이 쓸 수 있게 재구성한다.
- 우선순위: `P1`
- 변경 대상:
  - `packages/backend/src/services/report-service.ts`
  - `packages/shared/src/types/api-contracts.ts`
  - `packages/web/src/pages/ReportPage.tsx`
  - `packages/mobile/src/screens/ReportScreen.tsx`
- 핵심 응답 구조:
  - `summary`
  - `daily_stats`
  - `retention_metrics`
  - `confusion_metrics`
  - `recovery_metrics`
  - `insights`
- 수용 기준:
  - web/mobile/report가 같은 계약으로 렌더링된다.

### MVP-C3. 실험 운영 로그

- 목적: variant 배정이 아니라 실제 정책 적용 여부를 검증한다.
- 우선순위: `P1`
- 추가 로그:
  - `experiment_exposures`
  - `policy_applied`
  - `queue_shape`
  - `ui_policy_snapshot`
- 수용 기준:
  - treatment가 실제로 treatment 정책을 받았는지 추적 가능하다.

### MVP-C4. 회복 지표 추가

- 목적: “연체 회복”을 별도 KPI로 본다.
- 우선순위: `P1`
- 지표:
  - `overdue_backlog_days`
  - `recovery_completion_rate`
  - `recovery_time_to_normal`
  - `post-recovery retention`

---

## Sprint D. 연구형 확장

### MVP-D1. `SM-2 + HLR-lite` 혼합 정책

- 목적: 현재의 안정된 스케줄러를 유지하면서 더 나은 기억 추정을 도입한다.
- 우선순위: `P2`
- 방식:
  - baseline은 `SM-2`
  - `HLR-lite`는 stability 보정치로 먼저 사용
  - 완전 교체는 실험으로만 진행
- 수용 기준:
  - baseline 대비 retention 또는 same-time efficiency 개선

### MVP-D2. 연체 회복 엔진

- 목적: 복습 폭탄을 분산하고 사용자 이탈을 줄인다.
- 우선순위: `P2`
- 출력 예시:
  - 오늘 복습 20장
  - 내일 복습 25장
  - 읽기 취약 카드 우선
  - 신규 카드 3일간 중단

### MVP-D3. 콘텐츠 난이도 모델

- 목적: 사용자 능력과 카드 난이도를 분리한다.
- 우선순위: `P2`
- 후보:
  - item difficulty
  - confusion centrality
  - context transfer difficulty

### MVP-D4. 전이형 학습 세트

- 목적: 카드 암기를 실제 독해/사용 능력으로 연결한다.
- 우선순위: `P2`
- 추가 문항:
  - 예문 cloze
  - 유의어/반의어 구분
  - 미니 독해
  - 상황 기반 어휘 선택

---

## 5. 파일 단위 변경 계획

## Backend

- `routes/auth.ts`
  - 신규 사용자 bootstrap
  - `dev-init` 제한
- `services/card-state-service.ts`
  - idempotency 수정
  - event-time snapshot 반영
- `routes/today.ts`
  - 큐 컴파일러 연결
- `services/report-service.ts`
  - true OEC
  - recovery metrics
- `services/strategy-analyzer.ts`
  - snapshot 기반 lateness 계산
- `services/plan-generator.ts`
  - 실제 세션 정책 출력 강화

## Mobile

- `App.tsx`
  - 사용자별 진단 상태 키
- `screens/PlanScreen.tsx`
  - 서버 플랜 연결
- `screens/SessionScreen.tsx`
  - `ui_policy` 반영
  - 문항 유형 확장
- `screens/ReportScreen.tsx`
  - 새 리포트 계약 반영

## Shared

- `src/types/api-contracts.ts`
  - 단일 계약 소스 강화
- `src/types/review-event.ts`
  - snapshot 필드 확장 시 반영

## Web

- `src/services/api.ts`
  - 계약 통일
- `src/pages/ReportPage.tsx`
  - 실제 응답 구조 반영
- `src/pages/ExperimentsPage.tsx`
  - 실제 타입 반영

---

## 6. 테스트 계획

### 반드시 자동화할 테스트

- `same event replay` integration test
- `new user login -> today available` integration test
- `offline replay -> due update` integration test
- `shared contract typecheck` build gate
- `plan -> session policy` fixture test
- `report true OEC` query test

### 반드시 수동 확인할 플로우

- 모바일 첫 로그인
- 진단 완료 후 플랜 생성
- 읽기 취약 사용자와 일반 사용자 비교
- 오프라인 학습 후 재동기화
- 데이터 삭제 후 재로그인
- 웹 대시보드 3페이지 로드

---

## 7. 지표 목표

### 무결성 지표

- duplicate meaningful update rate = `0`
- anonymous access success rate = `0`
- contract mismatch release count = `0`

### 학습 지표

- `7d_due_recall_rate`
- `14d_due_recall_rate`
- confusion relapse rate
- recovery success rate

### 사용성 지표

- 진단 완료율
- 첫 세션 완료율
- 연체 후 복귀율
- 설명 UI 열람률

---

## 8. 이번 MVP에서 일부러 하지 않을 것

- 화려한 게임화 강화
- AI 생성 콘텐츠 대량 추가
- 추천 문구 고도화만 하고 정책은 그대로 두는 작업
- 연구 지표 없이 알고리즘을 섣불리 교체하는 작업
- `HLR-lite`를 baseline 검증 없이 전면 적용하는 작업

---

## 9. 완료 선언 기준

아래 조건을 모두 만족해야 이번 MVP 완료로 본다.

- 신규 사용자 실사용 경로가 완성됐다.
- 이벤트 무결성 문제가 해결됐다.
- 플랜이 실제 세션에 반영된다.
- true OEC가 리포트와 실험에 공통으로 들어간다.
- web/mobile/backend 계약이 shared 기준으로 일치한다.

---

## 10. 최종 실행 순서

1. `MVP-A1` ~ `MVP-A6`
2. `MVP-B1` ~ `MVP-B5`
3. `MVP-C1` ~ `MVP-C4`
4. `MVP-D1` ~ `MVP-D4`

이 순서를 바꾸면, 겉보기 기능은 늘어나도 실제 학습 시스템으로서의 신뢰는 오히려 낮아질 가능성이 크다.
