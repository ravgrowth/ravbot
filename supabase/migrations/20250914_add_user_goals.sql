-- Create user_goals table with RLS
create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  goal_type text not null,
  carrot text,
  target numeric,
  created_at timestamp with time zone default now()
);

alter table public.user_goals enable row level security;

-- Policies: owner-only access
create policy if not exists "user_goals_select_own"
  on public.user_goals for select
  using (auth.uid() = user_id);

create policy if not exists "user_goals_insert_own"
  on public.user_goals for insert
  with check (auth.uid() = user_id);

create policy if not exists "user_goals_update_own"
  on public.user_goals for update
  using (auth.uid() = user_id);

create policy if not exists "user_goals_delete_own"
  on public.user_goals for delete
  using (auth.uid() = user_id);

