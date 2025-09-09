-- Create subscriptions table
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  merchant_name text not null,
  interval text,
  amount numeric,
  status text check (status in ('detected','keep','cancel_pending','cancelled')) default 'detected',
  updated_at timestamptz default now()
);

-- Create subscription_actions table
create table if not exists public.subscription_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  action text check (action in ('cancel_request','cancel_success','cancel_error')) not null,
  details jsonb,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.subscriptions enable row level security;
alter table public.subscription_actions enable row level security;

-- Policies
create policy "Select own subscriptions" on public.subscriptions for select using (user_id = auth.uid());

create policy "Select own subscription actions" on public.subscription_actions for select using (user_id = auth.uid());

-- Indexes
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscription_actions_user_id_subscription_id_created_at_idx on public.subscription_actions(user_id, subscription_id, created_at);
