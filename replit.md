# IncidAI

An incident-management app for reporting, classifying, investigating, and tracking IT service incidents.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the Express API server (port 8080)
- `pnpm --filter @workspace/incidai run dev` — run the React web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `INCI_API_BASE_URL=https://<dev-domain>/api pnpm --filter @workspace/api-server run test:smoke` — test the API lifecycle
- `INCI_API_BASE_URL=https://<dev-domain>/api pnpm --filter @workspace/api-server run seed:demo` — add three labeled sample incidents to the development database
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- API contract: `lib/api-spec/openapi.yaml`
- PostgreSQL tables: `lib/db/src/schema/`
- Express API: `artifacts/api-server/src/routes/`
- React app: `artifacts/incidai/src/`
- Preserved upstream repository source and processed ticket data: `artifacts/incidai/source/`

## Architecture decisions

- The original public IncidAI source is retained under `artifacts/incidai/source/`; installed dependency folders and redundant raw/train/test CSV copies are excluded.
- The original serialized classifier, vectorizer, embeddings, FAISS index, and fine-tuned weights were absent. The app uses TF-IDF retrieval across the included 29,347 processed historical tickets and labels it as retrieval, not as the missing trained model.
- Historical ticket text is not returned to the browser. Similarity examples identify the category and explain that source resolutions are withheld; recommendations are review-only.
- Incidents are stored in PostgreSQL. An operator must explicitly verify a resolution before the incident can be marked resolved or closed.

## Product

The dashboard summarizes current incidents. Operators can report, search, filter, classify, investigate, update, escalate, resolve, and close tickets while retaining a per-incident activity timeline.

## Operational notes

- The API build copies the historical CSV into its distribution folder so the classifier remains available in production.
- The three sample records in development are explicitly labeled `[Sample]`; `seed:demo` is optional and idempotent.
- Keep OpenAPI as the contract source of truth; rerun codegen after changing the spec.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
