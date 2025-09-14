-- Consolidated migration: fix all broken policies & tables
-- Safe, idempotent, no duplicate errors

create table if not exists public.transaction_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  transaction_id text not null,
  category text,
  notes text,
  created_at timestamptz default now(),
  unique (user_id, transaction_id)
);
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  bank_connection_id uuid,
  name text,
  account_type text,
  subtype text,
  balance numeric default 0,
  currency text,
  created_at timestamptz default now()
);
create table if not exists public.account_balances (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete cascade,
  date date not null,
  balance numeric default 0,
  pnl numeric default 0,
  created_at timestamptz default now(),
  unique (account_id, date)
);
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_name text not null,
  interval text,
  amount numeric,
  status text check (status in ('detected','keep','cancel_pending','cancelled')) default 'detected',
  updated_at timestamptz default now()
);
do $$
begin
  begin
    execute 'alter table if exists public.accounts alter column user_id type uuid using user_id::uuid';
  exception when others then null;
  end;
  begin
    execute 'alter table if exists public.subscriptions alter column user_id type uuid using user_id::uuid';
  exception when others then null;
  end;
end $$;
alter table if exists public.account_balances add column if not exists account_id uuid;
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'account_balances' and c.conname = 'account_balances_account_id_fkey'
  ) then
    execute 'alter table public.account_balances add constraint account_balances_account_id_fkey foreign key (account_id) references public.accounts(id) on delete cascade';
  end if;
exception when others then null;
end $$;
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'account_balances' and c.conname = 'account_balances_account_id_date_key'
  ) then
    execute 'alter table public.account_balances add constraint account_balances_account_id_date_key unique(account_id, date)';
  end if;
exception when others then null;
end $$;
alter table if exists public.transactions enable row level security;
alter table if exists public.transaction_overrides enable row level security;
alter table if exists public.subscriptions enable row level security;
alter table if exists public.accounts enable row level security;
alter table if exists public.account_balances enable row level security;
create index if not exists idx_accounts_user_id on public.accounts(user_id);
create index if not exists idx_account_balances_account_id on public.account_balances(account_id);
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
do $$
begin
  if to_regclass('public.transaction_overrides') is not null then
  begin
    execute 'drop policy if exists "Users manage own overrides" on public.transaction_overrides';
  exception
    when undefined_table then null;
    when others then null;
  end;
  begin
    execute 'create policy "Users manage own overrides" on public.transaction_overrides for all using (user_id = auth.uid()::uuid) with check (user_id = auth.uid()::uuid)';
  exception
    when duplicate_object then null;
    when undefined_table then null;
    when others then
    begin
      execute 'create policy "Users manage own overrides" on public.transaction_overrides for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text)';
    exception when others then null;
    end;
  end;
  end if;
end $$;

do $$
begin
  if to_regclass('public.transactions') is not null then
  begin
    execute 'drop policy if exists "Users select own transactions" on public.transactions';
  exception
    when undefined_table then null;
    when others then null;
  end;
  begin
    execute 'create policy "Users select own transactions" on public.transactions for select using (user_id = auth.uid()::uuid)';
  exception
    when duplicate_object then null;
    when undefined_table then null;
    when others then
    begin
      execute 'create policy "Users select own transactions" on public.transactions for select using (user_id = auth.uid()::text)';
    exception when others then null;
    end;
  end;
  end if;
end $$;

do $$
begin
  if to_regclass('public.transactions') is not null then
  begin
    execute 'drop policy if exists "Users insert own transactions" on public.transactions';
  exception
    when undefined_table then null;
    when others then null;
  end;
  begin
    execute 'create policy "Users insert own transactions" on public.transactions for insert with check (user_id = auth.uid()::uuid)';
  exception
    when duplicate_object then null;
    when undefined_table then null;
    when others then
    begin
      execute 'create policy "Users insert own transactions" on public.transactions for insert with check (user_id = auth.uid()::text)';
    exception when others then null;
    end;
  end;
  end if;
end $$;

do $$
begin
  if to_regclass('public.subscriptions') is not null then
  begin
    execute 'drop policy if exists "Users select own subscriptions" on public.subscriptions';
  exception
    when undefined_table then null;
    when others then null;
  end;
  begin
    execute 'create policy "Users select own subscriptions" on public.subscriptions for select using (user_id = auth.uid()::uuid)';
  exception
    when duplicate_object then null;
    when undefined_table then null;
    when others then
    begin
      execute 'create policy "Users select own subscriptions" on public.subscriptions for select using (user_id = auth.uid()::text)';
    exception when others then null;
    end;
  end;
  end if;
end $$;

do $$
begin
  if to_regclass('public.accounts') is not null then
  begin
    execute 'drop policy if exists "Users can view their own accounts" on public.accounts';
  exception
    when undefined_table then null;
    when others then null;
  end;
  begin
    execute 'create policy "Users can view their own accounts" on public.accounts for select using (user_id = auth.uid()::uuid)';
  exception
    when duplicate_object then null;
    when undefined_table then null;
    when others then
    begin
      execute 'create policy "Users can view their own accounts" on public.accounts for select using (user_id = auth.uid()::text)';
    exception when others then null;
    end;
  end;
  end if;
end $$;

do $$
begin
  if to_regclass('public.accounts') is not null then
  begin
    execute 'drop policy if exists "Users can insert their own accounts" on public.accounts';
  exception
    when undefined_table then null;
    when others then null;
  end;
  begin
    execute 'create policy "Users can insert their own accounts" on public.accounts for insert with check (user_id = auth.uid()::uuid)';
  exception
    when duplicate_object then null;
    when undefined_table then null;
    when others then
    begin
      execute 'create policy "Users can insert their own accounts" on public.accounts for insert with check (user_id = auth.uid()::text)';
    exception when others then null;
    end;
  end;
  end if;
end $$;

do $$
begin
  if to_regclass('public.account_balances') is not null then
  begin
    execute 'drop policy if exists "Users can view their own balances" on public.account_balances';
  exception
    when undefined_table then null;
    when others then null;
  end;
  begin
    execute 'create policy "Users can view their own balances" on public.account_balances for select using (
  exists (
    select 1 from public.accounts a
    where a.id = public.account_balances.account_id
    and a.user_id = auth.uid()::uuid
  )
)';
  exception
    when duplicate_object then null;
    when undefined_table then null;
    when others then
    begin
      execute 'create policy "Users can view their own balances" on public.account_balances for select using (
  exists (
    select 1 from public.accounts a
    where a.id = public.account_balances.account_id
    and a.user_id = auth.uid()::text
  )
)';
    exception when others then null;
    end;
  end;
  end if;
end $$;
