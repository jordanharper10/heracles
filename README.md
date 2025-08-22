# 🏋️ Heracles

Heracles is a self‑hosted workout tracker designed to run on a Raspberry Pi  
Frontend: React + TypeScript + Webpack  
Backend: Node.js (Express + TypeScript) with a lightweight SQLite database file powered by `sql.js` (WASM).

---

## Features

- Create/edit workouts with exercises, supersets, circuits and per‑set fields
- Templates: save a workout layout and reuse it
- Exercise library with muscle group / equipment tagging
- Stats page with progress charts
- Auth: Admin role can manage users/exercises (if enabled in UI)
- Pi‑friendly builds (no native compilers required)

---

## Project Structure
```
heracles/
├─ server/ # Node/Express API (TypeScript)
│ ├─ src/
│ │ ├─ db/
│ │ │ ├─ schema.sql # SQLite schema
│ │ │ ├─ migrate.ts # creates tables + seeds admin
│ │ │ └─ sql.ts # sql.js helpers (load/save DB file)
│ │ ├─ routes/ # auth, exercises, workouts, templates, admin
│ │ └─ index.ts # app entry
│ └─ data/heracles.sqlite # database file (created on first run)
└─ web/ # React app (TypeScript + Webpack)
├─ src/
├─ index.html
└─ webpack.config.cjs
```

---

## Requirements

- Node.js 20+ (ARM build)
- Nginx (serves frontend + reverse‑proxies API)

> Tip (Node install): you can use NodeSource or nvm to get Node 20+ on Pi.  
> After installing Node, confirm with `node -v` and `npm -v`.

---

## Quickstart (Local)

### 1) Server (API)

```
cd server
npm install
npm run build          # compile TypeScript to dist/
node dist/db/migrate.js  # create tables + seed admin if empty
```

To run a development server:
`node dist/index.js     # starts API (default PORT=8083)`

To run a production server:
```
sudo cp heracles-api.service.example /etc/systemd/system/heracles-api.service
*** Edit Systemd file as required
sudo systemctl daemon-reload
sudo systemctl enable heracles-api
sudo systemctl start heracles-api
sudo systemctl status heracles-api
```

Environment variables (optional):
```
cp .env.example .env

*** Configurable Environemnt Variables:
PORT — default 8083
JWT_SECRET - default random per boot (set this to persist sessions)
DB_FILE - path to SQLite file (default ./data/heracles.sqlite)
ADMIN_EMAIL - seeded if users is empty (default admin@local)
ADMIN_NAME - default Admin
ADMIN_PASSWORD - default admin123 (change after first login)
```

First run seeds an admin user only if the user table is empty.

### 2) Web (Frontend)
```
cd web
npm install
npm run build          # outputs to web/dist/
```

To run a development server:
`npm run dev`

To run a production server:
```
sudo cp nginx.heracles.example /etc/nginx/sites-available/heracles
sudo ln -s /etc/nginx/sites-available/heracles /etc/nginx/sites-enabled/heracles
sudo nginx -t && sudo systemctl reload nginx
```

