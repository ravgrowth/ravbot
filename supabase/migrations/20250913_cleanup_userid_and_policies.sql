-- Normalize user_id to uuid everywhere, future-proofed.

-- Step 1: Ensure columns are uuid
alter table if exists accounts
  alter column user_id type uuid using user_id::uuid;

alter table if exists account_balances
  alter column user_id type uuid using user_id::uuid;

alter table if exists subscriptions
  alter column user_id type uuid using user_id::uuid;

alter table if exists transaction_overrides
  alter column user_id type uuid using user_id::uuid;

-- Step 2: Reset RLS policies idempotently
do $$
begin
  -- Accounts
  if exists (select 1 from pg_policies where policyname = 'Users can view their own accounts') then
    drop policy "Users can view their own accounts" on accounts;
  end if;
  create policy "Users can view their own accounts" on accounts
    for select using (user_id = auth.uid());

  if exists (select 1 from pg_policies where policyname = 'Users can insert their own accounts') then
    drop policy "Users can insert their own accounts" on accounts;
  end if;
  create policy "Users can insert their own accounts" on accounts
    for insert with check (user_id = auth.uid());

  -- Account balances
  if exists (select 1 from pg_policies where policyname = 'Users can view their balances') then
    drop policy "Users can view their balances" on account_balances;
  end if;
  create policy "Users can view their balances" on account_balances
    for select using (
      account_id in (select id from accounts where user_id = auth.uid())
    );

  -- Subscriptions
  if exists (select 1 from pg_policies where policyname = 'Users select own subscriptions') then
    drop policy "Users select own subscriptions" on subscriptions;
  end if;
  create policy "Users select own subscriptions" on subscriptions
    for select using (user_id = auth.uid());

  -- Transaction overrides
  if exists (select 1 from pg_policies where policyname = 'Users manage own overrides') then
    drop policy "Users manage own overrides" on transaction_overrides;
  end if;
  create policy "Users manage own overrides" on transaction_overrides
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
end $$;
