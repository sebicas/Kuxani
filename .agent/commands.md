# Commands Reference

All available CLI commands and scripts for the Kuxani project.

> **Rule:** Every time a new command or script is created, it MUST be added here.

## Development

| Command         | Description                          |
| --------------- | ------------------------------------ |
| `npm run dev`   | Start Next.js dev server (Turbopack) |
| `npm run build` | Production build                     |
| `npm run start` | Start production server              |
| `npm run lint`  | Run ESLint                           |

## Database (Drizzle)

| Command               | Description                             |
| --------------------- | --------------------------------------- |
| `npm run db:generate` | Generate Drizzle migrations from schema |
| `npm run db:migrate`  | Run Drizzle migrations                  |
| `npm run db:push`     | Push schema directly to database (dev)  |
| `npm run db:studio`   | Open Drizzle Studio (DB browser)        |

## Testing

| Command              | Description                                                     |
| -------------------- | --------------------------------------------------------------- |
| `npm test`           | Run **all** tests (unit + integration + E2E)                    |
| `npm run test:unit`  | Run unit/integration tests only (Vitest, no server needed)      |
| `npm run test:watch` | Run unit tests in watch mode (Vitest)                           |
| `npm run test:e2e`   | Run E2E browser tests only (Playwright, auto-starts dev server) |

## Infrastructure

| Command                | Description                 |
| ---------------------- | --------------------------- |
| `docker compose up -d` | Start PostgreSQL 17 + MinIO |
| `docker compose down`  | Stop infrastructure         |

## Better Auth CLI

| Command                         | Description                                     |
| ------------------------------- | ----------------------------------------------- |
| `npx @better-auth/cli generate` | Generate Drizzle schema from Better Auth config |
