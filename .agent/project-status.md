# Kuxani — Project Status

> Last updated: 2026-02-17 (CI/CD: GitHub Actions pipeline with parallel lint, test, build, E2E jobs)

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

- [x] **Database migrations** — Drizzle `generate` + `migrate` configured in Dockerfile
- [x] **Partner invitation flow** — Invite link/code generation + join couple
- [x] **Challenges workspace** — Full lifecycle: create, perspectives, AI synthesis, accept/reject, discussion, requests, resolution
- [ ] **Collaborative editor** — Yjs + Tiptap + Hocuspocus for perspective writing
- [x] **AI streaming endpoint** — SSE streaming for synthesis and discussion
- [x] **Challenge discussion thread** — Chat-style interface with AI guidance
- [x] **Requests & commitments** — Submit, accept, track partner requests
- [ ] **File attachments** — MinIO upload/download for WhatsApp exports, screenshots, audio
- [x] **Coolify deployment config** — Docker Compose for production + Coolify setup

---

## Phase 2 — Personal Growth

### ✅ Completed

- [x] **Personal therapy chat** — Private AI chat for individual reflection (schema, API, UI with chat list + chat detail)
- [x] **Mood & emotion tracker** — Daily check-in with Plutchik emotion wheel, weekly trends, history
- [x] **Love languages assessment** — 5 Love Languages quiz, results visualization, AI integration

### ⬜ Pending

- [ ] **Privacy controls** — Private vs shared chat visibility, granular sharing

---

## Phase 3 — Deeper Features

### ✅ Completed

- [x] **Gratitude journal** — Daily prompt, category system, optional sharing, AI prompts
- [x] **Emergency de-escalation mode** — Breathing exercise, cooling timer, AI prompts, reflection
- [x] **Childhood Wounds** — CRUD wounds, partner suggestions, AI suggestions, intensity rating (1-10), two-column partner view
- [x] **Attachment Styles** — 20-question Likert quiz, results visualization, real-time partner updates
- [x] **AI Context / Memory** — Centralized `loadCoupleContext()` / `loadPersonalContext()` feeding 8 data sources into all 5 AI routes

### ⬜ Pending

- [ ] **Weekly relationship check-in** — Guided questionnaire (private first, then shared), AI summary
- [ ] **Conflict pattern recognition** — AI analysis of recurring patterns, triggers, growth areas
- [ ] **Guided exercises & homework** — AI-curated exercises (Gottman, EFT), tracking, reflection

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
| 1   | Onboarding & Partner Invite     | 1     | ✅ Done    |
| 2   | Challenges (Conflict Workspace) | 1     | ✅ Done    |
| 3   | Personal Therapy Chat           | 2     | ✅ Done    |
| 4   | Chat Interface (ChatGPT-like)   | 1     | ⬜ Pending |
| 5   | Privacy Controls                | 2     | ⬜ Pending |
| 6   | Mood & Emotion Tracker          | 2     | ✅ Done    |
| 7   | Love Languages Assessment       | 2     | ✅ Done    |
| 8   | Weekly Relationship Check-In    | 3     | ⬜ Pending |
| 9   | Gratitude Journal               | 3     | ✅ Done    |
| 10  | Conflict Pattern Recognition    | 3     | ⬜ Pending |
| 11  | Guided Exercises & Homework     | 3     | ⬜ Pending |
| 12  | Emergency De-escalation Mode    | 3     | ✅ Done    |
| 17  | Childhood Wounds                | 3     | ✅ Done    |
| 18  | Attachment Styles               | 2     | ✅ Done    |
| 19  | AI Context / Memory             | 3     | ✅ Done    |
| 13  | Milestone Timeline              | 4     | ⬜ Pending |
| 14  | Resource Library                | 4     | ⬜ Pending |
| 15  | Session Notes & Insights Export | 4     | ⬜ Pending |
| 16  | Live Voice Sessions             | 4     | ⬜ Pending |

---

## Infrastructure Status

| Component           | Status        | Notes                                                              |
| ------------------- | ------------- | ------------------------------------------------------------------ |
| PostgreSQL 17       | ✅ Configured | Docker Compose, port 5432                                          |
| MinIO (S3)          | ✅ Configured | Docker Compose, ports 9000/9001                                    |
| Socket.IO           | ✅ Configured | Custom server (`server.ts`), same-port                             |
| Hocuspocus (Yjs WS) | ⬜ Pending    | Config in `.env.example`, not yet set up                           |
| Coolify             | ✅ Configured | Dockerfile + deployment guide ready                                |
| Docker Build        | ✅ Fixed      | Lazy OpenAI, force-dynamic, tsconfig.server.json                   |
| CI/CD               | ✅ Configured | GitHub Actions: parallel lint, test (unit+integration), build, E2E |

---

## Relationship & Personality Assessments

> Future assessments to be included in the app. These tests will help couples understand themselves, each other, and their relationship dynamics.

### Relationship-Specific Assessments

- [x] **Love Languages** — 5 Love Languages quiz, results visualization, AI integration.
- [ ] **Gottman's Four Horsemen Assessment** — Identifies destructive communication patterns (criticism, contempt, defensiveness, stonewalling) based on John Gottman's research.
- [ ] **Relationship Satisfaction Scales (DAS, CSI)** — The Dyadic Adjustment Scale and Couples Satisfaction Index measure overall relationship quality.
- [ ] **Conflict Resolution Style Inventory** — Identifies how partners handle disagreements (competing, collaborating, compromising, avoiding, accommodating — based on Thomas-Kilmann's model).
- [ ] **Prepare/Enrich** — A widely used premarital and marriage assessment covering communication, conflict resolution, financial management, and more. Often administered by counselors.

### Personality & Interpersonal Style

- [ ] **Enneagram** — Nine personality types, each with distinct motivations, fears, and relational patterns. Very popular in relationship coaching.
- [ ] **Myers-Briggs (MBTI)** — 16 personality types based on four dichotomies (introversion/extraversion, sensing/intuition, thinking/feeling, judging/perceiving).
- [ ] **Big Five (OCEAN)** — The most empirically validated personality model: Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism.
- [ ] **DISC Assessment** — Measures Dominance, Influence, Steadiness, and Conscientiousness in communication and behavior.

### Emotional & Psychological

- [x] **Attachment Styles** — 40-question Likert quiz identifying attachment patterns (secure, anxious, avoidant, disorganized), results visualization, real-time partner updates.
- [ ] **Emotional Intelligence (EQ) Tests** — Measures self-awareness, empathy, emotional regulation, and social skills (e.g., the Mayer-Salovey-Caruso test).
- [ ] **Adverse Childhood Experiences (ACEs)** — A 10-question screener measuring childhood trauma, which strongly correlates with adult relationship patterns.
- [ ] **Differentiation of Self Inventory** — Based on Murray Bowen's family systems theory; measures emotional reactivity, ability to maintain a sense of self while in close relationships.
- [ ] **Codependency Assessments** — Various instruments measuring over-reliance on a partner for identity and self-worth.

### Sexuality & Intimacy

- [ ] **Erotic Blueprints** — Categorizes arousal patterns into five types (energetic, sensual, sexual, kinky, shapeshifter).
- [ ] **Desire Discrepancy Scales** — Measures differences in sexual desire between partners.

### Values & Compatibility

- [ ] **VIA Character Strengths Survey** — Identifies 24 character strengths; useful for understanding what each partner values most.
- [ ] **Schwartz Values Survey** — Maps personal values across dimensions like self-transcendence vs. self-enhancement.
