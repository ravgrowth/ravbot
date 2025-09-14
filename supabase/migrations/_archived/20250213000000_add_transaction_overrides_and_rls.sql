-- Create transaction_overrides table if it doesn't exist
create table if not exists transaction_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  transaction_id text not null,
  category text,
  notes text,
  created_at timestamptz default now(),
  unique (user_id, transaction_id)
);

-- Enable RLS safely
alter table if exists transactions enable row level security;
alter table if exists transaction_overrides enable row level security;
alter table if exists subscriptions enable row level security;

-- Drop + recreate policies (idempotent)
drop policy if exists "Users select own transactions" on transactions;
create policy "Users select own transactions"
on transactions
for select using (auth.uid() = user_id);

drop policy if exists "Users insert own transactions" on transactions;
create policy "Users insert own transactions"
on transactions
for insert with check (auth.uid() = user_id);

drop policy if exists "Users manage own overrides" on transaction_overrides;
create policy "Users manage own overrides"
on transaction_overrides
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users select own subscriptions" on subscriptions;
create policy "Users select own subscriptions"
on subscriptions
for select using (auth.uid() = user_id);
