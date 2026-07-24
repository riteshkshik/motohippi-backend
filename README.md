# MotoHippi — Backend API

Express.js + Node.js REST API for the MotoHippi platform.  
Standalone — no monorepo or workspace needed.  
Deploy to **Railway** in minutes.

---

## Quick start (local)

```bash
npm install
cp .env.example .env
# Edit .env — set DATABASE_URL to your PostgreSQL connection string
npm run build
npm start
```

Server starts on `http://localhost:3000` (or the PORT you set).

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string |
| `PORT` | ✅ Yes (auto on Railway) | Port to listen on (default `3000`) |
| `FRONTEND_URL` | ✅ Yes | Comma-separated list of allowed frontend origins (CORS) |
| `NODE_ENV` | No | `production` or `development` (default: `development`) |
| `AUTH_SALT` | No | Secret salt for password hashing — **change this in production** |
| `LOG_LEVEL` | No | `trace` / `debug` / `info` / `warn` / `error` (default: `info`) |
| `GOOGLE_CLIENT_ID` | No | Google OAuth — enables "Sign in with Google" |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth secret |
| `SENDGRID_API_KEY` | No | SendGrid API key — if absent, OTP codes print to console |
| `FROM_EMAIL` | No | From address for OTP emails (default: `noreply@motohippi.com`) |
| `APP_URL` | No | Public URL of this backend (used for OAuth redirect URIs) |

---

## Deploy to Railway

### Step 1 — Create project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Deploy from GitHub repo** → select your repo
3. Railway auto-detects Node.js and runs `npm install && npm run build`

### Step 2 — Add PostgreSQL

1. In the Railway project dashboard, click **+ New** → **Database** → **PostgreSQL**
2. Railway auto-injects `DATABASE_URL` into your service — nothing to copy

### Step 3 — Set environment variables

In **Service → Variables**, add:

```
FRONTEND_URL=https://your-motohippi-frontend.vercel.app
NODE_ENV=production
AUTH_SALT=<any long random string>
SENDGRID_API_KEY=<optional>
GOOGLE_CLIENT_ID=<optional>
GOOGLE_CLIENT_SECRET=<optional>
APP_URL=https://<your-railway-service>.up.railway.app
```

### Step 4 — Push schema to database

After deploying, run this **once** to create all tables:

```bash
# In your local terminal (with DATABASE_URL set to the Railway DB)
npm run db:push
```

Or run it via Railway's **Terminal** tab in the dashboard.

### Step 5 — Connect frontend

In your Vercel frontend project, set:

```
VITE_API_BASE_URL=https://<your-railway-service>.up.railway.app
```

---

## Database schema

PostgreSQL with Drizzle ORM. Tables created by `npm run db:push`:

| Table | Description |
|---|---|
| `users` | User accounts and profiles |
| `follows` | Follow relationships |
| `groups` | Riding groups / communities |
| `group_members` | Group membership |
| `posts` | Community feed posts |
| `post_likes` | Post likes |
| `comments` | Post comments |
| `products` | Marketplace products |
| `cart_items` | Shopping cart |
| `wishlist_items` | Wishlisted products |
| `orders` | Orders |
| `conversations` | 1-on-1 conversations |
| `messages` | Chat messages |
| `swipes` | Discover swipe actions |
| `matches` | Mutual matches |
| `events` | Ride events |
| `notifications` | User notifications |
| `insurance_plans` | Insurance plan catalog |
| `insurance_policies` | User insurance policies |
| `trips` | Planned trips |
| `trip_members` | Trip membership |

---

## API endpoints

Base path: `/api`

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/signup` | ❌ | Register new user |
| `POST` | `/auth/login` | ❌ | Login |
| `POST` | `/auth/logout` | ❌ | Logout |
| `POST` | `/auth/send-otp` | ✅ | Send email OTP |
| `POST` | `/auth/verify-otp` | ✅ | Verify OTP code |
| `GET` | `/auth/google` | ❌ | Google OAuth redirect |
| `GET` | `/auth/google/callback` | ❌ | Google OAuth callback |

### Users
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/users/me` | ✅ | Get my profile |
| `PATCH` | `/users/me` | ✅ | Update my profile |
| `GET` | `/users/search?q=` | ✅ | Search riders |
| `GET` | `/users/:userId` | ✅ | Get user profile |
| `POST` | `/users/:userId/follow` | ✅ | Follow user |
| `POST` | `/users/:userId/unfollow` | ✅ | Unfollow user |

### Discover
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/discover/candidates` | ✅ | Get swipe candidates |
| `POST` | `/discover/swipe` | ✅ | Swipe on a user |
| `GET` | `/discover/matches` | ✅ | Get matches |

### Groups
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/groups` | ✅ | List groups (`?filter=mine`) |
| `POST` | `/groups` | ✅ | Create group |
| `GET` | `/groups/:id` | ✅ | Get group |
| `PATCH` | `/groups/:id` | ✅ | Update group |
| `GET` | `/groups/:id/members` | ✅ | List members |
| `POST` | `/groups/:id/members` | ✅ | Add member |
| `PATCH` | `/groups/:id/members/:memberId` | ✅ | Update member |
| `DELETE` | `/groups/:id/members/:memberId` | ✅ | Remove member |
| `POST` | `/groups/:id/join` | ✅ | Join group |
| `POST` | `/groups/:id/leave` | ✅ | Leave group |

### Feed
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/feed` | ✅ | Get feed posts |
| `GET` | `/feed/trending` | ✅ | Get trending posts |
| `POST` | `/posts` | ✅ | Create post |
| `GET` | `/posts/:id` | ✅ | Get post |
| `PATCH` | `/posts/:id` | ✅ | Update post |
| `DELETE` | `/posts/:id` | ✅ | Delete post |
| `POST` | `/posts/:id/like` | ✅ | Like / unlike post |
| `GET` | `/posts/:id/comments` | ✅ | Get comments |
| `POST` | `/posts/:id/comments` | ✅ | Add comment |

### Marketplace
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/products` | ✅ | List products |
| `GET` | `/products/featured` | ✅ | Featured products |
| `GET` | `/products/:id` | ✅ | Get product |
| `GET` | `/cart` | ✅ | Get cart |
| `POST` | `/cart` | ✅ | Add to cart |
| `PATCH` | `/cart/:productId` | ✅ | Update cart item qty |
| `DELETE` | `/cart/:productId` | ✅ | Remove from cart |
| `GET` | `/orders` | ✅ | Get orders |
| `GET` | `/wishlist` | ✅ | Get wishlist |
| `POST` | `/wishlist/:productId` | ✅ | Add to wishlist |
| `DELETE` | `/wishlist/:productId` | ✅ | Remove from wishlist |

### Messages
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/conversations` | ✅ | List conversations |
| `POST` | `/conversations` | ✅ | Start conversation |
| `GET` | `/conversations/:id/messages` | ✅ | Get messages |
| `POST` | `/conversations/:id/messages` | ✅ | Send message |

### Insurance
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/insurance/plans` | ✅ | List plans |
| `GET` | `/insurance/policies` | ✅ | My policies |
| `POST` | `/insurance/policies` | ✅ | Purchase policy |

### Other
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/dashboard` | ✅ | Dashboard summary |
| `GET` | `/notifications` | ✅ | Notifications |
| `POST` | `/notifications/read-all` | ✅ | Mark all read |
| `GET` | `/search/riders` | ✅ | Search riders with scoring |
| `GET` | `/healthz` | ❌ | Health check |

---

## Authentication

Bearer token in `Authorization` header:

```
Authorization: Bearer <token>
```

Token is returned by `/auth/signup` and `/auth/login`.

---

## Tech stack

- **Node.js** + **Express 5**
- **TypeScript** → compiled by **esbuild** (single `.mjs` bundle)
- **Drizzle ORM** with **PostgreSQL** (`pg`)
- **Pino** structured logging
- **Zod** request validation
