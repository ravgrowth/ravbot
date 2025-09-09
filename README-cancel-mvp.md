# Cancel Subscriptions MVP

## Setup
1. Create the tables and policies in Supabase:
   ```sql
   \i sql/cancel_mvp.sql
   ```
2. Seed a couple of rows in `subscriptions` for your test user.
3. Run the API server on port 3000 and Vite dev server on 5173. Ensure `SUPABASE_URL` and keys are set:
   ```bash
   npm run dev
   ```

## Demo flow
1. Log in to the dashboard.
2. Subscriptions list shows each subscription and status.
3. Click **Cancel**:
   - Status flips to `cancel_pending` then `cancelled`.
   - A row appears in `subscription_actions`.
4. Reload to confirm the status persists.
