-- supabase/migrations/20250913_fix_all_policies.sql

-- Accounts
drop policy if exists "Users can view their own accounts" on accounts;
create policy "Users can view their own accounts"
  on accounts for select
  using (user_id = auth.uid());

-- Account balances
drop policy if exists "Users can view their own balances" on account_balances;
create policy "Users can view their own balances"
  on account_balances for select
  using (
    exists (
      select 1 from accounts a
      where a.id = account_balances.account_id
      and a.user_id = auth.uid()
    )
  );

-- Subscriptions
drop policy if exists "Users select own subscriptions" on subscriptions;
create policy "Users select own subscriptions"
  on subscriptions for select
  using (user_id = auth.uid());

-- Transaction overrides
drop policy if exists "Users manage own overrides" on transaction_overrides;
create policy "Users manage own overrides"
  on transaction_overrides for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
