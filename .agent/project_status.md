# Kuxani — Project Status

> Last updated: 2026-02-14

---

## Phase 1 — Foundation (MVP)

### ✅ Completed

- [x] **Next.js project setup** — Next.js 16 with TypeScript, App Router, ESLint, Turbopack
- [x] **Docker Compose** — PostgreSQL 17-alpine + MinIO (S3-compatible storage)
- [x] **Drizzle ORM schema** — 6 schema files covering all tables (users, couples, challenges, chats, mood, auth)
- [x] **Better Auth setup** — Server config with Drizzle adapter, email/password auth, React client hooks
- [x] **AI client & prompts** — OpenAI client with 4 model constants, therapeutic prompt system (Gottman/EFT/Attachment)
- [x] **Design system** — Full CSS custom properties (light/dark themes, Inter + Outfit fonts, partner colors, components, animations)
- [x] **Root layout** — Metadata, global styles
- [x] **Landing page** — Hero with gradient text, feature cards, how-it-works steps, footer
- [x] **Login page** — Email/password form
- [x] **Signup page** — Name/email/password form
- [x] **Dashboard page** — Quick action cards with sidebar layout
- [x] **Dashboard layout** — Authenticated layout with sidebar navigation + emergency de-escalation FAB
- [x] **Auth API route** — Better Auth catch-all API endpoint

### ⬜ Pending

- [ ] **Database migrations** — Run `db:push` or `db:generate` + `db:migrate` to initialize DB
- [ ] **Partner invitation flow** — Invite link/code generation + join couple
- [ ] **Challenge CRUD** — Create, list, view, edit challenges
- [ ] **Collaborative editor** — Yjs + Tiptap + Hocuspocus for perspective writing
- [ ] **AI streaming endpoint** — Streaming responses for synthesis and chat
- [ ] **Challenge discussion thread** — Chat-style interface with partner attribution
- [ ] **Requests & commitments** — Submit, accept, track partner requests
- [ ] **File attachments** — MinIO upload/download for WhatsApp exports, screenshots, audio
- [ ] **Coolify deployment config** — Docker Compose for production + Coolify setup

---

## Phase 2 — Personal Growth

### ⬜ Pending

- [ ] **Personal therapy chat** — Private AI chat for individual reflection
- [ ] **Privacy controls** — Private vs shared chat visibility, granular sharing
- [ ] **Mood & emotion tracker** — Daily check-in with Plutchik emotion wheel, weekly trends
- [ ] **Love languages assessment** — 5 Love Languages quiz, side-by-side results, AI integration

---

## Phase 3 — Deeper Features

### ⬜ Pending

- [ ] **Weekly relationship check-in** — Guided questionnaire (private first, then shared), AI summary
- [ ] **Gratitude journal** — Daily prompt, optional sharing as "love notes", monthly summary
- [ ] **Conflict pattern recognition** — AI analysis of recurring patterns, triggers, growth areas
- [ ] **Guided exercises & homework** — AI-curated exercises (Gottman, EFT), tracking, reflection
- [ ] **Emergency de-escalation mode** — Breathing exercise, cooling timer, immediate AI prompts

---

## Phase 4 — Polish & Scale

### ⬜ Pending

- [ ] **Milestone timeline** — Visual journey timeline, resolved challenges, progress celebration
- [ ] **Resource library** — Curated articles, videos, books by topic, AI-recommended
- [ ] **Session notes & insights export** — PDF export of summaries for human therapist sharing
- [ ] **Mobile responsiveness / PWA** — Responsive design, Progressive Web App
- [ ] **Push notifications** — Notifications for partner activity, reminders

---

## Feature Details (All Phases)

| #   | Feature                         | Phase | Status     |
| --- | ------------------------------- | ----- | ---------- |
| 1   | Onboarding & Partner Invite     | 1     | ⬜ Pending |
| 2   | Challenges (Conflict Workspace) | 1     | ⬜ Pending |
| 3   | Personal Therapy Chat           | 2     | ⬜ Pending |
| 4   | Chat Interface (ChatGPT-like)   | 1     | ⬜ Pending |
| 5   | Privacy Controls                | 2     | ⬜ Pending |
| 6   | Mood & Emotion Tracker          | 2     | ⬜ Pending |
| 7   | Love Languages Assessment       | 2     | ⬜ Pending |
| 8   | Weekly Relationship Check-In    | 3     | ⬜ Pending |
| 9   | Gratitude Journal               | 3     | ⬜ Pending |
| 10  | Conflict Pattern Recognition    | 3     | ⬜ Pending |
| 11  | Guided Exercises & Homework     | 3     | ⬜ Pending |
| 12  | Emergency De-escalation Mode    | 3     | ⬜ Pending |
| 13  | Milestone Timeline              | 4     | ⬜ Pending |
| 14  | Resource Library                | 4     | ⬜ Pending |
| 15  | Session Notes & Insights Export | 4     | ⬜ Pending |
| 16  | Live Voice Sessions             | 4     | ⬜ Pending |

---

## Infrastructure Status

| Component           | Status        | Notes                                    |
| ------------------- | ------------- | ---------------------------------------- |
| PostgreSQL 17       | ✅ Configured | Docker Compose, port 5432                |
| MinIO (S3)          | ✅ Configured | Docker Compose, ports 9000/9001          |
| Hocuspocus (Yjs WS) | ⬜ Pending    | Config in `.env.example`, not yet set up |
| Coolify             | ⬜ Pending    | Not yet created                          |
| CI/CD               | ⬜ Pending    | Not yet configured                       |
