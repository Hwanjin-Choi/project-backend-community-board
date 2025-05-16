import express from "express";
import bodyParser from "body-parser";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import cors from "cors";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, "db.json");

const adapter = new JSONFile(dbPath);
const defaultData = { users: [] };
const db = new Low(adapter, defaultData);

await db.read();

const app = express();
const PORT = 8080;

const JWT_SECRET = "your-jwt-secret-key";

const googleClient = new OAuth2Client(
  "222916844324-m2qo0e6eu062eoi41sav1traftk9d0kd.apps.googleusercontent.com"
);

const GITHUB_CLIENT_ID = "Iv23liIYZY7iivOu0ps8";
const GITHUB_CLIENT_SECRET = "1cd3feeeeb437d2a4389faa8e6891836edd8c54b";
const GITHUB_REDIRECT_URI = "http://localhost:9000/auth/github/callback";

app.use(cors());
app.use(bodyParser.json());

app.post("/register", async (req, res) => {
  const { username, password, nickname } = req.body;

  if (!username || !password || !nickname) {
    return res.status(400).json({ error: "모든 필드를 입력해주세요." });
  }

  // 이미 존재하는 아이디 또는 이메일 확인
  const existingUser = db.data.users.find((user) => user.username === username);
  if (existingUser) {
    return res
      .status(409)
      .json({ error: "이미 사용 중인 아이디 또는 이메일입니다." });
  }

  db.data.users.push({ id: Date.now(), username, password, nickname });
  await db.write();

  res.status(201).json({ message: "회원가입 성공" });
});

// 로그인 API
app.get("/login", async (req, res) => {
  const { username, password } = req.query;

  if (!username || !password) {
    return res.status(400).json({ error: "아이디와 비밀번호를 입력해주세요." });
  }

  const user = db.data.users.find(
    (u) => u.username === username && u.password === password
  );

  if (user) {
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      message: "로그인 성공",
      token,
      nickname: user.nickname,
    });
  } else {
    res
      .status(401)
      .json({ error: "아이디 또는 비밀번호가 일치하지 않습니다." });
  }
});

// Google 로그인/회원가입 API
app.post("/auth/google", async (req, res) => {
  try {
    const { token, email, name, picture } = req.body;

    // 토큰 검증
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience:
        "222916844324-m2qo0e6eu062eoi41sav1traftk9d0kd.apps.googleusercontent.com",
    });

    const payload = ticket.getPayload();

    let user = db.data.users.find((u) => u.email === email);

    if (!user) {
      const username = email.split("@")[0];
      const password = Math.random().toString(36).slice(-8);

      user = {
        id: Date.now(),
        username,
        email,
        password,
        nickname: name,
        picture,
      };

      db.data.users.push(user);
      await db.write();
    }

    // JWT 토큰 생성
    const jwtToken = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: "로그인 성공",
      token: jwtToken,
      nickname: user.nickname,
    });
  } catch (error) {
    console.error("Google 인증 오류:", error);
    res.status(500).json({ error: "Google 인증 중 오류가 발생했습니다." });
  }
});

// GitHub OAuth 로그인 페이지로 리다이렉트
app.get("/auth/github", (req, res) => {
  const { state } = req.query;
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${GITHUB_REDIRECT_URI}&scope=user,user:email&state=${state}`;
  res.redirect(githubAuthUrl);
});

// GitHub OAuth 콜백 처리
app.get("/auth/github/callback", async (req, res) => {
  const { code, state } = req.query;

  try {
    // 액세스 토큰 요청
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_REDIRECT_URI,
        state,
      },
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!tokenResponse.data.access_token) {
      console.error("GitHub 토큰 응답 오류:", tokenResponse.data);
      return res.redirect(
        "http://localhost:3000/login-page?error=GitHub 인증 토큰을 받지 못했습니다."
      );
    }

    const accessToken = tokenResponse.data.access_token;

    // 사용자 정보 요청
    const userResponse = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    const { login, name, avatar_url, email } = userResponse.data;

    // 이메일 정보가 사용자 정보에 포함되어 있는지 확인
    let primaryEmail = email;

    // 이메일 정보가 없는 경우 이메일 API를 통해 가져오기 시도
    if (!primaryEmail) {
      try {
        const emailResponse = await axios.get(
          "https://api.github.com/user/emails",
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.github.v3+json",
            },
          }
        );

        // 기본 이메일 찾기
        const primaryEmailObj = emailResponse.data.find(
          (email) => email.primary
        );

        if (primaryEmailObj) {
          primaryEmail = primaryEmailObj.email;
        } else if (emailResponse.data.length > 0) {
          // 기본 이메일이 없으면 첫 번째 이메일 사용
          primaryEmail = emailResponse.data[0].email;
        }
      } catch (emailError) {
        console.error("이메일 정보 가져오기 실패:", emailError);
        // 이메일 정보를 가져오지 못한 경우 사용자명으로 이메일 생성
        primaryEmail = `${login}@github.com`;
      }
    }

    // 사용자 확인 또는 생성
    let user = db.data.users.find((u) => u.email === primaryEmail);

    if (!user) {
      // 새 사용자 생성
      const username = login;
      const password = Math.random().toString(36).slice(-8); // 랜덤 비밀번호 생성

      user = {
        id: Date.now(),
        username,
        email: primaryEmail,
        password,
        nickname: name || login,
        picture: avatar_url,
      };

      db.data.users.push(user);
      await db.write();
    }

    // JWT 토큰 생성
    const jwtToken = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 프론트엔드로 리다이렉트 (토큰과 state 포함)
    res.redirect(
      `http://localhost:3000/auth/github/callback?token=${jwtToken}&nickname=${encodeURIComponent(
        user.nickname
      )}&state=${state}`
    );
  } catch (error) {
    console.error("GitHub 인증 오류:", error);
    let errorMessage = "GitHub 인증 중 오류가 발생했습니다.";

    if (error.response) {
      console.error("GitHub API 응답 오류:", error.response.data);
      if (error.response.status === 403) {
        errorMessage =
          "GitHub API 접근 권한이 없습니다. 스코프 설정을 확인해주세요.";
      }
    }

    res.redirect(
      `http://localhost:3000/login-page?error=${encodeURIComponent(
        errorMessage
      )}&state=${state}`
    );
  }
});

app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
