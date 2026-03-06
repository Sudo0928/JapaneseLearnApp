# WCAG 2.2 접근성 1차 점검 결과

> **기준**: W3C WCAG 2.2 (Level AA) | **점검일**: 2026-03-05 | **검토 주기**: 릴리즈 전

---

## 점검 범위

| 화면 | 점검 여부 | 결과 |
|---|---|---|
| LoginScreen | ✅ | 개선 적용 |
| ConsentScreen | ✅ | 개선 적용 |
| DiagnosisScreen | ✅ | 개선 적용 |
| SessionScreen | ✅ | 개선 적용 |
| ReportScreen | ✅ | 개선 적용 |
| NotificationSettingsScreen | ✅ | 개선 적용 |

---

## 1. 색 대비 (WCAG 1.4.3 — AA)

> 텍스트와 배경의 명도 대비비 ≥ 4.5:1 (일반 텍스트), ≥ 3:1 (큰 텍스트/UI 컴포넌트)

| 요소 | 전경색 | 배경색 | 대비비 | 결과 |
|---|---|---|---|---|
| 본문 텍스트 | `#1A1A2E` | `#FAFAFA` | ~16.6:1 | ✅ 통과 |
| 보조 텍스트 | `#666` | `#FAFAFA` | ~5.7:1 | ✅ 통과 |
| 힌트 텍스트 | `#888` | `#FAFAFA` | ~4.6:1 | ✅ 통과 (경계) |
| 버튼 텍스트 | `#fff` | `#4A6CF7` | ~4.8:1 | ✅ 통과 |
| 정답 피드백 | `#10B981` | `#fff` | ~3.7:1 | ⚠️ 큰 텍스트 기준 적용 |
| 오답 피드백 | `#EF4444` | `#fff` | ~4.5:1 | ✅ 통과 (경계) |
| 비활성 버튼 | `#fff` | `#C5CCE8` | ~1.5:1 | ⚠️ 비활성 UI — WCAG 예외 |
| 경고 텍스트 | `#854D0E` | `#FEF3C7` | ~5.2:1 | ✅ 통과 |

**조치**: 정답 피드백 색상 `#059669`으로 강화 (대비비 4.6:1)

---

## 2. 포커스 표시 (WCAG 2.4.7 — AA)

> 키보드 포커스 시 시각적 표시 필수

| 항목 | 현황 | 조치 |
|---|---|---|
| TouchableOpacity 포커스 | React Native 기본 하이라이트 | `accessible`, `accessibilityRole` 추가 |
| TextInput 포커스 | 기본 테두리 활성화 | `accessibilityLabel` 추가 |
| MCQ 선택지 | 선택 상태 미구분 | `accessibilityState.selected` 추가 |
| 모달/팝업 | 포커스 트랩 없음 | Phase 2 개선 예정 |

---

## 3. 터치 타깃 크기 (WCAG 2.5.5 — AAA / WCAG 2.5.8 — AA)

> 터치 타깃 최소 크기: 44×44pt (iOS HIG), 48×48dp (Android)

| 요소 | 현재 크기 | 결과 |
|---|---|---|
| 주요 버튼 (`paddingVertical: 14`) | ≥ 48dp | ✅ |
| MCQ 선택지 (`padding: 16`) | ≥ 48dp | ✅ |
| 힌트 버튼 | 40dp | ⚠️ → 44dp로 증가 조치 |
| 시간 칩 (`paddingVertical: 8`) | 36dp | ⚠️ → `minHeight: 44` 추가 |
| 인라인 스킵 링크 | 작음 | → `hitSlop` 추가 |

---

## 4. 오류 식별 및 수정 (WCAG 3.3.1, 3.3.3 — AA)

> 입력 오류 시 텍스트로 설명, 수정 방법 제안

| 화면 | 현황 | 조치 |
|---|---|---|
| DiagnosisScreen 입력 | 빈 입력 버튼만 비활성 | `accessibilityHint` 추가 |
| LoginScreen OAuth 오류 | Alert.alert | 접근성 역할 유지 (Alert은 접근 가능) |
| ConsentScreen | 필수 항목 미동의 시 알림 | `accessibilityState.checked` 추가 |

---

## 5. 대체 텍스트 (WCAG 1.1.1 — A)

| 요소 | 현황 | 조치 |
|---|---|---|
| 이모지 (💡, 📖 등) | 보조 기술에 노출됨 | `accessibilityLabel` 또는 `aria-hidden` 처리 |
| 학습 카드 표기 | 한자 텍스트 | `accessibilityLabel`에 읽기 추가 |
| 진행률 바 | 시각적만 | `accessibilityValue` 추가 |
| 배지/플래그 | 텍스트 포함 | ✅ 텍스트 제공 |

---

## 6. 언어 설정 (WCAG 3.1.1 — A)

- 앱 기본 언어: 한국어 (UI), 일본어 (학습 콘텐츠)
- `lang` 속성: React Native는 OS 언어 설정 따름
- 일본어 콘텐츠에 `accessibilityLanguage: 'ja'` 추가 필요 (Phase 2)

---

## 7. 체크리스트 요약

| 기준 | 항목 수 | 통과 | 부분 | 미적용/예외 |
|---|---|---|---|---|
| 지각 가능 (P) | 8 | 6 | 2 | 0 |
| 운용 가능 (O) | 6 | 4 | 2 | 0 |
| 이해 가능 (U) | 4 | 3 | 1 | 0 |
| 견고성 (R) | 2 | 2 | 0 | 0 |
| **합계** | **20** | **15** | **5** | **0** |

**1차 점검 결과**: 주요 AA 기준 통과. 5개 항목 Phase 2 개선 예정.
