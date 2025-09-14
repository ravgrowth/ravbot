-- Ensure accounts.user_id is UUID
alter table if exists accounts
    alter column user_id type uuid using user_id::uuid;

-- Ensure account_balances.account_id is UUID
alter table if exists account_balances
    alter column account_id type uuid using account_id::uuid;

-- Indexes for faster lookups
create index if not exists idx_accounts_user_id on accounts(user_id);
create index if not exists idx_account_balances_account_id on account_balances(account_id);

-- Enable RLS
alter table if exists accounts enable row level security;
alter table if exists account_balances enable row level security;

-- Drop conflicting policies if they exist
drop policy if exists "Users can view their own accounts" on accounts;
drop policy if exists "Users can insert their own accounts" on accounts;
drop policy if exists "Users can view their own account_balances" on account_balances;
drop policy if exists "Users can insert their own account_balances" on account_balances;

-- Recreate policies cleanly
create policy "Users can view their own accounts"
on accounts for select
using (auth.uid() = user_id);

create policy "Users can insert their own accounts"
on accounts for insert
with check (auth.uid() = user_id);

create policy "Users can view their own account_balances"
on account_balances for select
using (
  exists (
    select 1 from accounts
    where accounts.id = account_balances.account_id
    and accounts.user_id = auth.uid()
  )
);

create policy "Users can insert their own account_balances"
on account_balances for insert
with check (
  exists (
    select 1 from accounts
    where accounts.id = account_balances.account_id
    and accounts.user_id = auth.uid()
  )
);
