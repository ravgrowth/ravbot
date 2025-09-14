-- supabase/migrations/20250913_fix_accounts_policy_type.sql

drop policy if exists "Users can view their own accounts" on accounts;

create policy "Users can view their own accounts"
on accounts
for select
using (user_id = auth.uid());
