create table if not exists transaction_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  transaction_id text not null,
  category text,
  notes text,
  created_at timestamptz default now(),
  unique (user_id, transaction_id)
);

alter table transactions enable row level security;
alter table transaction_overrides enable row level security;
alter table subscriptions enable row level security;

create policy "Users select own transactions" on transactions
  for select using (auth.uid() = user_id);

create policy "Users insert own transactions" on transactions
  for insert with check (auth.uid() = user_id);

create policy "Users manage own overrides" on transaction_overrides
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users select own subscriptions" on subscriptions
  for select using (auth.uid() = user_id);
