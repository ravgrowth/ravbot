create table if not exists subscription_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete cascade,
  action text not null,
  timestamp timestamptz default now()
);
