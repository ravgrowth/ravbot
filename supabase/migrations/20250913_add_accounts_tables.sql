-- Migration: Add accounts and account_balances tables

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  bank_connection_id uuid references public.bank_connections(id) on delete cascade,
  name text not null,
  account_type text not null,
  subtype text,
  balance numeric default 0,
  currency text default 'USD',
  created_at timestamptz default now()
);

create table if not exists public.account_balances (
  id bigint generated always as identity primary key,
  account_id uuid references public.accounts(id) on delete cascade,
  date date not null default current_date,
  balance numeric not null,
  pnl numeric,
  created_at timestamptz default now(),
  unique (account_id, date)
);

