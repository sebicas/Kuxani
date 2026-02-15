---
description: Post-feature QA — extend tests, fix all errors, lint, and update docs
---

# Post-Feature QA Workflow

Run this workflow **after implementing a feature** to harden test coverage, ensure code quality, and keep documentation current.

> **Prerequisite:** The feature code is already written and the pre-handoff `/verify` workflow has passed at least once.

## Run in 3 Parts

This workflow is split into 3 smaller chunks to avoid timeout issues. Run them **in order**:

### Part 1: Tests, Lint & Build (`/qa-tests`)

Extends unit/integration/E2E tests with edge cases, runs the full test suite, performs lint checks, and verifies the TypeScript build.

### Part 2: Infrastructure Checks (`/qa-infra`)

Runs a security audit, generates DB migrations, detects unused code, syncs env vars, and verifies the Docker production build.

### Part 3: Browser Check & Docs (`/qa-docs`)

Scans for browser console errors, updates all project documentation (CLAUDE.md, project-status.md, commands.md, README.md), and runs a final verification pass.
