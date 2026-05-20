# Express Auth API

A production-ready REST API built with **Express.js**, **TypeScript**, and **MongoDB** featuring JWT authentication via **httpOnly cookies** with automatic **token rotation**.

## 🚀 Quick Start

### With Docker (recommended — zero setup)

```bash
# Development mode (hot reload, no .env needed)
docker compose --profile dev up --build

# Production mode (needs .env with real secrets)
cp .env.example .env   # edit with your secrets first
docker compose --profile prod up -d --build
```

That's it. MongoDB is included. Server runs on **http://localhost:3000**.

### Without Docker

```bash
cp .env.example .env   # edit with your MongoDB URI + secrets
npm install
npm run dev            # → http://localhost:3000
```

> **Prerequisites:** Node.js ≥ 18 + MongoDB running locally (or use the Docker option which bundles everything).

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
├── Dockerfile                 # Multi-stage Docker build
├── .dockerignore              # Docker build exclusions
├── docker-compose.yml         # Docker Compose (MongoDB + API)
├── package.json
├── tsconfig.json
└── README.md
```

## Prerequisites

- **Node.js** >= 18 (or **Docker**)
- **MongoDB** (local, Atlas, or Docker)
- **npm**

## Getting Started

### Option A: Local (Node.js)

#### 1. Install

```bash
npm install
```

#### 2. Configure Environment

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

#### 3. Run

```bash
# Development (nodemon + ts-node, auto-restart)
npm run dev

# Production
npm run build
npm start
```

### Option B: Docker Compose

No local Node.js or MongoDB install needed — everything runs in containers.

#### Development (hot reload)

```bash
# Start MongoDB + dev API with hot reload
# Dev secrets are auto-provided; no .env needed
docker compose --profile dev up --build

# Stop
Ctrl+C
docker compose --profile dev down
```

Changes to `src/` trigger automatic restart thanks to the mounted volume and nodemon.

#### Production

```bash
# Copy and configure environment (secrets are required)
cp .env.example .env
# Edit .env with your actual secrets

# Start MongoDB + production API
docker compose --profile prod up -d --build

# Check logs
docker compose logs -f app

# Stop
docker compose --profile prod down
```

#### Useful Commands

```bash
# Start only MongoDB (run API locally)
docker compose up -d mongo

# View logs for a specific service
docker compose logs -f app-dev

# Rebuild and restart
docker compose --profile dev up --build --force-recreate

# Tear down everything including volumes
docker compose --profile dev down -v
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

## Docker

See [Getting Started → Option B](#option-b-docker-compose) above for Docker Compose instructions.

### Image Details

- **Base:** `node:22-alpine` (~50 MB compressed)
- **Build:** Multi-stage — TypeScript compiled in builder stage, production stage has only runtime deps
- **Security:** Runs as non-root user `app` (UID 1001)
- **Health check:** `GET /api/health` every 30s

### docker-compose.yml

| Service | Description | Profile |
|---------|-------------|---------|
| `mongo` | MongoDB 7 with persistent volume | *(always)* |
| `app` | Production API (compiled JS) | `--profile prod` |
| `app-dev` | Development API (hot reload) | `--profile dev` |

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
