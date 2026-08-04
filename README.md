# SafeRoute — School Bus Tracking System

SafeRoute is a real-time school bus tracking platform with three portals — **Admin**, **Driver**, and **Parent** — built to let schools manage routes and fleets, let drivers log trips and report emergencies, and let parents track their child's bus live and receive alerts.

**Live demo:**
- Frontend: `https://web-based-school-bus-tracking-system-kiruniwal-memyselyi.vercel.app`
- Backend API: hosted on Render (see [Deployment](#deployment) for your own setup)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started (Local Development)](#getting-started-local-development)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [API Reference](#api-reference)
- [Real-Time Events (Socket.io)](#real-time-events-socketio)
- [Demo Accounts](#demo-accounts)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Features

**Admin portal**
- Manage buses, drivers, routes, and stops
- Register students and link them to a parent account (creates the parent account automatically if it doesn't exist yet, and emails them their login)
- View all active trips and live bus locations on a map
- View and resolve emergency alerts
- Trip history and reporting

**Driver portal**
- Start/end a trip for their assigned bus
- Live GPS is streamed from the driver's device to the backend and broadcast to admins and parents in real time
- Mark students as boarded/alighted
- One-tap emergency alert, sent instantly to admins and to the parents of every student on that bus (in-app + push notification)

**Parent portal**
- Live map tracking of their child's bus with ETA
- Push notifications for bus arrival and emergency alerts (opt-in via the bell icon)
- Trip history for their child's bus
- Multi-child support (switch between children if you have more than one)

**Cross-cutting**
- Role-based access control (admin / driver / parent), enforced both client-side and on every backend route
- Real-time updates over Socket.io (GPS position, trip start/end, emergency alerts, arrival notifications)
- Web Push notifications (works even when the app isn't open, via a service worker)
- Responsive UI with a mobile hamburger/drawer navigation
- Dark/light theme toggle

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Leaflet (maps) |
| Backend | Node.js, Express, TypeScript, Socket.io |
| Database | MySQL (hosted on Aiven) |
| Auth | JWT (httpOnly cookie + Bearer token fallback) |
| Push notifications | Web Push API (VAPID) |
| Transactional email | Brevo HTTP API |
| Hosting | Frontend → Vercel · Backend → Render · Database → Aiven |

---

## Architecture

The frontend and backend are deployed as **two separate services on two separate domains** (Vercel + Render). This matters for a few implementation details you'll see in the code:

- Auth uses **both** an httpOnly cookie (`SameSite=None; Secure` in production) **and** a JWT returned in the login response and stored in `localStorage`, sent as a `Bearer` token on every request. This dual approach exists because cross-domain cookies are unreliable on some browsers (Safari ITP, private browsing, some mobile browsers) — the Bearer token is the reliable fallback.
- CORS on the backend is locked to a single configured origin (`FRONTEND_URL`) — this must exactly match your deployed frontend URL, with no trailing slash.
- Socket.io authenticates the same way: token first, cookie as fallback.
- Route protection for `/dashboard/*` pages happens **client-side** (via a `RequireRole` guard component reading the logged-in user from `localStorage`), not in Next.js middleware — because Next.js middleware runs on the frontend's own server/domain and can never see a cookie set by a different domain (the backend). The backend is still the real source of truth: every protected API route independently checks the JWT and role via `authenticate`/`authorize` middleware.

```
┌─────────────────┐      HTTPS (REST + WebSocket)      ┌──────────────────┐
│  Next.js frontend │ ──────────────────────────────────▶│  Express backend │
│  (Vercel)          │◀────────────────────────────────── │  (Render)         │
└─────────────────┘                                      └────────┬─────────┘
                                                                    │ MySQL (TLS)
                                                                    ▼
                                                           ┌──────────────────┐
                                                           │   Aiven MySQL     │
                                                           └──────────────────┘
```

---

## Project Structure

```
web-based-school-bus-tracking-system/
├── saferoute-backend/            # Express + TypeScript API
│   ├── src/
│   │   ├── config/db.ts          # MySQL connection pool
│   │   ├── controllers/          # Route handlers (auth, students, trips, alerts, ...)
│   │   ├── middleware/auth.ts    # JWT verification + role authorization
│   │   ├── routes/               # Express routers, mounted under /api/*
│   │   ├── services/             # Push notifications, email, geofencing
│   │   ├── socket/socketServer.ts# Socket.io setup + auth
│   │   ├── app.ts                # Express app (middleware, route mounting)
│   │   └── server.ts             # Entry point — boots DB pool, HTTP server, sockets
│   └── schema.sql                # Full database schema + demo seed data
│
└── school-bus-tracker/           # Next.js frontend
    └── src/
        ├── app/
        │   ├── login/             # Login page (role-tabbed)
        │   ├── unauthorized/      # Shown when role guard blocks access
        │   └── dashboard/
        │       ├── admin/         # Admin portal pages + layout (role guard)
        │       ├── driver/        # Driver portal pages + layout (role guard)
        │       └── parent/        # Parent portal pages + layout (role guard)
        ├── components/            # Sidebar, RequireRole, BusMap, NotificationBell, ...
        ├── hooks/                 # useSocket, usePushNotification
        ├── lib/api.ts             # Fetch wrapper (Bearer token + 401 handling)
        └── proxy.ts               # Next.js 16 middleware (route-based, not auth-based)
```

---

## Getting Started (Local Development)

### Prerequisites

- Node.js 20+
- A MySQL database (local MySQL, or a free Aiven/PlanetScale instance)
- npm

### 1. Clone the repo

```bash
git clone https://github.com/brandon3136/web-based-school-bus-tracking-system.git
cd web-based-school-bus-tracking-system
```

### 2. Set up the database

Run `saferoute-backend/schema.sql` against your MySQL instance. This creates all tables **and** seeds three demo accounts plus a demo route/bus/students — see [Database Setup](#database-setup) for exact commands.

### 3. Backend setup

```bash
cd saferoute-backend
npm install
cp .env.example .env      # then fill in the values — see Environment Variables below
npm run dev
```

The API starts on `http://localhost:4000` by default. Confirm it's up:

```bash
curl http://localhost:4000/health
# {"status":"ok","timestamp":"..."}
```

### 4. Frontend setup

In a second terminal:

```bash
cd school-bus-tracker
npm install
echo "NEXT_PUBLIC_BACKEND_URL=http://localhost:4000" > .env.local
npm run dev
```

Open `http://localhost:3000` — you should land on the login page.

### 5. Log in

Use any of the [demo accounts](#demo-accounts) below (all password `password123`).

---

## Environment Variables

### Backend (`saferoute-backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default `4000`) | Port the API listens on |
| `NODE_ENV` | Yes in production | Set to `production` on Render — required for secure cross-domain cookies to work |
| `FRONTEND_URL` | Yes | Exact URL of the deployed frontend (no trailing slash) — used for CORS and Socket.io |
| `JWT_SECRET` | Yes | Secret used to sign auth tokens — use a long random string, don't reuse the example value |
| `JWT_EXPIRES_IN` | No | Token lifetime, e.g. `7d` |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Yes | MySQL connection details |
| `DB_SSL` | Yes on Aiven | Set `true` — Aiven requires TLS |
| `DB_SSL_CA` or `DB_SSL_CA_PATH` | Recommended | Aiven's CA certificate (PEM contents or file path) for full certificate verification. Without it, the connection is still encrypted but the server cert isn't verified |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_EMAIL` | Yes for push | Generate with `npx web-push generate-vapid-keys` |
| `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` | Yes for email | Used to email new parents their login credentials (Render blocks outbound SMTP on the free tier, so this uses Brevo's HTTP API instead) |

### Frontend (`school-bus-tracker/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Yes | Full URL of the backend API, no trailing slash. Baked in **at build time** — changing it requires a rebuild/redeploy, not just a restart |

---

## Database Setup

Point any MySQL client at your database and run the schema file:

```bash
mysql -h <host> -P <port> -u <user> -p <database> < saferoute-backend/schema.sql
```

Or, on Aiven, paste the contents of `schema.sql` into the **Query editor** in the Aiven console.

This creates all tables (`users`, `buses`, `routes`, `stops`, `students`, `trips`, `gps_logs`, `boarding_records`, `emergency_alerts`, `push_subscriptions`) and seeds one demo school: an admin, a driver, a parent, one route with 4 stops, one bus, and two students.

> **Note:** `schema.sql` only runs when you explicitly execute it. If your live database predates a schema change (e.g. a new column was added), you need to run that specific `ALTER TABLE` against your live database yourself — re-running the whole file won't retroactively apply changes to an existing database.

---

## API Reference

All endpoints are prefixed with `/api`. Except where noted, every route requires an `Authorization: Bearer <token>` header (or the `saferoute_token` cookie) and is further restricted by role.

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/auth/login` | Public | Log in, returns JWT + sets cookie |
| POST | `/auth/register` | Public | Register a new account |
| POST | `/auth/logout` | Any | Clear session |
| GET | `/auth/me` | Any | Current user profile |
| PUT | `/auth/me` | Any | Update profile |
| PUT | `/auth/password` | Any | Change password |
| GET | `/buses` , `/buses/:id` | admin, driver, parent | List / get buses |
| GET | `/buses/:id/location` | admin, driver, parent | Last known bus location |
| POST / PUT / DELETE `/buses` | admin | Manage buses |
| GET / POST / DELETE `/drivers` | admin | Manage drivers |
| GET / POST / PUT / DELETE `/routes` | admin (write), any (read) | Manage routes |
| GET / POST / PUT / DELETE `/routes/stops` | admin (write) | Manage stops |
| GET `/students`, `/students/options` | admin | List students |
| GET `/students/mine` | parent | This parent's own children |
| POST `/students`, `/students/register` | admin | Add a student (optionally creating the parent account) |
| PUT / DELETE `/students/:id` | admin | Edit / remove a student |
| POST `/trips/start`, `/trips/end` | driver | Start/end a trip |
| POST `/trips/gps` | driver | Log a GPS position (also broadcasts over Socket.io) |
| GET `/trips/active` | admin, driver, parent | Currently in-progress trips |
| GET `/trips/history` | admin, driver | Completed trip history |
| GET `/trips/:tripId/gps` | admin | Full GPS log for a trip |
| GET `/boarding/:tripId` | admin, driver | Boarding list for a trip |
| POST `/boarding/boarded`, `/boarding/alighted` | driver | Mark a student on/off the bus |
| POST `/alerts/emergency` | driver | Trigger an emergency alert (notifies admins + affected parents) |
| GET `/alerts` | admin | Recent alerts |
| PATCH `/alerts/:id/resolve` | admin | Mark an alert resolved |
| GET `/push/vapid-key` | Public | VAPID public key for push subscription |
| POST `/push/subscribe`, `/push/unsubscribe` | Any | Manage push subscription |

Health check (no `/api` prefix, no auth): `GET /health`

---

## Real-Time Events (Socket.io)

The client connects to the backend root URL and authenticates via `auth: { token }` (Bearer token) with cookie as fallback.

**Rooms:**
- `room:admin` — all connected admins
- `parent:<userId>` — a specific parent
- `bus:<busId>` — anyone currently viewing that bus (joined via `subscribe:bus`)

**Events emitted by the server:**

| Event | Room | Payload |
|---|---|---|
| `gps:update` | `bus:<busId>` | Live position, speed, heading |
| `trip:started` / `trip:ended` | `bus:<busId>` | Trip lifecycle |
| `arrival:alert` | `parent:<userId>` | Bus completed its route |
| `emergency:alert` | `room:admin` + `parent:<userId>` for every affected parent | Emergency details |
| `emergency:resolved` | `room:admin` | Alert marked resolved |

**Events the client emits:**

| Event | Payload | Purpose |
|---|---|---|
| `subscribe:bus` | `busId` | Join a bus's room to receive its live updates |
| `unsubscribe:bus` | `busId` | Leave that room |

---

## Demo Accounts

Seeded by `schema.sql` — all share the password `password123`:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@school.tz` | `password123` |
| Driver | `driver@school.tz` | `password123` |
| Parent | `parent@school.tz` | `password123` |

> ⚠️ Change or remove these before using the app with real users — don't leave demo credentials active on a production deployment.

---

## Deployment

This project is designed to run as three separate managed services:

1. **Database — Aiven (MySQL)**: create a MySQL service, note the connection details, run `schema.sql` against it.
2. **Backend — Render**: deploy `saferoute-backend/` as a Web Service. Set all backend [environment variables](#environment-variables), including `NODE_ENV=production`, `DB_SSL=true`, and `FRONTEND_URL` set to your exact Vercel URL. Build command: `npm run build`. Start command: `npm start`.
3. **Frontend — Vercel**: deploy `school-bus-tracker/` as the project root. Set `NEXT_PUBLIC_BACKEND_URL` to your Render URL in **Project Settings → Environment Variables**, then redeploy (this variable is baked in at build time — saving it alone doesn't affect an already-built deployment).

After deploying, verify:
- `https://<your-render-url>/health` returns `{"status":"ok"}`
- Login succeeds and lands you on the correct dashboard without bouncing back to `/login`
- The browser console shows no CORS errors

---

## Troubleshooting

**"Cannot reach the backend"** — `NEXT_PUBLIC_BACKEND_URL` isn't set (or wasn't rebuilt after setting it) on Vercel, so the app is falling back to `http://localhost:4000`.

**CORS error blocking login** — `FRONTEND_URL` on Render doesn't exactly match your Vercel URL (check for a trailing slash mismatch).

**Login succeeds but dashboard immediately bounces back to `/login`** — usually a stale/incorrect `NEXT_PUBLIC_BACKEND_URL`, or `NODE_ENV` not set to `production` on Render (needed for `SameSite=None; Secure` cookies to work cross-domain).

**"Internal server error" on some action** — check the Render service logs; this is a generic 500 from the backend's catch-all error handler and usually indicates either a database connectivity issue or a schema mismatch (a column the code expects that doesn't exist in your live database — `schema.sql` changes don't auto-apply to an existing database, see [Database Setup](#database-setup)).

**Parent doesn't receive push notifications** — the parent must click the bell icon in the sidebar once to grant browser notification permission and subscribe; it isn't automatic.

**Live GPS not updating on the map** — confirm the driver has actually started a trip (`/trips/start`) and that GPS permission is granted in their browser; also check the browser console for Socket.io connection errors.
