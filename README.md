# Voilà

**Voilà** is an app that finds the optimal meeting point between multiple people. Enter everyone's starting addresses, and Voilà computes the fairest midpoint, suggests nearby venues, and shows travel routes for each person.

The project ships as three artifacts sharing the same Rust backend:

| App | Stack | Notes |
|-----|-------|-------|
| `apps/web` | SvelteKit + Tailwind | Deployed to Vercel; also compiled as a Capacitor web shell for iOS/Android |
| `apps/mobile` | React Native (Expo) | Native iOS and Android apps with maps and contacts integration |
| `backend/core-api` | Rust (Actix-Web) | REST API, routing engine proxy, isochrone/POI services, Redis cache |

---

## How it works

1. Users enter two or more home addresses.
2. The Rust API runs a meeting-point algorithm that minimises total travel time using [GraphHopper](https://www.graphhopper.com/) for pedestrian and public-transport routing.
3. The API scores candidate points with a "heat map" (Paris POI density) to prefer lively areas.
4. The frontend displays the winning meeting point, all individual routes on a map, and a list of nearby venue options (cafés, restaurants, etc.).

Groups and saved addresses are stored in Supabase (mobile) / Firebase (web).

---

## Repository layout

```
voila/
├── apps/
│   ├── web/          # SvelteKit web app (also used as Capacitor web layer)
│   └── mobile/       # Expo / React Native app
├── backend/
│   └── core-api/     # Rust Actix-Web API
├── docker-compose.yml
└── server-nginx.conf
```

---

## Backend (`backend/core-api`)

A Rust service that exposes:

| Endpoint | Description |
|----------|-------------|
| `POST /api/meeting-point` | Core algorithm — given ≥ 2 coordinates, returns ranked meeting points with routes |
| `GET /api/preload` | Pre-warms GraphHopper and cache for a geographic area |
| `POST /api/share` | Generates a shareable link for a meeting session |
| `GET /health` | Health check |

**Key services:**
- `route_service` — proxies walking/transit routing to GraphHopper
- `isochrone_service` — computes reachable areas from each starting point
- `poi_service` — queries Google Maps Places for venues near the meeting point
- `cache_service` — Redis-backed cache with an in-process `DashMap` fallback

### Running locally

```bash
# Start GraphHopper + Redis
docker compose up graphhopper redis

# Run the API (requires a .env file — see below)
cd backend/core-api
cargo run
```

**Environment variables (`.env`):**

```
HOST=0.0.0.0
PORT=3000
GRAPHHOPPER_URL=http://localhost:8989
REDIS_URL=redis://localhost:6379
MAPS_PLACES_API_KEY=<Google Maps API key>
```

### Production deployment

```bash
docker compose up --build -d
```

The `server-nginx.conf` file is the Nginx configuration for `voila-app.fr`. It terminates TLS, proxies `/api/` to the Rust container on port 3000, and serves the built SvelteKit frontend from `/var/www/voila`.

---

## Web app (`apps/web`)

A SvelteKit application deployed on Vercel. It can also be compiled as a Capacitor static bundle for iOS/Android (see `apps/web/capacitor.config.json`).

### Running locally

```bash
cd apps/web
npm install
npm run dev
```

### Building

```bash
# For Vercel
npm run build

# As a Capacitor mobile bundle
npm run build:mobile

# Open in Android Studio / Xcode
npm run cap:android
npm run cap:ios
```

---

## Mobile app (`apps/mobile`)

A React Native (Expo) app with:
- Native maps (Google Maps on Android, Apple Maps on iOS) via `react-native-maps`
- Contacts integration (`expo-contacts`) to quickly add friends' addresses
- Groups feature for recurring meetings
- Supabase backend for auth and data storage
- EAS Build for CI/CD (`eas.json`)

### Running locally

```bash
cd apps/mobile
npm install
npx expo start
```

### Building a release APK

```bash
cd apps/mobile/android
NODE_ENV=production ./gradlew clean assembleRelease
```

---

## Tech stack summary

| Layer | Technology |
|-------|-----------|
| Web frontend | SvelteKit 2, Tailwind CSS 3, Vite, Firebase |
| Mobile | React Native 0.79, Expo 53, Expo Router, Supabase |
| Backend API | Rust, Actix-Web 4, Tokio |
| Routing engine | GraphHopper (foot + public transport) |
| Cache | Redis + in-memory DashMap |
| Maps / Places | Google Maps Platform |
| Auth (web) | Firebase Authentication |
| Auth (mobile) | Supabase Auth |
| Hosting | Vercel (web), Docker + Nginx (API), EAS (mobile) |
