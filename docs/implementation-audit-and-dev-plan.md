# 구현 감사 리포트 + 개발 로드맵 (2026-03-07 갱신)

> 기준: `.cursor/rules/guide.mdc`, `.cursor/rules/report.mdc`, 현재 저장소 실제 코드, 최신 테스트/빌드 결과

---

## 요약

- 백엔드와 모바일의 핵심 폐루프는 현재 동작한다.
  `학습 이벤트 -> review_log/card_state -> plan -> today queue -> session -> report`
- 이번 안정화 패치로 아래 항목은 구현 완료로 본다.
  - deprecated 진단 v1 public route 제거
  - 관리자용 운영 콘솔 분리(`/admin/operations`)
  - `One Event, One ID`
  - `/v1/events`, `/v1/today`, `/v1/today/review` 인증 경계
  - `DELETE /v1/auth/me` 기반 DSR 삭제
  - `GET /v1/auth/me` 기반 consent bootstrap
  - `shared` 공용 계약 강화
  - 사용자 surface에서 admin endpoint 제거
  - source tree generated artifact 제거
- 남은 핵심 갭은 “무결성”보다 “운영 성숙도”에 가깝다.
  - export API와 운영 정책 확정
  - 관리자용 운영 콘솔 인증 UX는 완료되었고, 남은 작업은 export/retention policy다.

---

## 현재 평가

| 영역 | 상태 | 근거 |
|---|---|---|
| 이벤트 무결성 | 강함 | 모바일은 `ReviewEventInput`으로 큐 저장, 서버가 `user_id` 주입, 동일 `event_id` 재사용 |
| 인증/동의 경계 | 강함 | `App.tsx`가 토큰 확인 뒤 `/v1/auth/me`를 호출해 consent 우선 흐름을 결정 |
| 세션 실행 연결 | 중상 | `hint_steps`, `session_chunk_min`, `mini_handwriting`가 실제 세션에 반영됨 |
| 계약 정합성 | 중상 | `packages/shared`에 public/admin 타입 분리, 웹 public API에서 admin 호출 제거 |
| 실험/운영 경계 | 강함 | 사용자 `ExperimentsPage`는 배정만 노출, `/admin/operations`에서만 운영 작업 실행 |
| 콘텐츠 확장성 | 강함 | `011/012/013` 마이그레이션으로 예문/audio/prompt_payload와 `MCQ/CLOZE/LISTENING` 카드가 연결됐고, `SessionScreen`이 준비된 카드만 실제로 렌더링 |
| 문서/운영 진실원 | 중상 | 본 문서, `docs/mvp-execution-file.md`, `PROGRESS.md`, `README.md`, `docs/backlog.csv` 갱신 |

---

## 이번 패치에서 확정된 원칙

### 1. 이벤트 계약

- 공개 요청 계약은 `ReviewEventInput`이다.
- `user_id`는 클라이언트가 보내지 않는다.
- 서버 저장 계약은 `ReviewEvent`이며, `user_id`는 인증 정보에서만 채운다.

### 2. 사용자/관리자 경계

- 사용자 화면은 `assignments`, `weekly report`, `today`만 사용한다.
- `aa-validate`, `report/batch` 같은 운영 도구는 admin 전용 계약과 client로 분리한다.

### 3. 세션 지원 범위

- 현재 live prompt는 준비된 카드에 한해 `SURFACE_TO_MEANING`, `SURFACE_TO_READING`, `MEANING_TO_SURFACE`, `MCQ`, `CLOZE`, `LISTENING` 6종을 지원한다.
- `session-policy.ts`가 prompt별 readiness를 검사해 미준비 카드는 session surface에 올리지 않는다.

---

## 남은 우선순위

### P1

- 없음
  - 관리자용 운영 콘솔 인증 UX 완료

### P2

- export API / 보관 정책
  - `GET /v1/user/export`와 데이터 보관 기간 운영 규칙 확정

---

## 검증 상태

- `npm run build --workspace=packages/shared` 통과
- `npm test --workspace=packages/backend` 통과
- `npx tsc --noEmit` in `packages/mobile` 통과
- `npm run build --workspace=packages/web` 통과
- `npm run check:generated`는 source tree generated artifact 제거 후 기준 검증에 사용
