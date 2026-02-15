---
description: QA Part 3 — Browser console check, update docs, final verification
---

# QA Part 3: Browser Check & Documentation

Run this after infrastructure checks pass to verify the browser experience and update documentation.

## Steps

// turbo-all

### 1. Browser Console Error Scan

Use the browser subagent tool to:

1. Start the dev server if not running: `npm run dev`
2. Navigate to the new feature's primary page
3. Open the browser console and check for:
   - **`console.error`** — Any runtime errors (API failures, missing props, hydration mismatches)
   - **`console.warn`** — React warnings (key props, deprecated APIs, uncontrolled-to-controlled)
   - **Network 4xx/5xx** — Failed API calls or missing assets
4. Walk through the main user flow and check the console at each step
5. Fix any errors found and re-verify

### 2. Update Documentation

Update the following documentation files to reflect the new feature:

#### 2a. `CLAUDE.md`

- **Project Structure** — Add any new files/directories
- **Database Schema** — Update tables overview if schema changed
- **AI Architecture** — Update models/prompts section if AI changes were made
- **Available Scripts** — Add any new npm scripts
- **Key Concepts** — Add a section if the feature introduces a new core concept

#### 2b. `.agent/project-status.md`

- Mark the feature as `✅ Done` in all relevant checklists
- Update the "Last updated" date
- Move items from `⬜ Pending` to `✅ Completed`
- Update the Feature Details table status column

#### 2c. `.agent/commands.md`

- Add any new CLI commands or npm scripts introduced by the feature

#### 2d. `.agent/README.md`

- Update if the feature changes high-level project scope or capabilities

### 3. Final Verification

Run the full suite one last time after documentation updates to ensure nothing was accidentally broken:

```bash
npm test
```

Confirm: all tests still pass.

### 4. Report

Notify the user with:

- **Edge cases added** — Summary of new test scenarios (unit + E2E)
- **Test results** — Total pass count, any notable fixes made
- **Lint status** — Clean
- **Security audit** — Any vulnerabilities found and resolution
- **Dead code** — Unused exports/files cleaned up
- **Docker build** — Passed or issues found
- **Console errors** — Clean or issues fixed
- **Docs updated** — List of files modified
