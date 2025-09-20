-- Idempotent self-heal for core RavBot tables and columns
-- Safe for repeated execution; only creates missing objects.

-- user_goals
create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  goal_type text,
  carrot text,
  target numeric,
  created_at timestamptz default now()
);
alter table public.user_goals enable row level security;
do $$ begin
  begin execute 'create policy "user_goals_select_own" on public.user_goals for select using (auth.uid() = user_id)'; exception when duplicate_object then null; end;
  begin execute 'create policy "user_goals_insert_own" on public.user_goals for insert with check (auth.uid() = user_id)'; exception when duplicate_object then null; end;
  begin execute 'create policy "user_goals_update_own" on public.user_goals for update using (auth.uid() = user_id)'; exception when duplicate_object then null; end;
  begin execute 'create policy "user_goals_delete_own" on public.user_goals for delete using (auth.uid() = user_id)'; exception when duplicate_object then null; end;
end $$;

-- lifetime_savings
create table if not exists public.lifetime_savings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  saved_amount numeric default 0,
  updated_at timestamptz default now()
);
alter table public.lifetime_savings enable row level security;
do $$ begin
  begin execute 'create policy "lifetime_savings_select_own" on public.lifetime_savings for select using (auth.uid() = user_id)'; exception when duplicate_object then null; end;
  begin execute 'create policy "lifetime_savings_insert_own" on public.lifetime_savings for insert with check (auth.uid() = user_id)'; exception when duplicate_object then null; end;
  begin execute 'create policy "lifetime_savings_update_own" on public.lifetime_savings for update using (auth.uid() = user_id)'; exception when duplicate_object then null; end;
  begin execute 'create policy "lifetime_savings_delete_own" on public.lifetime_savings for delete using (auth.uid() = user_id)'; exception when duplicate_object then null; end;
end $$;

-- user_budgets
create table if not exists public.user_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  rent numeric,
  essentials numeric,
  lifestyle numeric,
  created_at timestamptz default now()
);
alter table public.user_budgets enable row level security;
do $$ begin
  begin execute 'create policy "user_budgets_select_own" on public.user_budgets for select using (auth.uid() = user_id)'; exception when duplicate_object then null; end;
  begin execute 'create policy "user_budgets_insert_own" on public.user_budgets for insert with check (auth.uid() = user_id)'; exception when duplicate_object then null; end;
  begin execute 'create policy "user_budgets_update_own" on public.user_budgets for update using (auth.uid() = user_id)'; exception when duplicate_object then null; end;
  begin execute 'create policy "user_budgets_delete_own" on public.user_budgets for delete using (auth.uid() = user_id)'; exception when duplicate_object then null; end;
end $$;

-- idle_cash_recommendations: ensure idle_amount column
create table if not exists public.idle_cash_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  idle_amount numeric,
  account_name text,
  institution_name text,
  bank_name text,
  suggested_target text,
  est_apy numeric,
  recommendation text,
  apy numeric,
  account_id text,
  created_at timestamptz default now()
);
alter table public.idle_cash_recommendations add column if not exists idle_amount numeric;

