# JapaneseLearnApp MVP 실행 파일 (2026-03-07 갱신)

> 목적: 현재 코드 상태를 기준으로 다음 구현 순서를 고정한다.

---

## 이번 패치로 완료된 항목

- `One Event, One ID`
  - 세션 로깅과 `/v1/today/review`가 동일 `event_id`를 사용
- consent bootstrap
  - 앱 시작 시 `/v1/auth/me`를 호출해 동의 상태를 먼저 확인
- 사용자/admin surface 분리
  - 모바일 `ReportScreen`에서 `/v1/report/batch` 제거
  - 웹 `ExperimentsPage`에서 `/v1/experiments/aa-validate` 제거
  - admin client 분리
  - `/admin/operations` 운영 콘솔 분리
- 진단 표준화
  - `/v1/diagnosis/items`, `/v1/diagnosis/submit` 제거
  - v2-only 계약 유지
- 세션 정책 반영
  - `hint_steps` 하드코딩 제거
  - `session_chunk_min` 휴식 화면 연결
  - `mini_handwriting` 엄격 표기 입력 모드 반영
  - `show_example_by_default`는 reserved note로 처리
- 계약/저장소 정리
  - `ReviewEventInput`, `DiagnosisSubmitV2Request`, `DiagnosisResultResponse`, admin contracts 추가
  - source tree generated artifact 제거
  - `check:generated` 스크립트 추가
- 콘텐츠 확장 준비
  - `011_content_metadata.sql` 추가
  - `012_seed_content_metadata.sql`로 샘플 아이템 메타데이터 backfill

---

## 지금 기준의 MVP 정의

다음 5개가 유지되면 MVP는 “잠겨 있다”고 본다.

1. `ReviewEventInput`에는 `user_id`가 없다.
2. 로그인 후 동의 확인이 진단보다 먼저 실행된다.
3. 사용자 화면은 admin endpoint를 호출하지 않는다.
4. 세션은 준비된 6개 live prompt와 실제 `ui_policy`로 동작한다.
5. 빌드 후 source tree에 generated artifact가 생기지 않는다.

---

## 다음 실행 순서

### Sprint E. 운영 분리

- 완료
  - 관리자용 대시보드 surface 추가
  - `aa-validate`, `report/batch`를 사용자 메뉴와 완전히 분리

### Sprint F. 진단 정리

- 완료
  - deprecated 진단 v1 제거
  - v2-only 운영 기준 문서화

### Sprint G. 콘텐츠 확장

- 완료
  - `example_sentence_ja`, `example_sentence_ko`, `audio_ref`, `prompt_payload`를 샘플 카드셋에 채움
  - `TodayCard` 계약과 Today/drill 조회에 메타데이터 연결
  - `013_extended_prompt_cards.sql`로 준비된 카드에 `MCQ/CLOZE/LISTENING` 카드 생성
  - `SessionScreen.tsx`와 `session-policy.ts`가 새 prompt를 실제 세션으로 연결

### Sprint H. 운영 정책

- export API
- 보관 기간 / 삭제 정책 / 운영 문서 확정

---

## 릴리즈 게이트

- `npm run build --workspace=packages/shared`
- `npm test --workspace=packages/backend`
- `npx tsc --noEmit` in `packages/mobile`
- `npm run build --workspace=packages/web`
- `npm run check:generated`
