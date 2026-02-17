# Test Coverage Analysis — Kuxani

_Generated: 2026-02-17_

## Current State

The codebase has **~21 test files** with solid coverage in two areas:

1. **Database CRUD (integration tests)** — All major tables tested: challenges, auth, disagreements, childhood wounds, de-escalation, commitments, gratitude, love languages, mood, personal chats. These verify inserts, updates, deletes, cascades, edge cases, and unicode handling.

2. **Pure logic (unit tests)** — AI context formatting helpers, `buildSystemPrompt()`, quiz data integrity, health endpoint, Socket.IO singleton/events, and middleware route protection.

3. **E2E** — Auth flows (login/signup) and partial Phase 2 features (personal chat UI, mood tracker UI).

---

## Gap Analysis

Testing is heavily concentrated at the **data layer** and almost entirely absent at the **API and UI layers**.

### 1. API Route Handlers — Critical

**40+ API routes exist, only `/api/health` has a handler test.**

Untested behavior:
- Auth guards (`requireSession()`) never verified at route level
- Request validation — malformed bodies, missing fields, wrong types
- HTTP status codes — 401/403/404/400 responses
- Response shape — JSON structure returned to frontend

**Priority routes:**
- `POST/GET /api/challenges` — core feature entry point
- `PUT /api/challenges/[id]/perspectives` — "can't see partner's perspective until both submit"
- `POST /api/challenges/[id]/accept` — both-partner acceptance logic
- `GET/POST /api/mood` — complex filtering (own + partner's shared entries)
- `POST /api/couples` and `POST /api/couples/join` — couple creation + invite flow
- `POST /api/disagreements` and message routes — status transitions + visibility

### 2. Authorization & Access Control — Critical

No tests verify cross-user/cross-couple data isolation at the API level:
- User A cannot read User B's mood entries, personal chats, or childhood wounds
- Users outside a couple cannot access that couple's challenges
- Disagreement visibility rules (`creator_only`/`partner_only`/`all`) enforced in responses
- Perspectives hidden until both submitted — enforced in API response, not just DB

### 3. AI Streaming & Integration — High

Synthesis, discussion, and disagreement message routes are the most complex code paths. None tested:
- SSE response format (`data:` framing, `[DONE]` terminator)
- Context assembly — correct sections loaded per scenario
- OpenAI error handling (rate limits, timeouts, 500s)
- DB save after stream completion
- Status-based prompt selection in disagreement messages

### 4. State Machine Transitions — High

Challenges (8 statuses) and disagreements (8 statuses) lack transition validation tests:
- Invalid transitions (e.g., `created` → `resolved` directly)
- Guard conditions (synthesis requires both perspectives submitted)
- Concurrent updates (both partners accept/reject simultaneously)

### 5. Couples Management — High

**Zero tests at any layer** for the foundational couple flow:
- Couple creation + invite code generation
- Invite code uniqueness
- Join with valid/invalid/expired code
- Can't join a couple already in, can't join a full couple

### 6. React Hooks (Client-Side Real-Time) — Medium

Six Socket.IO hooks untested:
- `useChallengeSocket`, `useDisagreementSocket`, `usePartnerSocket`
- `useCoupleSocket`, `useCommitmentsSocket`, `useVoiceSession`

Bugs here cause duplicate updates, stale UI, or memory leaks.

### 7. E2E Test Coverage — Medium

Only 2/15 user-facing features have E2E tests. Missing:
- Challenge lifecycle (create → perspectives → synthesis → accept → discuss → resolve)
- Couple invite/join flow
- Disagreement lifecycle
- Quiz flows (love languages, attachment styles)
- Gratitude journaling + sharing
- De-escalation sessions
- Settings/profile editing

### 8. Error Handling & Edge Cases — Medium

No tests cover failure modes:
- Database unavailability
- OpenAI API rate limits or errors
- Malformed request bodies / SQL injection attempts
- Extremely large payloads
- Concurrent requests to same resource

---

## Recommended Implementation Order

| Priority | Area | Test Type | Est. Files |
|----------|------|-----------|------------|
| 1 | API route auth guards (all routes) | Unit (mocked session) | 1 shared + per-route |
| 2 | Couples CRUD + invite/join | Integration | 1 |
| 3 | Challenge API routes (create, perspectives, accept) | Integration | 1-2 |
| 4 | Disagreement API routes (create, messages, visibility) | Integration | 1-2 |
| 5 | AI streaming routes (synthesis, discussion) | Unit (mocked OpenAI) | 1-2 |
| 6 | State machine transition validation | Unit | 1 |
| 7 | Mood/Gratitude/Wellness API routes | Integration | 2-3 |
| 8 | React Socket.IO hooks | Unit (RTL) | 1-2 |
| 9 | E2E challenge lifecycle | E2E (Playwright) | 1 |
| 10 | E2E couple invite/join | E2E (Playwright) | 1 |

---

## Summary

Existing tests validate that **data goes in and out of the database correctly** and **pure formatting logic works**. The critical blind spot is the **API layer** — HTTP handlers where auth checks, validation, business logic orchestration, and error handling live. Prioritizing API route tests (especially auth guards and access control) delivers the highest return on testing investment.
