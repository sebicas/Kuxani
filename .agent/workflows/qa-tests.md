---
description: QA Part 1 — Extend and run all tests (unit, integration, E2E)
---

# QA Part 1: Tests

Run this after implementing a feature to harden test coverage and ensure all tests pass.

## Steps

// turbo-all

### 1. Extend Unit / Integration Tests with Edge Cases

Review the existing Vitest tests for the feature and add edge-case coverage:

- **Empty / null inputs** — What happens with missing required fields?
- **Boundary values** — Max-length strings, zero-length arrays, negative numbers, future/past dates
- **Duplicate operations** — Creating the same resource twice, double submissions
- **Unauthorized access** — Wrong user, missing session, expired token
- **Invalid state transitions** — e.g., resolving an already-resolved challenge
- **Concurrent modifications** — Two users updating the same resource
- **Malformed payloads** — Wrong types, extra fields, SQL/XSS injection strings

```bash
npx vitest run
```

Confirm: all unit/integration tests pass. If any fail, fix the code or tests and re-run until **zero failures**.

### 2. Extend E2E Tests with Edge Cases

Review the existing Playwright tests for the feature and add edge-case scenarios:

- **Empty states** — Page renders correctly with no data
- **Error states** — API failures show user-friendly messages, not raw errors
- **Navigation edge cases** — Direct URL access, back/forward, refresh mid-flow
- **Form validation** — Submit with empty fields, invalid inputs, verify error messages displayed
- **Loading states** — Skeleton/spinner appears during async operations
- **Responsive breakpoints** — Mobile and tablet viewports render correctly

```bash
npx playwright test
```

Confirm: all E2E tests pass. If any fail, fix the code or tests and re-run until **zero failures**.

### 3. Run Full Test Suite Until Green

Run the complete test suite to confirm nothing is broken:

```bash
npm test
```

Confirm: **all tests pass** (unit + integration + E2E). If any test fails:

1. Diagnose the root cause
2. Fix the issue (prefer fixing code over weakening tests)
3. Re-run `npm test`
4. Repeat until the full suite is green

### 4. Lint Check and Fix

```bash
npm run lint
```

If lint errors are found:

1. Fix all auto-fixable issues:
   ```bash
   npx next lint --fix
   ```
2. Manually fix remaining lint errors
3. Re-run `npm run lint` and confirm **zero errors**

### 5. TypeScript Build Check

```bash
npm run build
```

Confirm: `✓ Compiled successfully` with zero errors. Fix any type errors found.
