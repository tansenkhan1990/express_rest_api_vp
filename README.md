# Express Auth API

A production-ready REST API built with **Express.js**, **TypeScript**, and **MongoDB** featuring JWT authentication via **httpOnly cookies** with automatic **token rotation**.

## Features

- 🔐 **Register** — `POST /api/auth/register`
- 🔑 **Login** — `POST /api/auth/login` (sets httpOnly cookies, no manual token handling)
- 🔄 **Refresh Token** — `POST /api/auth/refresh` (automatic token rotation via cookies)
- 🚪 **Logout** — `POST /api/auth/logout` (clears cookies, invalidates refresh token)
- 🛡️ **Protected Routes** — `GET /api/protected/profile`, `GET /api/protected/dashboard`
- 🍪 **httpOnly Cookies** — Tokens stored in secure, JS-inaccessible cookies
- ✅ **Zod Validation** — Request body validation with structured error responses
- 🚦 **Rate Limiting** — 20 requests per 15 min window on auth routes
- 📝 **HTTP Logging** — Morgan for request logging (dev/prod formats)
- 🗜️ **Compression** — Gzip response compression
- 🔒 **Security Headers** — Helmet for secure HTTP headers
- ⏱️ **Token Expiry** — Configurable JWT expiration (default: 15 min access, 7 days refresh)
- 🔄 **Token Rotation** — Old refresh tokens revoked on refresh (prevents replay)
- 🧹 **Auto-expiry** — MongoDB TTL index automatically removes expired refresh tokens
- 🛑 **Graceful Shutdown** — Handles SIGTERM/SIGINT, closes MongoDB cleanly

## Architecture

```
express_rest_api_vp/
├── src/
│   ├── config/
│   │   └── db.ts              # MongoDB connection with event handlers
│   ├── controllers/
│   │   └── authController.ts  # Register, login, refresh, logout logic
│   ├── middleware/
│   │   └── auth.ts            # Cookie-based JWT authentication middleware
│   ├── models/
│   │   ├── User.ts            # User schema (bcrypt password hashing)
│   │   └── RefreshToken.ts    # Refresh token schema (with TTL index)
│   ├── routes/
│   │   ├── auth.ts            # Public auth routes + Zod validation
│   │   └── private.ts         # Protected routes
│   ├── types/
│   │   └── express.ts         # Shared type declarations (AuthRequest)
│   ├── utils/
│   │   ├── tokens.ts          # JWT generation, verification, revocation
│   │   ├── validate.ts        # Zod validation middleware
│   │   └── AppError.ts        # Custom operational error class
│   └── index.ts               # App entry point + middleware stack
├── .env.example               # Environment variable template
├── .eslintrc.json             # ESLint config (TypeScript)
├── .prettierrc                # Prettier config
├── package.json
├── tsconfig.json
└── README.md
```

## Prerequisites

- **Node.js** >= 18
- **MongoDB** (local or Atlas — free tier works)
- **npm**

## Getting Started

### 1. Install

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:3000

MONGO_URI=mongodb://localhost:27017/express-auth

ACCESS_TOKEN_SECRET=your_access_token_secret_here
ACCESS_TOKEN_EXPIRY=15m

REFRESH_TOKEN_SECRET=your_refresh_token_secret_here
REFRESH_TOKEN_EXPIRY=7d
```

> Generate secure secrets:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### 3. Run

```bash
# Development (nodemon + ts-node, auto-restart)
npm run dev

# Production
npm run build
npm start
```

## API Reference

All auth tokens are managed via **httpOnly cookies** — your client just needs to include credentials. In `fetch`, set `credentials: "include"`. In axios, set `withCredentials: true`.

### Public Routes

#### 1. Register — `POST /api/auth/register`

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "securepass123"}'
```

**Response (201):**
```json
{
  "success": true,
  "message": "Account created successfully.",
  "data": {
    "userId": "60f7b1c0a1b2c3d4e5f6a7b8",
    "email": "user@example.com"
  }
}
```

**Error (409) — duplicate email:**
```json
{
  "success": false,
  "message": "An account with this email already exists."
}
```

---

#### 2. Login — `POST /api/auth/login`

Sets `accessToken` (15 min) and `refreshToken` (7 days) as httpOnly cookies.

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email": "user@example.com", "password": "securepass123"}'
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user": {
      "userId": "60f7b1c0a1b2c3d4e5f6a7b8",
      "email": "user@example.com"
    }
  }
}
```

The `Set-Cookie` headers will include `accessToken` and `refreshToken`.

---

#### 3. Refresh Token — `POST /api/auth/refresh`

Reads `refreshToken` from the cookie, validates it, and rotates both tokens. Use `-b cookies.txt -c cookies.txt` to send and receive cookies with curl.

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -b cookies.txt -c cookies.txt
```

**Response (200):**
```json
{
  "success": true,
  "message": "Tokens refreshed successfully."
}
```

New `accessToken` and `refreshToken` cookies are set automatically.

---

#### 4. Logout — `POST /api/auth/logout`

Clears both cookies and revokes the refresh token in the database.

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt -c cookies.txt
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully."
}
```

---

### Protected Routes (cookie-based)

Protected routes read the `accessToken` from the httpOnly cookie automatically. No `Authorization` header needed.

#### Get Profile — `GET /api/protected/profile`

```bash
curl -X GET http://localhost:3000/api/protected/profile \
  -b cookies.txt
```

**Response (200):**
```json
{
  "success": true,
  "message": "This is a protected route.",
  "data": {
    "userId": "60f7b1c0a1b2c3d4e5f6a7b8",
    "timestamp": "2025-03-17T12:00:00.000Z"
  }
}
```

#### Get Dashboard — `GET /api/protected/dashboard`

```bash
curl -X GET http://localhost:3000/api/protected/dashboard \
  -b cookies.txt
```

---

### Full cURL Flow

```bash
# 1. Register
curl -X POST localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secret123"}'

# 2. Login (saves cookies)
curl -X POST localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@example.com","password":"secret123"}'

# 3. Access protected route
curl localhost:3000/api/protected/profile -b cookies.txt

# 4. Refresh tokens
curl -X POST localhost:3000/api/auth/refresh -b cookies.txt -c cookies.txt

# 5. Logout
curl -X POST localhost:3000/api/auth/logout -b cookies.txt -c cookies.txt
```

---

### Health Check

```bash
curl http://localhost:3000/api/health
```

```json
{
  "success": true,
  "message": "API is running",
  "timestamp": "2025-03-17T12:00:00.000Z"
}
```

## Authentication Flow

```
┌──────────┐           ┌──────────┐           ┌──────────┐
│  Client  │           │  Server  │           │ MongoDB  │
└────┬─────┘           └────┬─────┘           └────┬─────┘
     │                      │                      │
     │  POST /login         │                      │
     │  {email, password}   │                      │
     │─────────────────────>│                      │
     │                      │  Find user + verify  │
     │                      │─────────────────────>│
     │                      │<─────────────────────│
     │  Set-Cookie:          │                      │
     │   accessToken (httpOnly, 15min)              │
     │   refreshToken (httpOnly, 7d, /api/auth)     │
     │<─────────────────────│                      │
     │                      │                      │
     │  GET /protected/profile                      │
     │  Cookie: accessToken │                      │
     │─────────────────────>│                      │
     │                      │  Verify JWT          │
     │  200 OK              │                      │
     │<─────────────────────│                      │
     │                      │                      │
     │  POST /refresh       │                      │
     │  Cookie: refreshToken│                      │
     │─────────────────────>│                      │
     │                      │  Rotate tokens,      │
     │                      │  revoke old refresh  │
     │  Set-Cookie: new tokens                     │
     │<─────────────────────│                      │
     │                      │                      │
     │  POST /logout        │                      │
     │  Cookie: refreshToken│                      │
     │─────────────────────>│                      │
     │                      │  Revoke + clear      │
     │  Clear-Cookie        │  cookies             │
     │<─────────────────────│                      │
```

## Cookie Details

| Cookie | httpOnly | secure | sameSite | path | maxAge |
|--------|----------|--------|----------|------|--------|
| `accessToken` | ✅ | prod only | `lax` | `/` | 15 min |
| `refreshToken` | ✅ | prod only | `lax` | `/api/auth` | 7 days |

- `secure` is enabled automatically in production (`NODE_ENV=production`)
- `refreshToken` is scoped to `/api/auth` so it's only sent on refresh/logout requests
- CORS `credentials: true` is enabled — clients must use `withCredentials`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (`development` / `production`) | `development` |
| `PORT` | Server port | `3000` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |
| `MONGO_URI` | MongoDB connection string | Required |
| `ACCESS_TOKEN_SECRET` | Secret for signing access tokens | Required |
| `ACCESS_TOKEN_EXPIRY` | Access token lifespan | `15m` |
| `REFRESH_TOKEN_SECRET` | Secret for signing refresh tokens | Required |
| `REFRESH_TOKEN_EXPIRY` | Refresh token lifespan | `7d` |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled JS in production |
| `npm run lint` | Run ESLint on `src/` |
| `npm run format` | Format code with Prettier |

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| **Express.js** | HTTP server & routing |
| **TypeScript** | Type safety |
| **Mongoose** | MongoDB ODM |
| **cookie-parser** | Parse httpOnly cookies |
| **helmet** | Secure HTTP headers |
| **cors** | Cross-origin requests |
| **express-rate-limit** | Rate limiting |
| **morgan** | HTTP request logging |
| **compression** | Gzip response compression |
| **zod** | Request body validation |
| **jsonwebtoken** | JWT signing & verification |
| **bcryptjs** | Password hashing |
| **dotenv** | Environment variable loading |
| **express-async-errors** | Async error handling |

## Error Handling

- **Zod validation errors** — 400 with structured field-level messages
- **Duplicate email** — 409 on registration
- **Invalid credentials** — 401 (same message for bad email or password)
- **Expired access token** — 401 with hint to use `/refresh`
- **Invalid/expired refresh token** — 401
- **Rate limit exceeded** — 429
- **Unhandled errors** — 500 (safe messages in production)
