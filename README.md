# Heracles Workout Tracker

## 0) Prereqs
- Node 20.x, pnpm or npm, and SQLite (bundled)
- On Raspberry Pi: enable swap if building on low RAM

## 1) Install & DB
cd server
pnpm i   # or npm i
pnpm prisma:generate
pnpm prisma:migrate
pnpm seed   # optional

## 2) Run server
pnpm dev    # http://localhost:8080

## 3) Frontend
cd ../web
pnpm i
pnpm dev    # http://localhost:5173

Set VITE_API_BASE if server is on another host/port.

