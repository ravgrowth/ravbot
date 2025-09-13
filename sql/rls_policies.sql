-- Enable RLS and add user-scoped policies for key tables
-- This allows frontend (anon) clients to read/write only their own rows.

-- bank_connections
alter table if exists public.bank_connections enable row level security;

create policy if not exists "bank_connections_select_own"
on public.bank_connections
for select
using ( auth.uid() = user_id );

create policy if not exists "bank_connections_insert_own"
on public.bank_connections
for insert
with check ( auth.uid() = user_id );

create policy if not exists "bank_connections_update_own"
on public.bank_connections
for update
using ( auth.uid() = user_id )
with check ( auth.uid() = user_id );

-- subscriptions
alter table if exists public.subscriptions enable row level security;

create policy if not exists "subscriptions_select_own"
on public.subscriptions
for select
using ( auth.uid() = user_id );

create policy if not exists "subscriptions_insert_own"
on public.subscriptions
for insert
with check ( auth.uid() = user_id );

create policy if not exists "subscriptions_update_own"
on public.subscriptions
for update
using ( auth.uid() = user_id )
with check ( auth.uid() = user_id );

-- money_actions
alter table if exists public.money_actions enable row level security;

create policy if not exists "money_actions_select_own"
on public.money_actions
for select
using ( auth.uid() = user_id );

create policy if not exists "money_actions_insert_own"
on public.money_actions
for insert
with check ( auth.uid() = user_id );

create policy if not exists "money_actions_update_own"
on public.money_actions
for update
using ( auth.uid() = user_id )
with check ( auth.uid() = user_id );

