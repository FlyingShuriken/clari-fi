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

## Getting Started on macOS (Backend + iOS Simulator)

Use this flow when developing on a MacBook with Xcode and the iOS Simulator.

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure the backend

Copy the API env file:

```bash
cp apps/api/.env.example apps/api/.env
```

Then update `apps/api/.env` with the required values:

- `DATABASE_URL`
- `CLERK_SECRET_KEY`
- `OPENROUTER_API_KEY` if you keep `EXPENSE_PARSER_PROVIDER=openrouter`

If you only need a basic local boot first, switch `EXPENSE_PARSER_PROVIDER=heuristic` to avoid requiring OpenRouter during startup.

Make sure PostgreSQL is running, then apply Prisma migrations:

```bash
pnpm --filter @clarifi/api prisma:migrate
```

### 3. Start the backend

In the first terminal, run:

```bash
pnpm dev:api
```

The backend will be available at `http://localhost:3000/v1`.

### 4. Configure the mobile app for the iOS Simulator

Copy the mobile env file:

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Then set these values in `apps/mobile/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/v1
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
EXPO_PUBLIC_STT_ON_DEVICE_ENABLED=true
```

For the iOS Simulator on macOS, `localhost` is the correct backend URL. Only use a LAN IP such as `http://192.168.x.x:3000/v1` when testing on a physical iPhone.

### 5. Launch the app in the Apple iOS Simulator

In a second terminal, run:

```bash
pnpm --filter @clarifi/mobile ios
```

This will generate the native iOS project if needed, open the iOS Simulator, and run the app against your local backend.

### 6. Verify the connection

After the app opens:

- sign in
- open the `Account` tab
- tap `Check health`
- tap `Sync user`

If `Live` and `Ready` show as healthy, the simulator is connected to the backend correctly.

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

## Architecture Diagram (Direct)

![tech stack](assets/architecture.png)

## What's New

| Feature                      | Preliminary Version                                                                                                                              | Refined Version                                                                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI Fast Expense Capture**  | Voice or receipt photo capture. User reviews the parsed result and confirms it.                                                                  | Unchanged. Core frictionless capture remains the foundation of the product.                                                                                                                                                                                    |
| **Price Comparison Feature** | Converts captured bills and promotional brochures into price observations. Users can search for one item and compare prices at different stores. | Powered by direct partnerships with local groceries or supermarkets and crowdsourced receipts, building a living, real-time local price database.                                                                                                              |
| **Bucket Feature**           | Not fully implemented in the preliminary version.                                                                                                | Users can add multiple items into a list and build a price matrix across nearby stores. The system calculates total basket cost at each location, weights results by proximity, and recommends the single most worthwhile store to buy everything in one trip. |
| **Expense Breakdown**        | View and filter recorded expenses.                                                                                                               | Unchanged. Surfaces spending patterns and category-level leaks on a monthly basis.                                                                                                                                                                             |
| **Alerts & Notifications**   | Create threshold alerts and receive event notifications when conditions are met.                                                                 | Unchanged. Proactively notifies users of price changes and budget thresholds.                                                                                                                                                                                  |
| **AI Purchase Insights**     | Not included in the preliminary version.                                                                                                         | AI analyses each purchase, flags overspending, directs users to cheaper alternatives using Community Price Intelligence, and explains price increases through real economy trends.                                                                             |
| **Family Profile**           | Share a family profile to track each other's spending and share promotions or deals.                                                             | Retained as a supporting feature. Enables shared household visibility and expense splitting.                                                                                                                                                                   |

The refined version of ClariFi improves the project in three major ways:

1. **Clearer consumer-facing problem framing** The problem is now centred around “Data Darkness”, making it easier for users and judges to understand the real pain point.
2. **Stronger feature logic** The price comparison feature has evolved from single-item lookup into a basket-based recommendation system that considers both total cost and proximity.
3. **More convincing AI validation** The AI logic is now better defined through capture intelligence, purchase intelligence, and basket intelligence, each with specific technologies, reasoning methods, and outputs.
