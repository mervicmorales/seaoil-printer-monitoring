# Repository Guidelines

## Project Structure & Module Organization

This repository contains two cooperating Node.js applications:

- `dashboard/` is the central Next.js 16 application. Routes and API handlers live in `src/app`, reusable UI in `src/components`, shared logic in `src/lib`, database code in `src/db`, and maintenance scripts in `scripts`.
- `printdash-agent/` is the office-side Express and SNMP collector. Polling runs from `server.js`; `seaoil-agent.js` uploads readings to the dashboard. Deployment examples are in `Dockerfile` and `compose.example.yaml`.

Keep the dashboard as the source of truth for printers, monitoring history, and assignments.

## Build, Test, and Development Commands

Run commands from the relevant application directory:

```bash
cd dashboard
npm run dev              # Start the Next.js development server
npm run typecheck        # Check TypeScript without emitting files
npm run lint             # Run ESLint
npm run build            # Create a production build
npm run db:setup:docker  # Start, synchronize, and seed local PostgreSQL

cd ../printdash-agent
npm start                # Start polling and the local agent UI
npm run test:print-options
node --check server.js && node --check seaoil-agent.js
```

## Coding Style & Naming Conventions

Use two-space indentation and follow existing TypeScript, React, and CommonJS patterns. Name React components with PascalCase (`ModalShell.tsx`), functions and variables with camelCase, and route directories with lowercase kebab-case. Prefer server components unless browser state requires `"use client"`. Reuse existing components and Tailwind tokens; treat ESLint as the formatting authority and avoid unrelated refactors.

## Testing Guidelines

Name dashboard tests `*.test.ts` or `*.test.tsx`; agent tests use `*.test.js`. Dashboard changes must pass type-check, lint, and build, with changed database routes exercised against PostgreSQL. Agent changes require the relevant Node tests, syntax checks, and manual verification of startup, SNMP failures, and upload failures. Test observable behavior and do not claim checks that were not run.

## Commit & Pull Request Guidelines

History is sparse and has no consistent convention. Use concise imperative commits, such as `Fix printer status count`. Pull requests should explain scope, database or environment changes, setup steps, and verification results. Link relevant issues, include screenshots for visible UI changes, and state migration commands explicitly.

## Security & Configuration

Never commit `.env` files, credentials, bearer tokens, SNMP communities, or runtime JSON containing secrets. Use placeholder-only example files. Preserve monitoring history, apply schema changes through Drizzle, and never expose SNMP or printer-management services publicly.
