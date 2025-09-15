-- Create lifetime_savings table with RLS
create table if not exists public.lifetime_savings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  saved_amount numeric not null default 0,
  updated_at timestamp with time zone default now()
);

alter table public.lifetime_savings enable row level security;

-- Owner-only policies
create policy if not exists "lifetime_savings_select_own"
  on public.lifetime_savings for select
  using (auth.uid() = user_id);

create policy if not exists "lifetime_savings_insert_own"
  on public.lifetime_savings for insert
  with check (auth.uid() = user_id);

create policy if not exists "lifetime_savings_update_own"
  on public.lifetime_savings for update
  using (auth.uid() = user_id);

create policy if not exists "lifetime_savings_delete_own"
  on public.lifetime_savings for delete
  using (auth.uid() = user_id);

