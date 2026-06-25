---
name: database-migration
description: Canonical, config-driven workflow for database schema changes — new tables, columns, RLS/row-security policies, indexes, triggers, functions, and constraints — for whatever database platform the project uses. Reads ${backend.platform} and ${backend.migrationsDir} from .claude/stack.md and adapts (e.g. supabase, prisma, postgres, drizzle); no-ops when the platform is none. Enforces a declarative-schema-paired-with-idempotent-migration discipline, the schema/migration sync rule, row-level security with a service-role policy where the platform supports it, policy-column indexing, and a "never apply a migration without explicit approval" guardrail. Use when the user asks to add/alter a table, add a policy, add an index, add a trigger/function, write a migration, or when the diff touches the configured migrations dir. For feature/router work that consumes the new table prefer backend-feature-workflow; for serverless/edge config prefer serverless-function.
---

# Database Migration

Canonical, **config-driven** workflow for database schema changes. The reasoning below — two paired files, idempotency, row-security, FKs, ordered application, an approval gate — holds for any relational platform; only the concrete tool and paths come from config.

> **Read `.claude/stack.md` first.** Use its values; never assume a specific tool. Read `${backend.platform}`
> and `${backend.migrationsDir}` (plus the platform's migrate command, e.g. `${backend.migrateCmd}`).
> If `${backend.platform}` is **`none`**, this skill is a **no-op** — tell the user there is no configured
> database platform, so there is nothing to migrate, and stop. If a needed capability is otherwise
> `none`/empty, skip those steps. If `.claude/stack.md` is missing, run the **`onboarding`** skill and stop.
> Concrete tools below (Supabase, Prisma, Postgres, Drizzle) are **examples** — match the configured platform.

## Two files, always

Every database change produces **two artifacts** that stay in sync:

1. **Declarative schema file** — the source of truth (documentation, onboarding reference, local-reset template). Lives wherever your platform keeps declarative schema (e.g. a `schemas/NN_*.sql` file, a Prisma `schema.prisma` block, a Drizzle schema module).
2. **Migration file** — what actually gets applied to databases, under `${backend.migrationsDir}` with the platform's naming (e.g. timestamped `YYYYMMDDHHMMSS_<descriptive_name>.sql`, or a generated migration via the platform's migrate command).

**The declarative schema alone is not applied.** Skipping the migration is the single most common failure mode (symptom: missing-table/missing-trigger errors in tests, e.g. "No status history found for order"). If your platform generates migrations *from* the declarative schema (some ORMs do), the "two files" rule collapses to "regenerate + commit the migration" — but the migration artifact must still exist in git.

```
# Example (a platform with explicit declarative + migration files):
✅ schemas/09_order_status_trigger.sql
✅ ${backend.migrationsDir}/20260124185200_add_order_status_change_trigger.sql
```

## Approval guardrail (non-negotiable)

**Never apply a migration to any shared/remote database without explicit user approval in the conversation.** This applies to every mechanism — a CLI push, a dashboard apply, or an MCP/tool call that runs DDL (e.g. an `apply_migration` tool).

| Operation | Without approval |
|---|---|
| Read-only queries (SELECT), listing tables/migrations, reading logs | allowed |
| Applying a migration / running DDL against a shared or remote DB | **requires explicit user approval** |

Workflow: create the migration file, show it to the user, and let them apply it (CLI, dashboard, or an approved tool call). Rationale: migrations are permanent, must live in git, and must be reviewed before reaching prod.

## File layout

- **Declarative schema** — per the platform's convention (e.g. numeric-prefixed `schemas/NN_<name>.sql` to control load order; a single ORM schema file; a Drizzle schema module).
- **Migration files** — under `${backend.migrationsDir}`, named with the platform's scheme (e.g. timestamped `YYYYMMDDHHMMSS_<descriptive_name>.sql`). Generate with the platform's command (e.g. a `migration new <descriptive_name>` subcommand of `${backend.migrateCmd}`).
- Descriptive names: `add_order_status_change_trigger`, `add_dependents` — never `update`, `fix`, `changes`.

## SQL / schema style

- Lowercase keywords, `snake_case` tables/columns, plural table names (or follow the project's established style).
- Comments on every table and on non-obvious columns / functions.
- Default to the platform's primary schema (e.g. Postgres `public`) unless there's a clear reason to split.

```sql
create table if not exists public.user_profiles (
  id uuid primary key,
  email text not null
);
comment on table public.user_profiles is 'User profiles.';
```

## Idempotency — required on every schema and migration file

If CI replays migrations **and** declarative schema in sequence (most platforms' validation step does), any `CREATE X` that hits an existing object fails the job. Every statement must be safe to re-run.

| Object | Idempotent pattern (SQL example) |
|---|---|
| Table | `create table if not exists public.x (...)` |
| Column add | `alter table public.x add column if not exists y ...` or a `do $$ ... if not exists (information_schema.columns) ... $$;` guard |
| Constraint add | `do $$ ... if not exists (select 1 from pg_constraint where conname = '...') ... $$;` |
| Index | `create index if not exists idx_x on public.x(col);` |
| Unique index | `create unique index if not exists idx_x_uniq on public.x(col);` |
| Policy | `drop policy if exists "<name>" on public.x; create policy "<name>" ...` |
| Trigger | `drop trigger if exists <name> on public.x; create trigger <name> ...` |
| Function | `create or replace function public.f() ...` |
| Seed insert | `insert into ... values (...) on conflict (key) do nothing;` |

In SQL, most `ALTER TABLE` operations are naturally idempotent (`ENABLE ROW LEVEL SECURITY`, `ALTER COLUMN SET/DROP DEFAULT`, `SET/DROP NOT NULL`, `DROP COLUMN IF EXISTS`, `DROP CONSTRAINT IF EXISTS`). Only `ADD COLUMN` and `ADD CONSTRAINT` need explicit guards. (ORMs that diff-and-generate handle re-run safety for you — verify the generated migration is still idempotent before committing.)

## Row-level security — on, with a privileged-role policy (where the platform supports it)

If your platform has row-level security (e.g. Postgres RLS), enable it on any table that holds user or tenant data, and add a policy for the privileged role your serverless/backend code runs as (e.g. a `service_role`). If the platform has no row-security concept, enforce access control in the application layer instead — skip this section.

```sql
alter table public.orders enable row level security;

-- User-facing policy (per operation)
drop policy if exists "users_can_read_own_orders" on public.orders;
create policy "users_can_read_own_orders"
  on public.orders for select to authenticated
  using ((select auth.uid()) = user_id);

-- Privileged-role policy (backend/serverless code runs as this role)
drop policy if exists "service_role_manages_orders" on public.orders;
create policy "service_role_manages_orders"
  on public.orders for all to service_role
  using (true) with check (true);
```

Rules:
- Separate policies per operation (`select`, `insert`, `update`, `delete`) rather than one `for all` with mixed `using/with check`.
- Use the cached form of the current-user function where the platform offers one (e.g. `(select auth.uid())` instead of bare `auth.uid()` in Postgres) for performance.
- Add an index on every column used inside a policy's `using` / `with check` clause.

## Foreign keys

Use proper constraints with explicit cascade behavior:

```sql
constraint order_status_history_order_id_fkey
  foreign key (order_id) references public.orders(id)
  on delete cascade
```

Choose `on delete cascade | set null | restrict` deliberately per relationship. Never omit the FK.

## Migration file structure (SQL example)

```sql
-- =============================================================================
-- Migration: Add order status change trigger
-- =============================================================================
-- Purpose: Insert audit row whenever orders.status changes.
-- Dependencies: public.orders, public.order_status_history
-- =============================================================================

-- 1. Drops for idempotency
drop trigger if exists orders_status_change_trigger on public.orders;
drop function  if exists public.log_order_status_change() cascade;

-- 2. Create / modify
create or replace function public.log_order_status_change()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_status_history (order_id, previous_status, new_status)
    values (new.id, old.status, new.status);
  end if;
  return new;
end;
$$;

create trigger orders_status_change_trigger
  after update on public.orders
  for each row execute function public.log_order_status_change();

-- 3. Comments
comment on function public.log_order_status_change() is
  'Audit trail for order status changes.';
```

## Forbidden in migrations

- Hardcoded app data → use seed files / `ON CONFLICT DO NOTHING`.
- Environment-specific config → use env vars.
- `select *` inside DO-blocks / functions — pin columns so column changes don't silently break the migration.

## Migration order matters

Migrations run in their defined order (e.g. filename timestamp order). Dependencies first: create the table before the trigger that references it. If a migration in the series fails, the local reset stops — all later migrations are blocked.

## Local workflow

Use the platform's commands (from config). Example shape:

```bash
# from the dir that owns the schema/migrations
<migration-new-cmd> <descriptive_name>   # creates an empty migration (e.g. supabase migration new)
# Edit BOTH the declarative schema and the new migration so they match
<local-reset-cmd>                         # wipes local db and replays all migrations (e.g. supabase db reset / prisma migrate reset)
# Then run affected tests:
${commands.test}                          # or a targeted backend/API test command
```

Run the project's backend/API test target (`${commands.test}`, or a narrower API suite if defined) for anything that touches the changed table/trigger/policy.

## Pre-commit checklist

- [ ] Migration filename is descriptive (no `update` / `fix` / `changes`)
- [ ] Declarative schema and migration both exist under `${backend.migrationsDir}` (and its schema dir) and match
- [ ] Every `create` statement is idempotent (use the table above) — or the generated migration is verified re-run-safe
- [ ] Row-security enabled on any user-data table where the platform supports it; privileged-role policy present
- [ ] Indexes added on every column used in row-security policies
- [ ] Foreign keys include explicit `on delete` behavior
- [ ] Comments explain purpose on tables / non-obvious columns / functions
- [ ] Local reset succeeds with no `ERROR` / `FATAL`
- [ ] Affected tests pass (`${commands.test}` / targeted API tests)
- [ ] No hardcoded data, no env-specific config, no bare current-user function in policies
- [ ] User approval obtained before applying the migration to any shared/remote DB

## Common migration patterns (SQL examples)

### Add a column

```sql
alter table public.user_profiles
  add column if not exists parent_user_id uuid;
```

### Add a check constraint

```sql
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_status_check') then
    alter table public.orders
      add constraint orders_status_check
      check (status in ('new', 'confirmed', 'fulfilled'));
  end if;
end $$;
```

### Add an index for a partial condition

```sql
create index if not exists idx_orders_active
  on public.orders(user_id)
  where status = 'active';
```

## Related skills

- `backend-feature-workflow` — the phases that consume the new schema (entity, repo, service, router).
- `serverless-function` — when the migration changes the data-client surface used from serverless/edge functions.
- `principal-architect` — security/data-governance review for sensitive tables.
- `devfix` — the full fix flow that orchestrates schema + repo + test runs + verify.
