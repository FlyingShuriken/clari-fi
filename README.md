# ClariFi Monorepo (Phase 0/1 Baseline)

This repository contains the cleaned Phase 0/1 baseline for ClariFi:

- `apps/api`: NestJS + Prisma API (`infrastructure/` + `modules/`)
- `apps/mobile`: Expo React Native app (feature-first sections)
- `packages/shared`: shared contracts/schemas

## Implemented Core Endpoints

- `POST /v1/auth/clerk/verify`
- `POST /v1/artifacts/upload`
- `POST /v1/parse/voice`
- `POST /v1/parse/receipt`
- `POST /v1/expenses`
- `GET /v1/expenses`
- `GET /v1/reports/monthly?year=YYYY&month=MM`

## Acceptance Check

```bash
pnpm --filter @clarifi/api acceptance:phase1
```

## Package Manager

This workspace uses `pnpm`.

## Mobile Env Setup

Expo resolves app config from `apps/mobile`. For mobile public keys, set either:

- `apps/mobile/.env` (recommended), or
- repo root `.env` (supported by `apps/mobile/app.config.ts` fallback).

Example keys are in [`apps/mobile/.env.example`](apps/mobile/.env.example).
