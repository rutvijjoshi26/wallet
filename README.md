# Wallet

A personal expense tracker that imports your transactions for you instead of making you type them in.

Built for my own use. The base app is a straightforward Express + React Native expense tracker; the part I actually cared about building is the Plaid bank-sync layer, described below.

## Stack

- **Mobile:** React Native (Expo, Expo Router), Clerk auth
- **Backend:** Express (Node, ESM), Neon serverless Postgres
- **Infra:** Upstash Redis for rate limiting, Plaid for bank sync

## The sync problem

Transaction sync has to be safe to run repeatedly. A retry, an overlapping request, or a user tapping sync twice must never produce duplicate transactions, because a double-counted expense silently corrupts every balance derived from it.

Three things handle that:

1. **Cursor pagination.** Plaid's `transactionsSync` returns a `next_cursor` marking how far you have read. That cursor is persisted per connection in `plaid_connections` and passed back on the next sync, so each run resumes exactly where the last one stopped rather than re-reading history.
2. **Idempotent inserts.** Every row is inserted with `ON CONFLICT (plaid_transaction_id) DO NOTHING`. Even if the same transaction arrives twice, the second insert is a no-op. The cursor is the fast path; this is the guarantee.
3. **A review queue.** Synced rows land in `plaid_pending_transactions`, not in the real ledger. The user confirms, edits, or discards each one before it counts. An imported transaction with a bad category cannot quietly pollute the data.

The cursor is only advanced after the page is written, so a crash mid-sync re-reads that page rather than skipping it. Re-reading is harmless because of the conflict clause; skipping would not be.

## API

Transactions: `POST /api/transactions`, `GET /api/transactions/:userId`, `GET /api/transactions/summary/:userId`, `GET /api/transactions/month/:userId/:year/:month`, `PUT /api/transactions/:id`, `DELETE /api/transactions/:id`

Plaid: `POST /api/plaid/link-token`, `POST /api/plaid/exchange-token`, `POST /api/plaid/sync`, `GET /api/plaid/accounts/:userId`, `GET /api/plaid/pending/:userId`, `PUT /api/plaid/pending/:id`, `POST /api/plaid/pending/:id/confirm`, `DELETE /api/plaid/pending/:id`

Rate limiting is a 100 request / 60 second sliding window via Upstash, and it fails open: if the limiter itself is unreachable, traffic is allowed through rather than the API going down with it.

## Running it

```bash
cp backend/.env.example backend/.env   # fill in your own values
cd backend && npm install && npm run dev

cp mobile/.env.example mobile/.env
cd mobile && npm install && npm start
```

The `transactions` table is created automatically on backend startup.

## Known limitations

- **Plaid runs against sandbox.** `PLAID_ENV` defaults to `sandbox`, so this has only ever been exercised against Plaid's test institutions, not a real bank.
- **No test suite.** The idempotency logic above is exactly the thing that deserves tests, and it does not have them yet. That is the next thing I would add.
- **Access tokens are stored unencrypted** in `plaid_connections`. Fine for a single-user personal app, not acceptable for anything with real users.
