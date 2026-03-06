# JapaneseLearnApp

일본어 한자·단어 암기를 어려워하는 사용자를 위한 개인화 학습 앱입니다.

핵심 목표는 단순히 문제를 많이 푸는 것이 아니라, 사용자별 학습 행동 데이터를 바탕으로 언제 무엇을 어떻게 복습해야 하는지 조정하여 장기 기억 유지율을 높이는 것입니다.

## 핵심 원칙

- 간격 반복(SRS) 중심 복습
- 인출 연습 기반 문항 설계
- 학습 스타일이 아닌 행동 데이터 기반 개인화
- 오프라인 학습과 동기화를 전제로 한 모바일 우선 설계
- OAuth, 데이터 최소 수집, 동의 분리 등 보안 및 개인정보 보호 우선

## 기술 스택

- 모바일: React Native + Expo SDK 52
- 백엔드: Node.js + Express + TypeScript
- 웹 대시보드: React + Vite + TypeScript
- 데이터베이스: PostgreSQL
- 로컬 저장: expo-sqlite
- 인증: Google OAuth 2.0 + PKCE
- 저장소 구조: npm workspaces 기반 모노레포

## 저장소 구조

```text
.
├─ packages/
│  ├─ backend/   # API, 스케줄러, 인증, 리포트, 배치 로직
│  ├─ mobile/    # Expo 모바일 앱
│  ├─ shared/    # 공용 타입, 스키마, 계약
│  └─ web/       # 웹 대시보드
├─ migrations/   # PostgreSQL 마이그레이션
├─ docs/         # 설계, 보안, 운영, 백로그 문서
├─ PROGRESS.md   # 진행 기록 및 다음 작업
└─ LICENSE       # 독점 사용 금지 라이선스
```

## 현재 구현 상태

현재까지 구현된 주요 범위:

- ReviewEvent 스키마와 계측 로깅
- 오프라인 SQLite 큐 및 동기화
- SM-2 기반 기본 스케줄링
- 오늘 할 일 API와 복습 제출 흐름
- Google OAuth + PKCE 인증
- 동의 화면 및 secure storage
- 진단 테스트와 기본 개인화 플랜 생성
- 주간 리포트, 알림, 실험 플래그 프레임워크
- 웹 대시보드 기본 화면

현재 우선 과제:

- 온라인/오프라인 `event_id` 단일성 보장
- 인증 경계 통일
- 오프라인 ingest 이후 서버 스케줄 재적용
- 데이터 삭제/철회 기능
- 웹-백엔드 API 계약 정합성 보완

자세한 진행 내역은 `PROGRESS.md`를 참고하세요.

## 시작 방법

### 요구 사항

- Node.js 20 이상
- npm 10 이상
- PostgreSQL
- Expo 실행 환경

### 설치

```bash
npm install
```

### 개발 서버 실행

백엔드:

```bash
npm run backend
```

모바일 앱:

```bash
npm run mobile
```

모바일 웹 미리보기:

```bash
npm run web
```

웹 대시보드:

```bash
npm run dashboard
```

테스트:

```bash
npm test
```

## 환경 변수

실제 환경 변수 파일은 커밋하지 않습니다.

- `packages/backend/.env`
- `packages/mobile/.env`

예시 파일이 있다면 그것을 복사해서 사용하세요. 민감한 키, OAuth 시크릿, 토큰, DB 접속 정보는 절대 저장소에 올리지 마세요.

## 관련 문서

- `PROGRESS.md`: 진행 상황, 완료 항목, 다음 작업
- `docs/implementation-audit-and-dev-plan.md`: 구현 감사 리포트 및 개발 로드맵
- `docs/backlog.csv`: 작업 백로그
- `docs/oauth-setup.md`: OAuth / PKCE 설정 가이드
- `docs/backup-runbook.md`: 백업 및 복구 절차
- `docs/accessibility-checklist.md`: 접근성 점검 내용

## 라이선스

이 프로젝트는 오픈소스가 아닙니다.

저장소의 소스코드와 산출물은 저작권자에게 귀속되며, 명시적인 서면 허가 없이 사용, 복제, 수정, 배포, 배포형 운영 또는 2차 저작물 작성이 허용되지 않습니다.

자세한 내용은 `LICENSE` 파일을 확인하세요.
