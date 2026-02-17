# Kuxani — Project Documentation

> _"Harmonize your perspectives, heal together."_

A collaborative AI-mediated platform where couples work together to understand each other's perspectives, resolve conflicts constructively, and build a stronger relationship.

---

## ⚠️ MANDATORY: Pre-Handoff Verification Checklist

**You MUST complete ALL of these steps before asking the user to test anything. No exceptions.**

1. **Library Docs First** — Before implementing ANY third-party integration (Better Auth, Drizzle, etc.), query the official docs via Context7. Never hand-write config/schema from memory.
2. **Use CLI Generators** — If a library provides a schema/config generator CLI (e.g., `@better-auth/cli generate`), use it instead of writing manually.
3. **Build Check** — Run `npm run build` and confirm zero errors.
4. **Integration Test** — Run `npm test` and confirm all tests pass. If writing new features that touch APIs/auth/DB, add integration tests first.
5. **Browser Smoke Test** — Use the browser tool to navigate to the feature and verify it works at runtime (catches serialization, DB, and API errors that TypeScript misses).
6. **Schema Sync** — After any schema changes, run `npm run db:push` and verify it succeeds before asking user to test.
7. **Update Commands** — When creating any new CLI command or npm script, add it to `.agent/commands.md`.

> **Workflow**: Follow `.agent/workflows/verify.md` for the full checklist.

---

## ⚠️ MANDATORY: Implementation Plan Rules

**Every time you create an Implementation Plan, you MUST:**

1. **Wait for user approval** before writing any code. Do NOT start coding until the user explicitly approves the plan.
2. **Last task item = `/verify`** — The final item in the task checklist must always be running the `.agent/workflows/verify.md` workflow.

> **No exceptions.** Plans without user approval and a closing `/verify` step are incomplete.

---

## Tech Stack

| Layer            | Technology                         | Purpose                                      |
| ---------------- | ---------------------------------- | -------------------------------------------- |
| **Framework**    | Next.js 16 (App Router)            | Full-stack React with SSR, TypeScript        |
| **Styling**      | Vanilla CSS (custom design system) | Full control, premium feel, dark/light       |
| **Auth**         | Better Auth                        | Self-hosted, TypeScript-native auth          |
| **Database**     | PostgreSQL 17 + Drizzle ORM        | Type-safe queries, auto migrations           |
| **File Storage** | MinIO (S3-compatible)              | Self-hosted object storage                   |
| **Real-time**    | Socket.IO                          | Live partner updates across all features     |
| **Collab Edit**  | Yjs + Hocuspocus                   | CRDT-based collaborative editing             |
| **Rich Text**    | Tiptap (ProseMirror + Yjs)         | Collaborative editor                         |
| **AI**           | OpenAI (gpt-4.1 family)            | Text reasoning, transcription, TTS           |
| **Deployment**   | Coolify                            | `kuxani.com` (prod) · `dev.kuxani.com` (dev) |
| **CI/CD**        | GitHub Actions                     | Lint, test, build, E2E on every PR + push    |

---

## Project Structure

```
kuxani/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (metadata, global styles)
│   │   ├── page.tsx                  # Landing page (hero, features, how-it-works)
│   │   ├── globals.css               # Design system (tokens, components, animations)
│   │   ├── page.module.css           # Landing page styles
│   │   ├── (auth)/
│   │   │   ├── auth.module.css       # Shared auth page styles
│   │   │   ├── login/page.tsx        # Login page (email/password)
│   │   │   └── signup/page.tsx       # Signup page (name/email/password)
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx            # Authenticated layout (sidebar + header)
│   │   │   ├── dashboard.module.css  # Dashboard styles
│   │   │   └── dashboard/page.tsx    # Dashboard home
│   │   └── api/
│   │       └── auth/[...all]/route.ts # Better Auth API catch-all
│   ├── middleware.ts                   # Route protection (redirects unauthenticated → /, authenticated on login/signup → /dashboard)
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── client.ts             # OpenAI client + model constants
│   │   │   └── prompts.ts            # Therapeutic prompts (Gottman/EFT/Attachment)
│   │   ├── auth/
│   │   │   ├── index.ts              # Better Auth server config (Drizzle adapter)
│   │   │   ├── session.ts            # Server-side session helpers
│   │   │   └── client.ts             # React hooks (useSession, signIn, signUp, signOut)
│   │   ├── socket/
│   │   │   ├── socketServer.ts       # Socket.IO server singleton (setIO/getIO)
│   │   │   ├── socketClient.ts       # Socket.IO client singleton (getSocket)
│   │   │   └── events.ts             # Shared event constants (PARTNER_JOINED, CHALLENGE_UPDATED)
│   │   ├── hooks/
│   │   │   ├── useCoupleSocket.ts     # Generic couple room hook (mood, gratitude, etc.)
│   │   │   ├── useChallengeSocket.ts  # Challenge real-time updates
│   │   │   ├── useDisagreementSocket.ts # Disagreement session updates
│   │   │   ├── usePartnerSocket.ts    # Partner join notifications
│   │   │   └── useCommitmentsSocket.ts # Commitment request/compromise updates
│   │   └── db/
│   │       ├── index.ts              # Drizzle client initialization
│   │       └── schema/
│   │           ├── index.ts          # Schema barrel export
│   │           ├── auth.ts           # user, session, account, verification (Better Auth CLI-generated)
│   │           ├── couples.ts        # couples, couple_members, couple_profiles
│   │           ├── challenges.ts     # challenges, perspectives, messages, requests,
│   │           │                     # attachments, summaries, voice_sessions, segments
│   │           ├── chats.ts          # personal_chats, personal_messages
│   │           ├── mood.ts           # mood_entries, gratitude_entries,
│   │           │                     # love_language_results, attachment_style_results
│   │           ├── deescalation.ts   # deescalation_sessions
│   │           └── childhood-wounds.ts # childhood_wounds
├── drizzle/
│   └── migrations/                   # Auto-generated SQL migrations
├── public/                           # Static assets
├── .node-version                     # Node.js version (used by CI + version managers)
├── .github/workflows/ci.yml          # CI pipeline (lint, test, build, E2E)
├── Dockerfile                        # Multi-stage production build (Node 24-alpine)
├── docker-compose.yml                # PostgreSQL 17 + MinIO
├── drizzle.config.ts                 # Drizzle Kit config
├── .env.example                      # Environment variables reference
├── package.json
├── next.config.ts
├── tsconfig.json
└── CLAUDE.md                         # This file
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 24 (pinned in `.node-version`)
- **Docker** & Docker Compose (for PostgreSQL + MinIO)

### Setup

```bash
# 1. Clone and install
git clone <repo-url> && cd kuxani
npm install

# 2. Start infrastructure
docker compose up -d

# 3. Configure environment
cp .env.example .env
# Edit .env with your BETTER_AUTH_SECRET and OPENAI_API_KEY

# 4. Run migrations
npm run db:push

# 5. Start dev server
npm run dev
```

### Available Scripts

> Full reference with all commands: `.agent/commands.md`

| Script                     | Description                                  |
| -------------------------- | -------------------------------------------- |
| `npm run dev`              | Start Next.js dev server (Turbopack)         |
| `npm run build`            | Production build                             |
| `npm run start`            | Start production server                      |
| `npm run lint`             | Run ESLint                                   |
| `npm run db:generate`      | Generate Drizzle migrations                  |
| `npm run db:migrate`       | Run Drizzle migrations                       |
| `npm run db:push`          | Push schema directly (dev)                   |
| `npm run db:studio`        | Open Drizzle Studio (DB browser)             |
| `npm test`                 | Run **all** tests (unit + integration + E2E) |
| `npm run test:unit`        | Unit tests only (Vitest)                     |
| `npm run test:integration` | Integration tests only (Vitest)              |
| `npm run test:watch`       | Tests in watch mode                          |
| `npm run test:e2e`         | E2E browser tests only (Playwright)          |

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgres://kuxani:kuxani_secret@localhost:5432/kuxani

# Better Auth
BETTER_AUTH_SECRET=<your-secret>
BETTER_AUTH_URL=http://localhost:3000

# OpenAI
OPENAI_API_KEY=sk-<your-key>

# MinIO / S3 Storage
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=kuxani_minio
MINIO_SECRET_KEY=kuxani_minio_secret
MINIO_BUCKET=kuxani-uploads

# Hocuspocus WebSocket
HOCUSPOCUS_PORT=1234

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:1234
```

---

## Design System

The design system is defined in `src/app/globals.css` with CSS custom properties:

- **Fonts**: Inter (body) + Outfit (display headings)
- **Themes**: Light + Dark (auto via `prefers-color-scheme`)
- **Partner Colors**: Partner A = indigo (#6366f1), Partner B = pink (#ec4899)
- **Components**: `.btn`, `.card`, `.input`, `.badge`, typography, animations
- **Animations**: `fade-in`, `slide-up`, `pulse-glow`, `spin`

---

## Database Schema

### Tables Overview

| Schema File            | Tables                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `auth.ts`              | `user`, `session`, `account`, `verification` (Better Auth CLI-generated, includes `profile_data` JSONB)                         |
| `couples.ts`           | `couples`, `couple_members`, `couple_profiles`                                                                                  |
| `challenges.ts`        | `challenges`, `perspectives`, `messages`, `requests`, `attachments`, `summaries`, `voice_sessions`, `voice_transcript_segments` |
| `chats.ts`             | `personal_chats`, `personal_messages`                                                                                           |
| `mood.ts`              | `mood_entries`, `gratitude_entries`                                                                                             |
| `love-languages.ts`    | `love_language_results`                                                                                                         |
| `attachment-styles.ts` | `attachment_style_results`                                                                                                      |
| `childhood-wounds.ts`  | `childhood_wounds` (id, userId, title, description, source, intensity, suggestedBy, status, timestamps)                         |
| `disagreements.ts`     | `disagreements`, `disagreement_messages`, `disagreement_invitations`                                                            |
| `commitments.ts`       | `requests`, `compromises`, `commitment_check_ins`                                                                               |

---

## AI Architecture

### Client Initialization

The OpenAI client (`src/lib/ai/client.ts`) is **lazy-initialized** via a Proxy pattern. This is critical for Docker builds where `OPENAI_API_KEY` is not available at build time. The `openai` export works identically to a direct `new OpenAI()` instance but defers construction until first use.

**Rule:** All API routes that import from `@/lib/ai/client` **MUST** export `export const dynamic = "force-dynamic"` to prevent Next.js from attempting to pre-render them at build time.

### Models Used

| Model               | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `gpt-4.1`           | Main reasoning (synthesis, therapy chat) |
| `gpt-4.1-mini`      | Summaries, pattern detection             |
| `gpt-4o-transcribe` | Voice-to-text (live sessions)            |
| `gpt-4o-mini-tts`   | Text-to-speech (therapist voice)         |

### Prompt System

The AI uses therapeutic frameworks (Gottman Method, EFT, Attachment Theory) with a **centralized context loader** (`src/lib/ai/context.ts`) that hydrates all memory tiers from the database.

`loadCoupleContext(coupleId)` — Used by couple-facing AI (challenges, synthesis, de-escalation, gratitude):  
`loadPersonalContext(userId)` — Used by private therapy chat.

Both query up to **8 data sources** and inject them into `buildSystemPrompt()`:

1. **Couple profile** (patterns, strategies, wins) — `couple_profiles`
2. **Partner profiles** (triggers, coping, growth areas) — `user.profileData`
3. **Childhood wounds** (title, intensity) — `childhood_wounds`
4. **Attachment style quiz** (secure/anxious/avoidant/fearful scores) — `attachment_style_results`
5. **Love language quiz** (5 language scores) — `love_language_results`
6. **Past challenge summaries** (themes, commitments, dynamics) — `challenge_summaries`
7. **Recent mood trends** (last 7 days) — `mood_entries`
8. **De-escalation history** (triggers, reflections) — `deescalation_sessions`

---

## Conventions

### Commit Messages

Use conventional commits: `<type>: <description>`

| Type       | Description                                             |
| ---------- | ------------------------------------------------------- |
| `feat`     | A new feature                                           |
| `fix`      | A bug fix                                               |
| `docs`     | Documentation only changes                              |
| `style`    | Formatting, whitespace (no code change)                 |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf`     | Performance improvement                                 |
| `test`     | Adding or correcting tests                              |
| `chore`    | Build process, tooling, dependencies                    |

### Real-Time Updates (MANDATORY)

All features that involve partner collaboration **MUST** use Socket.IO to push live updates. When one partner takes an action, the other partner's page MUST update automatically — no page refresh required.

- Emit `CHALLENGE_UPDATED` (or feature-specific events) from API routes via `getIO().to("couple:${coupleId}").emit(EVENT, data)`
- Use client hooks (`useChallengeSocket`, `usePartnerSocket`, etc.) to listen and refetch
- Event constants live in `src/lib/socket/events.ts`
- Skip own events with `userId` filtering in the client hook

### Code Style

- TypeScript strict mode
- ESLint with Next.js config
- Vanilla CSS with custom properties (no Tailwind)
- App Router patterns (server components by default, `"use client"` when needed)
- Drizzle ORM for all database interactions

### Pre-handoff Testing (MANDATORY)

**Before handing ANY work back to the user, you MUST:**

1. Run **all** integration tests and confirm they pass:
   ```bash
   npx vitest run
   ```
2. Run **all** E2E tests and confirm they pass:
   ```bash
   npx playwright test
   ```
3. Fix any failures — do NOT hand off with known test failures
4. If new features were added, write tests for them first and include them in the run

> **This is non-negotiable.** The user should never be the one to discover test failures. Always verify the full suite, not just the new tests.

---

## Key Concepts

### Challenges (Core Feature)

A Challenge represents a conflict or issue the couple wants to work through:

1. **Create** — Title + category (communication, finances, parenting, etc.)
2. **Write perspectives** — Each partner writes independently (can't see each other's)
3. **AI synthesis** — Neutral description created from both perspectives
4. **Review & accept** — Both partners must accept the synthesis
5. **Discussion** — Chat-style interface with AI guidance
6. **Requests & commitments** — Each partner makes specific requests
7. **Resolution** — Mark resolved with lessons learned

### AI Memory Tiers

- **Tier 1**: Per-challenge context (perspectives, messages, requests)
- **Tier 2**: Cross-challenge summaries (patterns, triggers, growth areas)
- **Tier 3**: Evolving profiles — personal (`profileData`, childhood wounds, attachment styles, love languages, mood trends, de-escalation history) + couple profiles

---

## Additional Documentation

- **Project status & feature tracker**: `.agent/project-status.md`
- **Git workflow**: `.agent/skills/git-helpers/SKILL.md`
- **Pre-handoff verification**: `.agent/workflows/verify.md`
- **Post-feature QA**: `.agent/workflows/post-feature-qa.md`
- **Commands reference**: `.agent/commands.md`
