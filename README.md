# 🚌 SafeRoute — School Bus Tracking System

SafeRoute is a full-stack, real-time school bus tracking platform. Admins manage buses, drivers, routes, and students; drivers run trips and log GPS/boarding data from the road; and parents watch their child's bus move on a live map and get proximity alerts as it nears their stop.

The project is split into two apps in this monorepo:

| App | Path | Stack |
|---|---|---|
| **Backend API** | [`saferoute-backend/`](./saferoute-backend) | Node.js, Express, TypeScript, MySQL, Socket.IO |
| **Frontend** | [`school-bus-tracker/`](./school-bus-tracker) | Next.js 16, React 19, TypeScript, Tailwind CSS, Leaflet |

---

## ✨ Features

- **Role-based dashboards** for three user types — `admin`, `driver`, `parent` — each with its own layout, navigation, and permissions.
- **Live GPS tracking** on an interactive Leaflet map, streamed to clients over Socket.IO as the bus moves.
- **Traccar integration** — an optional background poller pulls positions from a [Traccar](https://www.traccar.org/) GPS server, writes them to the database, and broadcasts them to subscribed clients, so real hardware trackers can drive the map.
- **Geofence proximity alerts** — using the Haversine formula, the backend detects when a bus enters a stop's radius and pushes a real-time alert (Socket.IO + Web Push) to the parents of students at that stop.
- **Trip lifecycle management** — drivers start/end trips, and every GPS fix is logged (`gps_logs`) for later playback in trip history.
- **Student boarding tracking** — drivers mark students as boarded/alighted per stop; admins get a full audit trail.
- **Emergency alerts** — drivers can raise an emergency for a trip; it's broadcast to all admins and can be resolved from the admin dashboard.
- **Web Push notifications** — a service worker (`public/sw.js`) plus VAPID-based push lets parents receive alerts even when the tab isn't focused.
- **Route & stop management** — admins define routes as an ordered sequence of geocoded stops, each with its own geofence radius.
- **Authentication & authorization** — JWT-based auth (HTTP-only cookie or Bearer token), password hashing with bcrypt, and per-route role checks (`admin` / `driver` / `parent`).
- **Transactional email** — password resets and account notifications via the Brevo HTTP API.
- **Light/dark theme** toggle on the frontend.

---

## 🏗️ Architecture

```
┌─────────────────────┐        REST (JSON)         ┌──────────────────────┐
│  school-bus-tracker  │ ─────────────────────────▶ │   saferoute-backend   │
│  (Next.js frontend)  │ ◀───────────────────────── │  (Express + Socket.IO)│
└─────────────────────┘        Socket.IO (WS)       └──────────┬───────────┘
                                                                 │
                                                     ┌───────────┼────────────┐
                                                     ▼           ▼            ▼
                                                  MySQL     Traccar API   Web Push /
                                                 (data)    (GPS source)   Brevo Email
```

- The frontend talks to the backend over REST for CRUD operations and authenticates via a JWT stored in an HTTP-only cookie (with a `localStorage` Bearer-token fallback).
- A Socket.IO connection (also JWT-authenticated) streams live `gps:update`, `proximity:alert`, and emergency events. Clients join rooms per bus (`bus:<id>`), per parent (`parent:<id>`), or the shared `room:admin`.
- GPS data can arrive two ways: directly from the driver app (`POST /api/trips/gps`) or via the `traccarPoller` background job, which polls a Traccar server on an interval and forwards valid, deduplicated fixes into the same pipeline (DB insert → Socket.IO broadcast → geofence check).

---

## 📂 Project Structure

```
web-based-school-bus-tracking-system/
├── saferoute-backend/
│   ├── schema.sql                  # MySQL schema + demo seed data
│   ├── env.example                 # Environment variable template
│   └── src/
│       ├── app.ts                  # Express app, middleware, route mounting
│       ├── server.ts               # Entry point: DB check, HTTP server, Socket.IO, poller
│       ├── config/db.ts            # MySQL connection pool
│       ├── controllers/            # Request handlers (auth, buses, routes, trips, students, alerts, boarding, push)
│       ├── routes/                 # Express routers per resource
│       ├── middleware/auth.ts      # JWT authentication + role-based authorization
│       ├── services/               # Traccar client, geofencing, email, web push
│       ├── jobs/traccarPoller.ts   # Background job polling Traccar for GPS fixes
│       ├── socket/socketServer.ts  # Socket.IO setup, auth, rooms, events
│       └── types/                  # Shared TypeScript types
└── school-bus-tracker/
    ├── public/sw.js                # Service worker for Web Push
    └── src/
        ├── app/
        │   ├── login/               # Login page
        │   ├── unauthorized/        # Access-denied page
        │   └── dashboard/
        │       ├── admin/           # Fleet, drivers, routes, students, history, settings
        │       ├── driver/          # Active trip, student list, history, settings
        │       └── parent/          # Live map, alerts, history, settings
        ├── components/              # BusMap, Sidebar, NotificationBell, StatCard, ThemeToggle, RequireRole
        ├── hooks/                   # useSocket, usePushNotification, useTheme
        └── lib/api.ts                # Authenticated fetch wrapper
```

---

## 🗄️ Data Model

The MySQL schema (`saferoute-backend/schema.sql`) is normalized to 3NF and centers on:

- **`users`** — parents, admins, and drivers (single table, `role` enum).
- **`buses`** — fleet vehicles, each optionally linked to a driver and a Traccar device ID.
- **`routes`** / **`stops`** — a route is an ordered list of geocoded stops, each with a geofence radius.
- **`bus_routes`** — many-to-many assignment of buses to routes.
- **`students`** — linked to a parent, and optionally to a bus/route/stop.
- **`trips`** — one record per bus run (`scheduled` → `in_progress` → `completed`/`cancelled`).
- **`gps_logs`** — high-frequency coordinate stream per trip, used for live tracking and history playback.
- **`boarding_records`** — per-trip, per-student boarding/alighting timestamps.
- **`emergency_alerts`** — driver-raised alerts with location, tied to a trip.
- **`push_subscriptions`** — stored Web Push subscriptions per user.

Running the schema also seeds a demo school (one admin, one driver, one parent, one bus, one route with 4 stops, and two students) so you can log in and explore immediately.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- MySQL 8+ (or a managed provider such as Aiven)
- (Optional) A running [Traccar](https://www.traccar.org/) server if you want live GPS from real hardware
- (Optional) Brevo account for transactional email, and VAPID keys for Web Push

### 1. Set up the database

```bash
mysql -u root -p < saferoute-backend/schema.sql
```

This creates the `saferoute` database, all tables, and demo seed data. Demo accounts (password: `password123` for all):

| Role | Email |
|---|---|
| Admin | `admin@school.tz` |
| Driver | `driver@school.tz` |
| Parent | `parent@school.tz` |

### 2. Backend

```bash
cd saferoute-backend
npm install
cp env.example .env   # then fill in the values below
npm run dev            # starts on http://localhost:4000
```

Key environment variables (see `env.example` for the full list):

- `PORT`, `FRONTEND_URL` — server port and allowed CORS origin
- `JWT_SECRET`, `JWT_EXPIRES_IN` — auth token signing
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL` — MySQL connection
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` — generate with `npx web-push generate-vapid-keys`
- `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` — transactional email
- `TRACCAR_URL`, `TRACCAR_EMAIL`, `TRACCAR_PASSWORD`, `TRACCAR_POLL_INTERVAL_MS` — optional live GPS source; the poller silently no-ops if `TRACCAR_URL` is unset

Other scripts:

```bash
npm run build   # compile TypeScript to dist/
npm start       # run the compiled server
```

### 3. Frontend

```bash
cd school-bus-tracker
npm install
```

Create a `.env.local` with:

```
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

Then run:

```bash
npm run dev     # starts on http://localhost:3000
npm run build   # production build
npm start       # run the production build
npm run lint    # lint the frontend
```

Open `http://localhost:3000/login` and sign in with one of the demo accounts above.

---

## 🔌 API Overview

All endpoints are mounted under `/api` and (aside from `/api/auth/login`, `/api/auth/register`, and `/api/push/vapid-key`) require a valid JWT, sent as either a `Bearer` header or the `saferoute_token` HTTP-only cookie. Most routes are further restricted by role via an `authorize(...)` middleware.

| Resource | Base path | Notes |
|---|---|---|
| Auth | `/api/auth` | login, register, logout, profile, password change, DB reset (admin) |
| Buses | `/api/buses` | CRUD + current location; admin-only writes |
| Drivers | `/api/drivers` | Admin-only driver management |
| Routes & Stops | `/api/routes` | Routes with nested, ordered stops |
| Trips | `/api/trips` | Start/end trip, GPS logging, active trips, history |
| Students | `/api/students` | Admin CRUD, parent's own students, bulk registration |
| Boarding | `/api/boarding` | Mark boarded/alighted, per-bus student lists |
| Emergency Alerts | `/api/alerts` | Driver-raised, admin-resolved, parent read access |
| Web Push | `/api/push` | Subscribe/unsubscribe, public VAPID key |
| Health check | `/health` | Liveness probe |

Real-time Socket.IO events include `gps:update` (live position), `proximity:alert` (geofence trigger), and driver `subscribe:bus` / `unsubscribe:bus` room management.

---

## 🛠️ Tech Stack

**Backend:** Express, TypeScript, MySQL (`mysql2`), Socket.IO, JWT (`jsonwebtoken`), bcryptjs, `express-validator`, `web-push`, `nodemailer`/Brevo.

**Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Leaflet + `react-leaflet`-style map component, `socket.io-client`, `lucide-react` icons.

---

## 📄 License

No license file is currently included in this repository. Add one (e.g. MIT) if you intend to open-source or distribute this project.