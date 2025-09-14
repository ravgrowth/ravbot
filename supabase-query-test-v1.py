import os, re, psycopg2
from datetime import datetime

ENV_PATH = r"C:\Users\guita\ravbot_testbranch_clones_v1\v2\.env.server"
LOGS_DIR = "logs"

def get_env_db_url():
    with open(ENV_PATH, "r") as f:
        for line in f:
            t = line.strip()
            if t and not t.startswith("#"):
                match = re.match(r'^(?:export\s+)?(?:DATABASE_URL|SUPABASE_DB_URL)\s*=\s*(.+)$', t, re.I)
                if match:
                    return match.group(1).strip().strip('"').strip("'")
    raise ValueError("DATABASE_URL not found in .env.server")

def run_query(conn, query, params=None):
    cur = conn.cursor()
    cur.execute(query, params or ())
    try:
        rows = cur.fetchall()
    except psycopg2.ProgrammingError:
        rows = []
    cur.close()
    return rows

def inspect_schema(conn, dump_rows=False, max_rows=100):
    results = []
    tables = run_query(conn, """
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema='public' 
        ORDER BY table_name;
    """)
    for (table,) in tables:
        res = {"table": table}

        # Columns
        cols = run_query(conn, f"""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema='public' AND table_name=%s;
        """, (table,))
        res["columns"] = cols

        # RLS status
        rls = run_query(conn, """
            SELECT relrowsecurity 
            FROM pg_class 
            WHERE relname=%s;
        """, (table,))
        res["rls_enabled"] = bool(rls and rls[0][0])

        # Policies
        policies = run_query(conn, """
            SELECT policyname, permissive, roles, cmd, qual, with_check 
            FROM pg_policies 
            WHERE schemaname='public' AND tablename=%s;
        """, (table,))
        res["policies"] = policies

        # Row count + optional dump
        count = run_query(conn, f"SELECT count(*) FROM {table};")[0][0]
        res["row_count"] = count
        res["row_sample"] = []
        if dump_rows:
            rows = run_query(conn, f"SELECT * FROM {table} LIMIT %s;", (max_rows,))
            res["row_sample"] = rows

        results.append(res)
    return results

def save_log(results, dump_rows):
    os.makedirs(LOGS_DIR, exist_ok=True)
    log_path = os.path.join(LOGS_DIR, f"schema_{datetime.now():%Y%m%d_%H%M%S}.txt")
    with open(log_path, "w", encoding="utf-8") as f:
        for res in results:
            f.write(f"\n=== TABLE: {res['table']} ===\n")
            f.write("Columns:\n")
            for col in res["columns"]:
                f.write(f"  - {col[0]} ({col[1]})\n")
            f.write(f"RLS enabled: {res['rls_enabled']}\n")
            f.write("Policies:\n")
            for pol in res["policies"]:
                f.write(f"  - {pol}\n")
            f.write(f"Row count: {res['row_count']}\n")
            if dump_rows:
                f.write("Sample rows:\n")
                for row in res["row_sample"]:
                    f.write(f"  {row}\n")
    return log_path

def main():
    print("Mode options:")
    print("1) Schema only (default)")
    print("2) Schema + row sample (warn: can be big!)")

    choice = input("Enter choice (1/2, Enter=1): ").strip() or "1"
    dump_rows = (choice == "2")

    conn_str = get_env_db_url()
    conn = psycopg2.connect(conn_str, sslmode="require")

    results = inspect_schema(conn, dump_rows=dump_rows)
    conn.close()

    log_path = save_log(results, dump_rows)
    print(f"Schema inspection complete. Saved to {log_path}")

if __name__ == "__main__":
    main()
