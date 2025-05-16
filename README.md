# Community Board Backend

이 프로젝트는 커뮤니티 보드의 백엔드 서버입니다. 사용자 인증, 게시물 관리 등의 기능을 제공합니다.

## 기능

- 사용자 등록 및 로그인
- Google OAuth 인증
- GitHub OAuth 인증
- JWT 토큰 기반 인증

## 설치 및 실행

1. 필요한 패키지 설치:

```bash
npm install
```

2. 서버 실행:

```bash
npm start
```

서버는 기본적으로 http://localhost:9000 에서 실행됩니다.

## Google OAuth 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속합니다.
2. 새 프로젝트를 생성하거나 기존 프로젝트를 선택합니다.
3. "API 및 서비스" > "사용자 인증 정보"로 이동합니다.
4. "사용자 인증 정보 만들기" > "OAuth 클라이언트 ID"를 선택합니다.
5. 애플리케이션 유형으로 "웹 애플리케이션"을 선택합니다.
6. 승인된 JavaScript 원본에 `http://localhost:3000`을 추가합니다.
7. 승인된 리디렉션 URI에 `http://localhost:3000`을 추가합니다.
8. 클라이언트 ID와 클라이언트 보안 비밀을 복사합니다.
9. `server.mjs` 파일에서 `googleClient` 변수의 클라이언트 ID를 업데이트합니다.
10. 프론트엔드의 `App.js` 파일에서 `GoogleOAuthProvider`의 `clientId` 속성을 업데이트합니다.

## GitHub OAuth 설정

1. [GitHub Developer Settings](https://github.com/settings/developers)에 접속합니다.
2. "OAuth Apps" > "New OAuth App"을 클릭합니다.
3. 애플리케이션 이름, 홈페이지 URL, 애플리케이션 설명을 입력합니다.
4. 승인 콜백 URL에 `http://localhost:9000/auth/github/callback`을 입력합니다.
5. "Register application"을 클릭합니다.
6. 클라이언트 ID와 클라이언트 보안 비밀을 복사합니다.
7. `server.mjs` 파일에서 `GITHUB_CLIENT_ID`와 `GITHUB_CLIENT_SECRET` 변수를 업데이트합니다.

## API 엔드포인트

### 회원가입

- **URL**: `/register`
- **메서드**: `POST`
- **요청 본문**:
  ```json
  {
    "username": "사용자명",
    "email": "이메일",
    "password": "비밀번호",
    "nickname": "닉네임"
  }
  ```
- **응답**:
  ```json
  {
    "message": "회원가입 성공"
  }
  ```

### 로그인

- **URL**: `/login`
- **메서드**: `GET`
- **쿼리 파라미터**:
  - `username`: 사용자명 또는 이메일
  - `password`: 비밀번호
- **응답**:
  ```json
  {
    "message": "로그인 성공",
    "token": "JWT 토큰",
    "nickname": "닉네임"
  }
  ```

### Google 로그인/회원가입

- **URL**: `/auth/google`
- **메서드**: `POST`
- **요청 본문**:
  ```json
  {
    "token": "Google ID 토큰",
    "email": "이메일",
    "name": "이름",
    "picture": "프로필 사진 URL"
  }
  ```
- **응답**:
  ```json
  {
    "message": "로그인 성공",
    "token": "JWT 토큰",
    "nickname": "닉네임"
  }
  ```

### GitHub 로그인/회원가입

- **URL**: `/auth/github`
- **메서드**: `GET`
- **설명**: GitHub OAuth 페이지로 리다이렉트합니다.

### GitHub 콜백

- **URL**: `/auth/github/callback`
- **메서드**: `GET`
- **설명**: GitHub OAuth 콜백을 처리하고 프론트엔드로 리다이렉트합니다.
