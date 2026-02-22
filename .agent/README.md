# Kuxani — AI Agent Directory

This directory contains documentation and tooling for AI coding assistants working on the Kuxani project.

## Contents

| Path                                   | Purpose                                                  |
| -------------------------------------- | -------------------------------------------------------- |
| `project-status.md`                    | Feature tracker: implemented vs pending                  |
| `commands.md`                          | All CLI commands and npm scripts reference               |
| `coolify-deploy.md`                    | Coolify deployment guide and production config           |
| `IMPLEMENTATION_PLAN_TEST_COVERAGE.md` | Test coverage implementation plan                        |
| `TEST_COVERAGE_ANALYSIS.md`            | Current test coverage analysis                           |
| `workflows/`                           | Workflow definitions (push, merge, cleanup, PR, QA, etc) |

## Workflows

| Workflow                       | Description                                          |
| ------------------------------ | ---------------------------------------------------- |
| `workflows/push.md`            | Intelligent commit grouping and push                 |
| `workflows/merge.md`           | Merge current branch into target, optionally push    |
| `workflows/cleanup.md`         | Post-merge cleanup — delete merged local branches    |
| `workflows/pr-create.md`       | Commit, push, and create a GitHub Pull Request       |
| `workflows/verify.md`          | Pre-handoff verification checklist                   |
| `workflows/post-feature-qa.md` | Post-feature QA — extend tests, fix errors, lint     |
| `workflows/qa-tests.md`        | QA Part 1 — Extend and run all tests                 |
| `workflows/qa-infra.md`        | QA Part 2 — Security, DB, unused code, Docker build  |
| `workflows/qa-docs.md`         | QA Part 3 — Browser check, update docs, final verify |
| `workflows/quiz-standards.md`  | Standards for creating new couple quizzes            |

## Project Overview

**Kuxani** is a collaborative AI-mediated couples therapy platform. See `CLAUDE.md` at the project root for full documentation.

### Quick Reference

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Database**: PostgreSQL 17 + Drizzle ORM
- **Auth**: Better Auth
- **AI**: OpenAI (gpt-4.1 family)
- **Real-time**: Socket.IO
- **Styling**: Vanilla CSS with custom design system
- **Infrastructure**: Docker Compose (PostgreSQL + MinIO)
- **CI/CD**: GitHub Actions (lint, test, build, E2E)
- **Deployment**: Coolify (`kuxani.com` prod · `dev.kuxani.com` dev)
