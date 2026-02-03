# LockedIn

MVP social campus app for meeting friends, collaborators, and cofounders (not dating-first). Built with Next.js App Router, Express, and Postgres-ready plumbing.

## Repo layout
- `apps/web` - Next.js frontend (App Router + Tailwind)
- `apps/api` - Express API (routes/controllers/services/db)
- `packages/shared` - Shared TypeScript types

## Local development
1. Install deps
   - `npm install`
2. Start frontend
   - `npm run dev:web`
3. Start API
   - `npm run dev:api`

## Environment variables
Create `.env` files or copy from `.env.example`.

Frontend (`apps/web/.env.local`)
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:4001
```

API (`apps/api/.env`)
```
PORT=4001
DATABASE_URL=postgresql://user:password@localhost:5432/lockedin
REDIS_URL=redis://localhost:6379
```

## Deployment
Frontend (Vercel)
- Set `NEXT_PUBLIC_API_BASE_URL` to your Railway API URL
- Set `NEXT_PUBLIC_MAPBOX_TOKEN` for Mapbox-powered maps
- Build command: `npm run build -w apps/web`
- Output: default Next.js

Backend + DB (Railway)
- Add a Postgres service and set `DATABASE_URL`
- Add a Redis service and set `REDIS_URL`
- Start command: `npm run start -w apps/api`
- Build command: `npm run build -w apps/api`

## Notes
- Chat and map provider data are intentionally stubbed for MVP speed.
- Mock data lives in `apps/web/features/*/mock.ts` and `apps/api/src/services/mockData.ts`.
- Auth uses a `users` table in Postgres and stores sessions in Redis.

