# Repository Guidelines

## Project Structure & Module Organization

This workspace contains two cooperating Node.js applications:

- `dashboard/`: Next.js 16, React 19, TypeScript, Tailwind CSS 4, PostgreSQL, and Drizzle ORM. Routes live in `src/app`; shared UI in `src/components`; helpers in `src/lib`; database code in `src/db`; assets in `public/`; administrative scripts in `scripts/`.
- `printdash-agent/`: the office-side Express/SNMP collector. Core polling is in `server.js`; central API uploads are handled by `seaoil-agent.js`; runtime configuration uses `.env` and JSON data files. Deployment examples are in `Dockerfile` and `compose.example.yaml`.

Keep the dashboard as the source of truth. Do not duplicate printer assets or merge the original PrintDash UI into Next.js.

## Build, Test, and Development Commands

```bash
cd dashboard
npm run dev         # Start Next.js locally
npm run typecheck   # Run TypeScript without emitting files
npm run lint        # Run ESLint
npm run build       # Create the production build
npm run db:setup:docker  # Start, synchronize, and seed local PostgreSQL

cd ../printdash-agent
npm start           # Start SNMP polling and the local agent UI
node --check server.js
node --check seaoil-agent.js
```

## Coding Style & Naming Conventions

Use two-space indentation and existing TypeScript/React patterns. Name components with PascalCase (`ModalShell.tsx`), variables with camelCase, and route directories with lowercase kebab-case. Prefer server components unless browser state requires `"use client"`. Reuse existing UI and Tailwind tokens; avoid unrelated refactors. Treat ESLint as the style authority.

## Testing Guidelines

No repository-owned automated test suite is configured. Dashboard changes must pass type-check, lint, and production build. Exercise changed routes against PostgreSQL. Agent changes require syntax checks plus startup, SNMP polling, upload-failure, and central-ingest verification. Colocate future tests as `*.test.ts` or `*.test.tsx`.

## Commit & Pull Request Guidelines

No Git history is available in this workspace to infer an established convention. Use concise imperative commits such as `Fix repair ticket status count`. Pull requests should describe scope, database or environment changes, verification commands, and manual setup. Include screenshots for visible UI changes and note any migration command explicitly.

## Security & Configuration

Never commit `.env` files, bearer tokens, SNMP communities, passwords, or runtime JSON containing credentials. Store agent tokens only as hashes centrally. Do not reset databases, delete monitoring history, or expose SNMP publicly. Apply schema changes through the existing Drizzle workflow and preserve existing records.
