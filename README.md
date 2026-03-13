# ClariFi Monorepo

ClariFi is a React Native + NestJS product for fast expense capture (voice/receipt), personal reporting, and community price intelligence.

## Link To Materials 
- Demo Video :https://youtu.be/yeskPQPnGgw
- Report :https://drive.google.com/file/d/1kbjdI1CLgrHf5ob9_jE0mV77_nhqvv3n/view?usp=sharing

## Repository Layout

- `apps/api`: NestJS API + Prisma (`src/modules`, `prisma`, `scripts`).
- `apps/mobile`: Expo React Native app.
- `packages/shared`: shared contracts (Zod/TS) used by API and mobile.
- `tasks`: execution plans and test runbooks.

## Core API Domains (Current)

- Auth (`/v1/auth/clerk`)
- Health (`/v1/health/live`, `/v1/health/ready`)
- Parse (`/v1/parse/voice`, `/v1/parse/receipt`)
- Expenses + Reports (`/v1/expenses`, `/v1/reports/monthly`)
- Prices + Signals + Alerts (`/v1/prices/*`)
- Families + Splits (`/v1/families`, `/v1/splits`)

## Commands

```bash
pnpm install
pnpm dev:api
pnpm dev:mobile
pnpm test
pnpm build
pnpm verify:phase4c
```

## Environment

- Root `.env` is private and ignored.
- Use `.env.example` files for required keys.
- Mobile public keys live in `apps/mobile/.env` and are exposed through `EXPO_PUBLIC_*`.

## Notes

- `docs/` is intentionally gitignored in this baseline.
- Native mobile folders (`apps/mobile/ios`, `apps/mobile/android`) are generated artifacts and untracked.

## Phase 4C Verification

- Run `pnpm verify:phase4c` before cutting an internal beta baseline.
- Use the Account tab in the mobile app to verify:
  - backend user sync
  - `/v1/health/live` and `/v1/health/ready`
  - current registered push devices
- Follow `tasks/phase4c-mobile-smoke.md` for the full iPhone smoke sequence.
