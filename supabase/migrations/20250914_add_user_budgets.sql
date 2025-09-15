-- Create user_budgets table with RLS (percent allocation sliders)
create table if not exists public.user_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  rent numeric,
  essentials numeric,
  lifestyle numeric,
  created_at timestamp with time zone default now()
);

alter table public.user_budgets enable row level security;

create policy if not exists "user_budgets_select_own"
  on public.user_budgets for select
  using (auth.uid() = user_id);

create policy if not exists "user_budgets_insert_own"
  on public.user_budgets for insert
  with check (auth.uid() = user_id);

create policy if not exists "user_budgets_update_own"
  on public.user_budgets for update
  using (auth.uid() = user_id);

create policy if not exists "user_budgets_delete_own"
  on public.user_budgets for delete
  using (auth.uid() = user_id);

