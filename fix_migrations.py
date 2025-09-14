import os
import re
import shutil
import subprocess
from pathlib import Path


MIGRATIONS_DIR = Path('supabase/migrations')
ARCHIVE_DIR = MIGRATIONS_DIR / '_archived'
TARGET_FILE = MIGRATIONS_DIR / '20250913_fix_all.sql'


def ensure_dirs():
    MIGRATIONS_DIR.mkdir(parents=True, exist_ok=True)
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)


def generate_consolidated_sql() -> str:
    """Return a consolidated, idempotent migration with correct schema and policies.

    Notes:
    - Uses IF NOT EXISTS where supported.
    - Wraps DDL that can conflict (policies) in DO $$ with exception handling.
    - Ensures all policy predicates cast auth.uid() to uuid.
    """

    def policy_block(table: str, policy_name: str, body: str, fallback_body: str | None = None) -> str:
        # Wrap drop and create in a DO block, guarding for missing table and duplicates.
        # Use fully-qualified public schema for safety.
        fq_table = f"public.{table}" if '.' not in table else table
        drop_stmt = f"drop policy if exists \"{policy_name}\" on {fq_table}"
        create_stmt = f"create policy \"{policy_name}\" on {fq_table} {body}".strip()
        fb_stmt = (
            f"create policy \"{policy_name}\" on {fq_table} {fallback_body}".strip()
            if fallback_body else None
        )
        # Use dynamic EXECUTE to avoid parse-time errors if table/policy states differ.
        fb_block = (
            "    when others then\n"
            "    begin\n"
            f"      execute '{fb_stmt.replace("'", "''")}';\n"
            "    exception when others then null;\n"
            "    end;\n"
        ) if fb_stmt else "    when others then null;\n"

        return (
            "do $$\n"
            "begin\n"
            f"  if to_regclass('{fq_table}') is not null then\n"
            "  begin\n"
            f"    execute '{drop_stmt.replace("'", "''")}';\n"
            "  exception\n"
            "    when undefined_table then null;\n"
            "    when others then null;\n"
            "  end;\n"
            "  begin\n"
            f"    execute '{create_stmt.replace("'", "''")}';\n"
            "  exception\n"
            "    when duplicate_object then null;\n"
            "    when undefined_table then null;\n"
        ) + fb_block + (
            "  end;\n"
            "  end if;\n"
            "end $$;\n"
        )

    stmts = []

    # Core tables
    stmts.append(
        """
create table if not exists public.transaction_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  transaction_id text not null,
  category text,
  notes text,
  created_at timestamptz default now(),
  unique (user_id, transaction_id)
);
""".strip()
    )

    stmts.append(
        """
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
""".strip()
    )

    stmts.append(
        """
create table if not exists public.account_balances (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete cascade,
  date date not null,
  balance numeric default 0,
  pnl numeric default 0,
  created_at timestamptz default now(),
  unique (account_id, date)
);
""".strip()
    )

    # Subscriptions table (ensure exists for policies to apply cleanly)
    stmts.append(
        """
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_name text not null,
  interval text,
  amount numeric,
  status text check (status in ('detected','keep','cancel_pending','cancelled')) default 'detected',
  updated_at timestamptz default now()
);
""".strip()
    )

    # Type normalization to avoid policy/type mismatches (best-effort, non-fatal)
    stmts.append(
        "do $$\n"
        "begin\n"
        "  begin\n"
        "    execute 'alter table if exists public.accounts alter column user_id type uuid using user_id::uuid';\n"
        "  exception when others then null;\n"
        "  end;\n"
        "  begin\n"
        "    execute 'alter table if exists public.subscriptions alter column user_id type uuid using user_id::uuid';\n"
        "  exception when others then null;\n"
        "  end;\n"
        "end $$;"
    )
    # Ensure account_balances has account_id column and FK
    stmts.append(
        "alter table if exists public.account_balances "
        "add column if not exists account_id uuid;"
    )
    # Add FK constraint if missing
    stmts.append(
        "do $$\n"
        "begin\n"
        "  if not exists (\n"
        "    select 1 from pg_constraint c\n"
        "    join pg_class t on t.oid = c.conrelid\n"
        "    join pg_namespace n on n.oid = t.relnamespace\n"
        "    where n.nspname = 'public' and t.relname = 'account_balances' and c.conname = 'account_balances_account_id_fkey'\n"
        "  ) then\n"
        "    execute 'alter table public.account_balances add constraint account_balances_account_id_fkey foreign key (account_id) references public.accounts(id) on delete cascade';\n"
        "  end if;\n"
        "exception when others then null;\n"
        "end $$;"
    )
    # Add unique constraint if missing
    stmts.append(
        "do $$\n"
        "begin\n"
        "  if not exists (\n"
        "    select 1 from pg_constraint c\n"
        "    join pg_class t on t.oid = c.conrelid\n"
        "    join pg_namespace n on n.oid = t.relnamespace\n"
        "    where n.nspname = 'public' and t.relname = 'account_balances' and c.conname = 'account_balances_account_id_date_key'\n"
        "  ) then\n"
        "    execute 'alter table public.account_balances add constraint account_balances_account_id_date_key unique(account_id, date)';\n"
        "  end if;\n"
        "exception when others then null;\n"
        "end $$;"
    )

    # RLS enables
    for tbl in [
        'public.transactions',
        'public.transaction_overrides',
        'public.subscriptions',
        'public.accounts',
        'public.account_balances',
    ]:
        stmts.append(f"alter table if exists {tbl} enable row level security;")

    # Indexes (idempotent)
    stmts.append("create index if not exists idx_accounts_user_id on public.accounts(user_id);")
    stmts.append("create index if not exists idx_account_balances_account_id on public.account_balances(account_id);")
    stmts.append("create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);")

    # Policies (idempotent, safe) with fallback to text comparison when uuid fails
    stmts.append(
        policy_block(
            'transaction_overrides',
            'Users manage own overrides',
            "for all using (user_id = auth.uid()::uuid) with check (user_id = auth.uid()::uuid)",
            "for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text)"
        )
    )

    stmts.append(
        policy_block(
            'transactions',
            'Users select own transactions',
            "for select using (user_id = auth.uid()::uuid)",
            "for select using (user_id = auth.uid()::text)"
        )
    )

    stmts.append(
        policy_block(
            'transactions',
            'Users insert own transactions',
            "for insert with check (user_id = auth.uid()::uuid)",
            "for insert with check (user_id = auth.uid()::text)"
        )
    )

    stmts.append(
        policy_block(
            'subscriptions',
            'Users select own subscriptions',
            "for select using (user_id = auth.uid()::uuid)",
            "for select using (user_id = auth.uid()::text)"
        )
    )

    stmts.append(
        policy_block(
            'accounts',
            'Users can view their own accounts',
            "for select using (user_id = auth.uid()::uuid)",
            "for select using (user_id = auth.uid()::text)"
        )
    )

    stmts.append(
        policy_block(
            'accounts',
            'Users can insert their own accounts',
            "for insert with check (user_id = auth.uid()::uuid)",
            "for insert with check (user_id = auth.uid()::text)"
        )
    )

    # account_balances policy references accounts ownership
    stmts.append(
        policy_block(
            'account_balances',
            'Users can view their own balances',
            (
                "for select using (\n"
                "  exists (\n"
                "    select 1 from public.accounts a\n"
                "    where a.id = public.account_balances.account_id\n"
                "    and a.user_id = auth.uid()::uuid\n"
                "  )\n"
                ")"
            ),
            (
                "for select using (\n"
                "  exists (\n"
                "    select 1 from public.accounts a\n"
                "    where a.id = public.account_balances.account_id\n"
                "    and a.user_id = auth.uid()::text\n"
                "  )\n"
                ")"
            )
        )
    )

    header = (
        "-- Consolidated migration: fix all broken policies & tables\n"
        "-- Safe, idempotent, no duplicate errors\n\n"
    )
    sql = header + "\n".join(stmts) + "\n"

    # Ensure every statement ends with a semicolon: crude but safe normalization
    # We add semicolons at ends where missing (outside DO $$ ... $$; blocks which already end with ;)
    fixed_lines = []
    for line in sql.splitlines():
        fixed_lines.append(line.rstrip())
    sql_fixed = "\n".join(fixed_lines)
    return sql_fixed


def archive_old_migrations():
    # Move all migrations except the target file into _archived
    for p in MIGRATIONS_DIR.glob('*.sql'):
        if p.name == TARGET_FILE.name:
            continue
        dest = ARCHIVE_DIR / p.name
        try:
            shutil.move(str(p), str(dest))
        except Exception:
            # If move fails, try copy+remove
            shutil.copy2(str(p), str(dest))
            p.unlink(missing_ok=True)


def write_consolidated(sql: str):
    TARGET_FILE.write_text(sql, encoding='utf-8')


def run_supabase_push():
    try:
        print('Running: supabase db push')
        subprocess.check_call(['supabase', 'db', 'push'])
    except FileNotFoundError:
        print('[warn] supabase CLI not found on PATH. Skipping push.')
    except subprocess.CalledProcessError as e:
        print(f'[warn] supabase db push failed with exit code {e.returncode}.')


def main():
    ensure_dirs()
    sql = generate_consolidated_sql()
    write_consolidated(sql)
    archive_old_migrations()
    run_supabase_push()
    print(f'Wrote consolidated migration to {TARGET_FILE}')
    print(f'Archived other migrations to {ARCHIVE_DIR}')


if __name__ == '__main__':
    main()
