# RavBot

Layer-0 MVP: connect accounts, surface money leaks, and show instant wins.

What’s included:
- Plaid connection flow (sandbox) and secure token exchange
- Account + transaction fetch routes
- Subscription detection + listing with safe cancel links (no auto-cancel)
- Idle Cash widget (from `idle_cash_recommendations` + `_v2`)
- Growth Gap widget with lifestyle equivalents
- Vite proxy to backend on `:3000`

Backend (Node ESM):
- Routes:
  - `POST /api/linkToken`
  - `POST /api/exchangePublicToken`
  - `POST /api/getAccounts`
  - `POST /api/getTransactions`
  - `POST /api/syncSubscriptions`
  - `POST /api/subscriptions/scan`
  - `GET /api/subscriptions/list`
  - `POST /api/subscriptions/cancel`
  - `POST /api/sandbox/fireTransactions`
- All DB access uses `@supabase/supabase-js`. User-bound routes require `Authorization: Bearer <access_token>` and operate under RLS.

Frontend (React/Vite):
- `src/components/IdleCash.jsx`: combines both idle cash sources and suggests moves
- `src/components/GrowthGap.jsx`: estimates yearly gains lost by idle cash
- `src/components/Subscriptions.jsx`: shows merchant, amount, cadence, status; Cancel opens merchant site/help
- `src/pages/dashboard.jsx`: integrates BankConnections, Transactions, Subscriptions, IdleCash, GrowthGap

Tests:
- `lib/idleCash.test.js`, `lib/growth.test.js`, plus existing `lib/subscriptions.test.js`

Run locally:
- Env: add `.env.server` with `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, Plaid sandbox creds
- `npm install`
- In one terminal: `node server.mjs`
- In another: `npm run dev`
- Vite proxies `/api` → `http://localhost:3000`

Notes:
- Subscription cancel route is a no-op in UI; it opens merchant links for safety/legal compliance.
- RLS: server endpoints that mutate user data require a valid Supabase user access token.
