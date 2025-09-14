-- Enable RLS safely
alter table if exists transaction_overrides enable row level security;

-- Drop existing policy if it exists
drop policy if exists "Users manage own overrides" on transaction_overrides;

-- Create policy fresh
create policy "Users manage own overrides"
on transaction_overrides
for all
using (user_id = auth.uid())
with check (auth.uid() = user_id);

------------------------------------------------------------
-- ACCOUNTS TABLE POLICIES
------------------------------------------------------------

alter table if exists accounts enable row level security;

drop policy if exists "Users can view their own accounts" on accounts;
create policy "Users can view their own accounts"
on accounts
for select
using (user_id = auth.uid())

drop policy if exists "Users can insert their own accounts" on accounts;
create policy "Users can insert their own accounts"
on accounts
for insert
with check (auth.uid() = user_id);

------------------------------------------------------------
-- ACCOUNT_BALANCES TABLE POLICIES
------------------------------------------------------------

alter table if exists account_balances enable row level security;

drop policy if exists "Users can view balances for their accounts" on account_balances;
create policy "Users can view balances for their accounts"
on account_balances
for select
using (
  exists (
    select 1 from accounts
    where accounts.id = account_balances.account_id
    and accounts.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert balances for their accounts" on account_balances;
create policy "Users can insert balances for their accounts"
on account_balances
for insert
with check (
  exists (
    select 1 from accounts
    where accounts.id = account_balances.account_id
    and accounts.user_id = auth.uid()
  )
);
