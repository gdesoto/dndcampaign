# Milestone A Checklist (Skeleton + Auth + DB)

Status legend: [ ] not started, [~] in progress, [x] done.

## 1) Project skeleton + config
- [x] Confirm Nuxt app boots with @nuxt/ui + Pinia + Tailwind
- [x] Add base layouts (public + app shell)
- [x] Add global auth middleware (redirects to login)
- [x] Add core composables (useApi, useAuth)

## 2) Auth (nuxt-auth-utils)
- [x] Decide auth flow (email/password, cookie sessions)
- [x] Add auth runtime config + env vars
- [x] Implement auth API endpoints:
  - [x] POST /api/auth/login
  - [x] POST /api/auth/logout
  - [x] GET /api/auth/me
- [x] Implement password hashing + verification
- [x] Implement session storage (DB or server-side cookies)
- [x] Add login page + basic form validation
- [x] Add auth store (Pinia) with session bootstrap
- [x] Protect /campaigns routes (middleware)

## 3) Database (Prisma)
- [x] Define Prisma schema for:
  - [x] users
  - [x] campaigns
- [x] Add required indexes + relations
- [x] Add Prisma client helper on server
- [x] Run initial migration
- [x] Add seed script (user + campaign)

## 4) Campaign CRUD (API)
- [x] GET /api/campaigns
- [x] POST /api/campaigns
- [x] GET /api/campaigns/:campaignId
- [x] PATCH /api/campaigns/:campaignId
- [x] Enforce campaign ownership in all endpoints
- [x] Zod validation on writes
- [x] Standard response envelope

## 5) Campaign UI
- [x] Campaign list page (/campaigns)
- [x] Create campaign modal/drawer
- [x] Overview page (/campaigns/[campaignId])
- [x] Empty states + loading states

## 6) Acceptance checks
- [x] Login redirects to /campaigns
- [x] Refresh preserves session (cookie auth)
- [x] Create campaign → list/overview updates
- [x] Prisma migration runs cleanly
- [x] App runs successfully (dev server)
