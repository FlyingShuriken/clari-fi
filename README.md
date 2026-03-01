# ClariFi Monorepo (Phase 1 MVP)

This repository contains the Phase 1 implementation scaffold for ClariFi:

- `apps/api`: NestJS + Prisma API
- `apps/mobile`: Expo React Native demo app
- `packages/shared`: Shared contracts/schemas
- `docs/plans`: SDD and project scope

## Implemented Phase 1 Endpoints

- `POST /v1/auth/supabase/verify`
- `POST /v1/expenses/voice/parse`
- `POST /v1/receipts/parse`
- `POST /v1/expenses/confirm`
- `GET /v1/expenses`
- `GET /v1/reports/monthly?year=YYYY&month=MM`

## Quick Start

See `docs/runbooks/phase1-setup.md`.

## Package Manager

This workspace uses `pnpm`.
