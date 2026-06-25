---
name: serverless-function
description: Canonical, config-driven config / import / request-handling patterns for the project's serverless or edge functions. Reads ${edge.platform} from .claude/stack.md and adapts (e.g. supabase-edge-deno, lambda, netlify); no-ops when the platform is none. Covers per-function dependency/import-map setup, runtime-correct import style, request-body handling quirks, explicit env-var validation, optional-integration guards, and a creation+smoke-test checklist. Use when creating a new serverless/edge function, editing its config or import map, debugging import resolution, fixing undefined request input, or when request handling behaves wrong on POST. For DB schema work prefer database-migration; for domain/router/service wiring prefer backend-feature-workflow.
---

# Serverless / Edge Function Config and Request Handling

Canonical, **config-driven** reference for making a serverless or edge function run correctly on its runtime. The reasoning — per-function dependency setup, runtime-correct imports, the body-transfer/transformer quirk, explicit env validation, optional-integration guards — generalizes across platforms; only the concrete runtime and paths come from config.

> **Read `.claude/stack.md` first.** Use its values; never assume a specific tool. Read `${edge.platform}`,
> the functions dir (e.g. `${edge.functionsDir}`), and `${edge.localRestart}`; consult `${recoveryNotes}`
> for known runtime/infra failure modes. If `${edge.platform}` is **`none`**, this skill is a **no-op** —
> tell the user there are no configured serverless/edge functions, so there is nothing to do, and stop.
> If a needed capability is otherwise `none`/empty, skip those steps. If `.claude/stack.md` is missing,
> run the **`onboarding`** skill and stop. Concrete runtimes below (Supabase Edge on Deno, AWS Lambda,
> Netlify Functions) are **examples** — match `${edge.platform}`.

## Per-function dependency / import setup (mandatory)

Some runtimes do **not** inherit dependency or import-map config from parent directories — each function directory must declare its own. (On a Deno-based edge runtime this is a per-function `deno.json` with a complete import map; on Node-based platforms like Lambda/Netlify it's the function's `package.json` / bundler config.) Always set this up per function under the functions dir (`${edge.functionsDir}`).

Example (Deno-based edge runtime — a per-function `deno.json`):

```json
{
  "imports": {
    "@core/":                 "../../../packages/core/src/",
    "@shared":                "../_shared/mod.ts",
    "@supabase/supabase-js":  "npm:@supabase/supabase-js@^2.47.12",
    "@trpc/server":           "npm:@trpc/server@^11.0.0-rc.688",
    "superjson":              "npm:superjson@^2.2.2",
    "zod":                    "npm:zod@^3.23.0"
  },
  "compilerOptions": { "strict": true, "noImplicitAny": true, "lib": ["deno.window", "dom"] }
}
```

### Critical details (Deno-based example)

- **Path-prefix aliases need a trailing slash** for deep imports. Without it, `import ... from '@core/domain/entities/order.ts'` resolves to `.../index.ts/domain/entities/order.ts` and the runtime errors with "not a directory". A barrel alias (`@shared` → `../_shared/mod.ts`) maps directly to a file, not a folder — no trailing slash.
- **Pin dependency versions consistently across every function** (e.g. all functions on the same `@trpc/server` rc). Version skew between functions causes subtle type and runtime mismatches.
- **Runtime libs** must be declared (`lib: ["deno.window", "dom"]` for the edge runtime's web APIs).

On Node-based platforms the analogues are: pin dependency versions in each function's `package.json`, ensure the bundler includes the runtime's globals, and avoid relying on a parent `node_modules` resolution the deploy bundler won't replicate.

### Directory layout (example)

```
${edge.functionsDir}/
├── _shared/
│   ├── mod.ts         # barrel: router, procedures, etc.
│   ├── handler.ts     # request handler (see below)
│   ├── context.ts     # services wiring
│   └── types.ts       # Context + Services types
├── api/               # the user-facing function root
│   ├── index.ts
│   └── routers/
└── <other-function>/
    └── index.ts
```

## Imports — match the runtime's module style

Each runtime has its own import rules; follow the configured one. (A Deno-based edge runtime requires **explicit `.ts` extensions** and **deep imports** — Node.js / bundler conventions do not apply. Node-based platforms allow extensionless and barrel imports.)

```typescript
// GOOD — Deno-based edge runtime
import { Order }       from '@core/domain/entities/order.ts';   // deep path + .ts
import { router, publicProcedure } from '@shared';              // barrel alias
import { z }           from 'zod';                              // bare specifier; npm: prefix lives in the import map
import { TRPCError }   from '@trpc/server';

// BAD — on a Deno-based edge runtime
import { Order, OrderStatus } from '@core';                     // barrel not configured for deep imports
import { Order }              from '@core/domain/entities/order'; // missing .ts
import { z }                  from 'npm:zod';                   // npm: prefix belongs in the import map, not source
import { router }             from '../_shared/mod.ts';         // use the barrel alias '@shared'
```

Keep the runtime's extension rule consistent for relative local imports too (e.g. `import { handler } from './handler.ts'` on Deno). If a shared package is processed by a bundler rather than the runtime directly, follow that package's own convention for cross-runtime consistency.

## Request body — the transformer/transfer quirk

A common failure: a POST arrives at the function's request handler with `undefined` input, causing schema-validation failures. Two fused root causes show up across runtimes:

1. Some runtimes' `Request.body` stream **cannot be transferred** into a new `Request()` constructor — you must read it to text first.
2. An RPC layer with a serialization transformer (e.g. tRPC + `superjson`) expects the body wrapped in a specific shape (e.g. `{ json: <payload> }`) — the shape the test client already sends.

Centralize the fix in a shared handler (e.g. `_shared/handler.ts`) that every function entry point goes through:

```typescript
// CORRECT: clone → read text → parse → wrap → new Request
const bodyClone   = req.clone();
const bodyText    = await bodyClone.text();
const parsedBody  = JSON.parse(bodyText);
const wrappedBody = JSON.stringify({ json: parsedBody });   // shape the transformer expects

const downstreamReq = new Request(targetUrl.toString(), {
  method:  req.method,
  headers: headers,
  body:    wrappedBody,
});

// WRONG — body stream cannot be transferred
new Request(targetUrl, { method: req.method, headers, body: req.body });
// WRONG — transformer expects the wrapped shape, not raw text
new Request(targetUrl, { method: req.method, headers, body: bodyText });
```

If frontend and e2e both break: the frontend sends raw JSON and relies on the handler to wrap it; the test client wraps it itself — both should work once the handler fix is in place. (The exact wrap shape is RPC-library-specific; only apply it when your stack uses such a transformer.)

## Environment vars — explicit validation

No non-null assertions on env (`process.env.X!`). Read env the runtime's way (`Deno.env.get(...)` on Deno, `process.env.X` on Node) with explicit checks and a generic error:

```typescript
const secret = readEnv('JWT_SECRET');               // Deno.env.get / process.env
if (secret === undefined || secret === '') {
  ctx.services.logger.error('JWT_SECRET not configured');
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Server configuration error' });
}
```

Optional integrations (CRM, email, payment webhooks) live in context getters that return `undefined` when their env is missing or a disable flag is set (e.g. `DISABLE_EXTERNAL_SERVICES=true`). Never throw from the getter — guard at call sites instead (see `backend-feature-workflow`).

## Creating a new function — checklist

1. Create the function directory under `${edge.functionsDir}`.
2. Copy the dependency/import config from an existing function with a close dependency shape; remove packages you don't need.
3. Add the entry point that wires the shared handler → your router/logic.
4. Add routers/handlers (follow `backend-feature-workflow` for router conventions).
5. Add any new service types to the shared types and wire the service in the shared context with a lazy getter.
6. Boot the local runtime and smoke-test, then restart it cleanly if needed via `${edge.localRestart}`:
   ```bash
   <serve-functions-cmd>                  # start local functions (e.g. supabase functions serve / netlify dev / sam local)
   curl <local-functions-url>/health/check
   ```
7. Verify no module-resolution errors ("failed to resolve" / "not a directory" / "not in import map" on Deno; bundler "cannot find module" on Node).

## Common runtime errors and fixes (Deno-based edge example)

| Error | Cause | Fix |
|---|---|---|
| `Relative import path "<pkg>" not prefixed with / or ./ or ../ and not in import map` | Missing entry in the import map | Add the package to the import map (e.g. `"jose": "npm:jose@^5.9.0"`) |
| `failed to read file: open .../index.ts/...: not a directory` | Path-prefix alias without trailing slash | Add the trailing slash (e.g. `"@core/": "../../../packages/core/src/"`) |
| `Module not found "file:///.../entities/order"` | Missing `.ts` extension in source | Add `.ts` |
| RPC procedure receives `undefined` input on POST | Body not wrapped for the transformer, or stream transferred directly | Use the clone/parse/wrap pattern in the shared handler |
| `Could not find the table '...' in the schema cache` | Migrations not applied to the local DB | Reset the local DB — then see `database-migration` |
| Type/behavior mismatch between two functions | Dependency version skew in import maps | Pin identical versions across every function |

## Troubleshooting checklist

### Request body
- [ ] Shared handler clones `req` before reading the body
- [ ] Body parsed as JSON, then wrapped in the transformer's expected shape before `new Request(...)`
- [ ] `Content-Type: application/json` header preserved on the forwarded request

### Imports
- [ ] The function's own dependency/import config exists in its directory
- [ ] Path-prefix aliases have a trailing slash; barrel aliases do not
- [ ] Every required dependency mapped with a pinned version
- [ ] Source imports follow the runtime's extension/depth rules
- [ ] No package-manager prefix (e.g. `npm:`) in source code on runtimes that put it in the import map

### Environment
- [ ] Required secrets validated explicitly
- [ ] Optional services return `undefined` from their getter when unconfigured
- [ ] No non-null assertions on env reads

### DB state
- [ ] Declarative schema and migration both present and matching (`database-migration` skill)
- [ ] Local DB reset applied — tables exist

## Related skills

- `backend-feature-workflow` — router / service / repo patterns inside the function.
- `database-migration` — the companion DB work; most "table not found" errors are really missing migrations.
- `devfix` — full fix loop; delegates here for runtime/serverless-specific failures.
- `test-endpoint` — smoke-test the running function end-to-end.
