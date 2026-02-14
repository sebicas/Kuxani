---
description: Pre-handoff verification checklist — MUST run before asking user to test
---

# Pre-Handoff Verification Workflow

Run this workflow **every time** before telling the user to test a feature.

## Steps

// turbo-all

1. **Check library docs** — If you integrated a third-party library in this session, verify your usage against official docs:

   ```
   Use the Context7 MCP tool to query docs for the library in question.
   ```

2. **Use CLI generators when available** — If the library offers a schema/config generator, run it:
   - Better Auth: `npx @better-auth/cli generate --output ./src/lib/db/schema/auth-generated.ts --yes`
   - Drizzle: `npx drizzle-kit generate`

3. **TypeScript build check**:

   ```bash
   npm run build
   ```

   Confirm: `✓ Compiled successfully` and zero errors.

4. **Lint check**:

   ```bash
   npm run lint
   ```

   Confirm: no errors.

5. **Schema sync** (if any schema files were modified):

   ```bash
   npm run db:push
   ```

   Confirm: either changes applied successfully or "No changes detected".

6. **Run integration tests**:

   ```bash
   npm test
   ```

   Confirm: all tests pass.

7. **Browser smoke test** — Use the browser subagent tool to:
   - Start the dev server if not running: `npm run dev`
   - Navigate to the feature you just built
   - Verify no errors in the page (check for error messages, 500s, etc.)
   - Test the primary user flow (e.g., sign up → lands on dashboard)

8. **Report to user** — Only after ALL above steps pass, notify the user with:
   - What was built
   - What was verified (build, tests, browser smoke test)
   - Any known limitations or next steps
