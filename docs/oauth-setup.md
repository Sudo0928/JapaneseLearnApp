# Google OAuth 2.0 + PKCE 설정 가이드

> **보안 원칙**: 네이티브 앱 OAuth는 외부 브라우저(시스템 브라우저) 기반 사용자 에이전트와 PKCE 적용이 권고된 BCP(RFC 8252)다.  
> 인앱 WebView(WKWebView/WebView) 방식은 피싱 위험으로 Google이 차단한다.

---

## 1. Google Cloud Console 설정

### 1-1. 프로젝트 생성
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성: `japanese-learn-app`

### 1-2. OAuth 동의 화면 설정
1. **APIs & Services → OAuth consent screen**
2. User Type: **External**
3. 앱 이름, 지원 이메일 입력
4. 범위(Scopes) 추가:
   - `openid` (필수)
   - `email` (식별용)
   - `profile` (선택)
5. 테스트 사용자 추가 (개발 중 필요)

### 1-3. OAuth 클라이언트 ID 생성

#### Android 클라이언트
1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. 애플리케이션 유형: **Android**
3. 패키지 이름: `snowdrop.japanese.learn.app`
4. SHA-1 인증서 지문 등록:
   ```bash
   # 개발용 (debug.keystore)
   keytool -keystore ~/.android/debug.keystore -list -v
   # SHA1 값을 복사해서 등록
   ```
5. 생성된 클라이언트 ID를 `EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID`로 저장

#### iOS 클라이언트
1. 애플리케이션 유형: **iOS**
2. Bundle ID: `snowdrop.japanese.learn.app`
3. 생성된 클라이언트 ID를 `EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS`로 저장

#### 웹 클라이언트 (백엔드 토큰 검증용)
1. 애플리케이션 유형: **Web application**
2. 승인된 JavaScript 원본: `http://localhost:3000` (개발용)
3. 승인된 리디렉션 URI: `http://localhost:3000/auth/callback`
4. 클라이언트 ID와 시크릿을 `.env`에 저장

---

## 2. Expo 환경변수 설정

`packages/mobile/.env` 파일 생성:

```env
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
EXPO_PUBLIC_BACKEND_URL=http://localhost:3000
```

`packages/backend/.env` 파일 생성:

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/japanese_learn_dev
PORT=3000
NODE_ENV=development
GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
JWT_SECRET=your-random-secret-at-least-32-chars
JWT_EXPIRES_IN=7d
```

---

## 3. PKCE 흐름 요약

```
[모바일 앱]                          [Google]              [백엔드]
    |                                    |                     |
    |─ code_verifier 생성 ─────────────▶|                     |
    |─ code_challenge = SHA256(verifier) |                     |
    |                                    |                     |
    |─ 외부 브라우저 열기 ──────────────▶|                     |
    |  (authorization_endpoint           |                     |
    |   + code_challenge 포함)           |                     |
    |                                    |                     |
    |◀── 인증 완료 → authorization_code ─|                     |
    |    (딥링크로 앱으로 복귀)          |                     |
    |                                    |                     |
    |─ POST /token ──────────────────────▶|                    |
    |  (code + code_verifier)            |                     |
    |                                    |                     |
    |◀── id_token + access_token ────────|                     |
    |                                    |                     |
    |─ POST /v1/auth/google ─────────────────────────────────▶|
    |  (id_token)                        |                     |
    |                                    |                     |
    |◀── app_token (JWT) ────────────────────────────────────|
    |    (app_token을 Keychain에 저장)   |                     |
```

---

## 4. 보안 체크리스트 (RFC 8252 / RFC 9700 / OWASP)

- [x] 외부 브라우저 사용 (인앱 WebView 금지)
- [x] PKCE code_challenge_method = S256
- [x] state 파라미터로 CSRF 방지
- [x] 토큰은 Keychain(iOS) / Keystore(Android)에 저장
- [x] plaintext 저장 금지
- [x] app_token 만료 설정 (7일)
- [x] 백엔드에서 id_token audience 검증
- [x] 디버그 빌드와 프로덕션 빌드 분리
