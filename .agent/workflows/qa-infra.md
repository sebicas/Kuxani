---
description: QA Part 2 — Security audit, DB migrations, unused code, env vars, Docker build
---

# QA Part 2: Infrastructure Checks

Run this after tests pass to verify infrastructure, security, and production readiness.

## Steps

// turbo-all

### 1. Security Audit

```bash
npm audit
```

Review the output:

- **Critical / High** vulnerabilities — Must fix before shipping. Run `npm audit fix` or update the affected package.
- **Moderate / Low** — Document them in the report if they can't be fixed without breaking changes.
- Re-run `npm audit` and confirm no critical/high issues remain.

### 2. Database Migration Generation

If any schema files were modified, generate migrations to ensure they're in sync:

```bash
npm run db:generate
```

Confirm: migrations are generated successfully (or "No schema changes detected"). Review the generated SQL in `drizzle/migrations/` for correctness.

Then verify they apply cleanly:

```bash
npm run db:push
```

Confirm: either changes applied or "No changes detected".

### 3. Unused Code & Dead Exports Detection

Run `knip` to identify unused files, exports, dependencies, and types:

```bash
npx knip
```

Review the output and clean up:

- **Unused exports** — Remove or mark as `@public` if intentionally exposed
- **Unused dependencies** — Remove from `package.json`
- **Unused files** — Delete if truly dead code
- **Unlisted dependencies** — Add to `package.json` if actually used

> **Note:** Some false positives are expected (e.g., Next.js page exports, Drizzle schema exports). Use judgement.

### 4. Environment Variable Sync

Ensure `.env.example` is up-to-date with any new environment variables used by the feature:

1. Grep for `process.env.` across the codebase:
   ```bash
   grep -rh 'process\.env\.' src/ --include='*.ts' --include='*.tsx' | sed 's/.*process\.env\.\([A-Z_]*\).*/\1/' | sort -u
   ```
2. Compare with the variables listed in `.env.example`
3. Add any missing variables to `.env.example` with descriptive comments
4. Verify no secrets or actual values are committed — only placeholder/example values

### 5. Docker Production Build

Verify the production Docker image builds successfully:

```bash
docker build -t kuxani-qa-check .
```

Confirm: the image builds with no errors. This catches:

- Missing dependencies not in `package.json`
- Build-time env var issues
- Multi-stage build failures
- Files referenced but not copied into the image

Clean up after:

```bash
docker rmi kuxani-qa-check
```
