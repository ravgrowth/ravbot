-- Create investment_positions table with RLS
create table if not exists public.investment_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  asset text not null,
  balance numeric not null default 0,
  updated_at timestamp with time zone default now()
);

alter table public.investment_positions enable row level security;

create policy if not exists "investment_positions_select_own"
  on public.investment_positions for select
  using (auth.uid() = user_id);

create policy if not exists "investment_positions_insert_own"
  on public.investment_positions for insert
  with check (auth.uid() = user_id);

create policy if not exists "investment_positions_update_own"
  on public.investment_positions for update
  using (auth.uid() = user_id);

create policy if not exists "investment_positions_delete_own"
  on public.investment_positions for delete
  using (auth.uid() = user_id);

