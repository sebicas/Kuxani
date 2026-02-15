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

## Tech Stack

| Layer            | Technology                         | Purpose                                      |
| ---------------- | ---------------------------------- | -------------------------------------------- |
| **Framework**    | Next.js 16 (App Router)            | Full-stack React with SSR, TypeScript        |
| **Styling**      | Vanilla CSS (custom design system) | Full control, premium feel, dark/light       |
| **Auth**         | Better Auth                        | Self-hosted, TypeScript-native auth          |
| **Database**     | PostgreSQL 17 + Drizzle ORM        | Type-safe queries, auto migrations           |
| **File Storage** | MinIO (S3-compatible)              | Self-hosted object storage                   |
| **Real-time**    | Yjs + Hocuspocus                   | CRDT-based collaborative editing             |
| **Rich Text**    | Tiptap (ProseMirror + Yjs)         | Collaborative editor                         |
| **AI**           | OpenAI (gpt-4.1 family)            | Text reasoning, transcription, TTS           |
| **Deployment**   | Coolify                            | `kuxani.com` (prod) · `dev.kuxani.com` (dev) |

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
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── client.ts             # OpenAI client + model constants
│   │   │   └── prompts.ts            # Therapeutic prompts (Gottman/EFT/Attachment)
│   │   ├── auth/
│   │   │   ├── index.ts              # Better Auth server config (Drizzle adapter)
│   │   │   └── client.ts             # React hooks (useSession, signIn, signUp, signOut)
│   │   └── db/
│   │       ├── index.ts              # Drizzle client initialization
│   │       └── schema/
│   │           ├── index.ts          # Schema barrel export
│   │           ├── auth.ts           # user, session, account, verification (Better Auth CLI-generated)
│   │           ├── couples.ts        # couples, couple_members, couple_profiles
│   │           ├── challenges.ts     # challenges, perspectives, messages, requests,
│   │           │                     # attachments, summaries, voice_sessions, segments
│   │           ├── chats.ts          # personal_chats, personal_messages
│   │           └── mood.ts           # mood_entries, gratitude_entries
├── drizzle/
│   └── migrations/                   # Auto-generated SQL migrations
├── public/                           # Static assets
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

- **Node.js** ≥ 20
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

| Script                | Description                          |
| --------------------- | ------------------------------------ |
| `npm run dev`         | Start Next.js dev server (Turbopack) |
| `npm run build`       | Production build                     |
| `npm run start`       | Start production server              |
| `npm run lint`        | Run ESLint                           |
| `npm run db:generate` | Generate Drizzle migrations          |
| `npm run db:migrate`  | Run Drizzle migrations               |
| `npm run db:push`     | Push schema directly (dev)           |
| `npm run db:studio`   | Open Drizzle Studio (DB browser)     |
| `npm test`            | Run **all** tests (unit + E2E)       |
| `npm run test:unit`   | Unit/integration tests only (Vitest) |
| `npm run test:watch`  | Tests in watch mode                  |
| `npm run test:e2e`    | E2E browser tests only (Playwright)  |

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

| Schema File     | Tables                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `auth.ts`       | `user`, `session`, `account`, `verification` (Better Auth CLI-generated, includes `profile_data` JSONB)                         |
| `couples.ts`    | `couples`, `couple_members`, `couple_profiles`                                                                                  |
| `challenges.ts` | `challenges`, `perspectives`, `messages`, `requests`, `attachments`, `summaries`, `voice_sessions`, `voice_transcript_segments` |
| `chats.ts`      | `personal_chats`, `personal_messages`                                                                                           |
| `mood.ts`       | `mood_entries`, `gratitude_entries`                                                                                             |

---

## AI Architecture

### Models Used

| Model               | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `gpt-4.1`           | Main reasoning (synthesis, therapy chat) |
| `gpt-4.1-mini`      | Summaries, pattern detection             |
| `gpt-4o-transcribe` | Voice-to-text (live sessions)            |
| `gpt-4o-mini-tts`   | Text-to-speech (therapist voice)         |

### Prompt System

The AI uses therapeutic frameworks (Gottman Method, EFT, Attachment Theory) with a memory-aware context builder that injects:

1. **Couple profile** (patterns, love languages)
2. **Past challenge summaries** (last 5–10)
3. **Current user's personal profile** (if private chat)
4. **Current conversation context** (perspectives, discussion, requests)

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
- **Tier 3**: Evolving profiles (personal + couple profiles)

---

## Additional Documentation

- **Project status & feature tracker**: `.agent/project_status.md`
- **Git workflow**: `.agent/skills/git-helpers/SKILL.md`
- **Pre-handoff verification**: `.agent/workflows/verify.md`
- **Commands reference**: `.agent/commands.md`
