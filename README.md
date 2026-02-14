<div align="center">

<!-- Hero Section -->
<img src="https://img.shields.io/badge/💜-AI--Powered_Couples_Therapy-6366f1?style=for-the-badge&labelColor=eef2ff" alt="AI-Powered Couples Therapy" />

<br /><br />

# Kuxani.

### Harmonize Your **Perspectives**, Heal Together

<br />

<p>
  <em>A collaborative platform where couples work together to understand each other,<br />
  resolve conflicts constructively, and build a stronger relationship —<br />
  guided by AI with therapeutic expertise.</em>
</p>

<br />

<a href="#-getting-started"><img src="https://img.shields.io/badge/🚀_Get_Started-6366f1?style=for-the-badge" alt="Get Started" /></a>
&nbsp;
<a href="#-how-it-works"><img src="https://img.shields.io/badge/📖_How_It_Works-818cf8?style=for-the-badge" alt="How It Works" /></a>
&nbsp;
<a href="#-contributing"><img src="https://img.shields.io/badge/🤝_Contribute-ec4899?style=for-the-badge" alt="Contribute" /></a>

<br /><br />

![Next.js](https://img.shields.io/badge/Next.js_16-000?style=flat-square&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_17-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI_GPT--4.1-412991?style=flat-square&logo=openai&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-Private-gray?style=flat-square)

</div>

<br />

---

## 💡 About

**Kuxani** is an AI-mediated couples therapy platform that helps partners navigate conflicts, understand each other's perspectives, and grow stronger together. Built on therapeutic frameworks like the Gottman Method, Emotionally Focused Therapy (EFT), and Attachment Theory, Kuxani provides a safe, structured environment for meaningful relationship work.

> _"Kuxani"_ comes from the Huichol word for _"to love,"_ reflecting the platform's mission of nurturing deeper connection, understanding, and healing between partners.

<br />

## ✨ Features

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>🔮 Challenges</h3>
      <p>Each partner writes their perspective independently. Our AI creates a neutral synthesis that validates both viewpoints without blame.</p>
    </td>
    <td width="50%" valign="top">
      <h3>💬 Private Therapy</h3>
      <p>Your own safe space with the AI therapist. Explore personal patterns, process emotions, and prepare for shared conversations.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>🎙️ Live Voice Sessions</h3>
      <p>Real-time voice conversations with the AI therapist — like a live couples therapy session, right from your browser.</p>
    </td>
    <td width="50%" valign="top">
      <h3>📊 Pattern Recognition</h3>
      <p>AI analyzes your history to identify recurring dynamics, triggers, and growth areas — helping you break negative cycles.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>🫶 Mood & Gratitude</h3>
      <p>Daily check-ins, emotion tracking, and gratitude journaling. Celebrate your partner and track your emotional landscape.</p>
    </td>
    <td width="50%" valign="top">
      <h3>🚨 De-escalation Mode</h3>
      <p>Quick-access during heated moments: guided breathing, cooling timer, and immediate AI de-escalation prompts.</p>
    </td>
  </tr>
</table>

<br />

## 🔄 How It Works

```
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐
   │  1. Create   │    │ 2. Write    │    │   3. AI     │    │  4. Discuss &   │
   │  a Challenge │───▶│  Your Side  │───▶│  Synthesis  │───▶│    Resolve      │
   │             │    │             │    │             │    │                 │
   │ Name the    │    │ Each partner│    │ AI reads    │    │ Chat with AI    │
   │ issue &     │    │ writes      │    │ both sides  │    │ guidance. Make  │
   │ categorize  │    │ independently│    │ & creates a │    │ requests &      │
   │ it.         │    │ & privately.│    │ neutral     │    │ commitments.    │
   │             │    │             │    │ summary.    │    │                 │
   └─────────────┘    └─────────────┘    └─────────────┘    └─────────────────┘
```

<br />

## 🏗️ Tech Stack

| Layer            | Technology                         | Purpose                                       |
| :--------------- | :--------------------------------- | :-------------------------------------------- |
| **Framework**    | Next.js 16 (App Router)            | Full-stack React with SSR & TypeScript        |
| **Styling**      | Vanilla CSS (custom design system) | Full control, premium feel, dark/light themes |
| **Auth**         | Better Auth                        | Self-hosted, TypeScript-native authentication |
| **Database**     | PostgreSQL 17 + Drizzle ORM        | Type-safe queries, auto-generated migrations  |
| **File Storage** | MinIO (S3-compatible)              | Self-hosted object storage                    |
| **Real-time**    | Yjs + Hocuspocus                   | CRDT-based collaborative editing              |
| **Rich Text**    | Tiptap (ProseMirror + Yjs)         | Collaborative rich-text editor                |
| **AI**           | OpenAI (GPT-4.1 family)            | Text reasoning, transcription, TTS            |
| **Deployment**   | Coolify                            | Self-hosted deployment platform               |

<br />

## 🧠 AI Architecture

Kuxani uses a multi-model approach powered by the **GPT-4.1 family**:

| Model               | Purpose                                         |
| :------------------ | :---------------------------------------------- |
| `gpt-4.1`           | Main reasoning — synthesis, guided therapy chat |
| `gpt-4.1-mini`      | Summaries, pattern detection, quick analysis    |
| `gpt-4o-transcribe` | Voice-to-text for live sessions                 |
| `gpt-4o-mini-tts`   | Text-to-speech (therapist voice)                |

The AI uses **therapeutic frameworks** (Gottman Method, EFT, Attachment Theory) with a memory-aware context builder that injects couple profiles, past challenge summaries, personal profiles, and current conversation context.

<br />

## 📁 Project Structure

```
kuxani/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── layout.tsx              # Root layout (metadata, global styles)
│   │   ├── page.tsx                # Landing page (hero, features, how-it-works)
│   │   ├── globals.css             # Design system (tokens, components, animations)
│   │   ├── (auth)/                 # Login & Signup pages
│   │   ├── (dashboard)/            # Authenticated dashboard pages
│   │   └── api/auth/[...all]/      # Better Auth API catch-all
│   └── lib/
│       ├── ai/                     # OpenAI client, therapeutic prompts
│       ├── auth/                   # Better Auth config & React hooks
│       └── db/                     # Drizzle client & schema definitions
├── drizzle/                        # Auto-generated SQL migrations
├── tests/                          # Vitest integration tests
├── e2e/                            # Playwright E2E tests
├── docker-compose.yml              # PostgreSQL 17 + MinIO
└── package.json
```

<br />

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **Docker** & Docker Compose (for PostgreSQL + MinIO)

### Setup

```bash
# 1. Clone the repository
git clone git@github.com:sebicas/Kuxani.git && cd Kuxani

# 2. Install dependencies
npm install

# 3. Start infrastructure (PostgreSQL + MinIO)
docker compose up -d

# 4. Configure environment
cp .env.example .env
# Edit .env with your BETTER_AUTH_SECRET and OPENAI_API_KEY

# 5. Push database schema
npm run db:push

# 6. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app. ✨

### Available Scripts

| Script              | Description                          |
| :------------------ | :----------------------------------- |
| `npm run dev`       | Start Next.js dev server (Turbopack) |
| `npm run build`     | Production build                     |
| `npm run lint`      | Run ESLint                           |
| `npm run db:push`   | Push schema to database (dev)        |
| `npm run db:studio` | Open Drizzle Studio (DB browser)     |
| `npm test`          | Run all tests (unit + E2E)           |
| `npm run test:unit` | Unit/integration tests (Vitest)      |
| `npm run test:e2e`  | E2E browser tests (Playwright)       |

<br />

## 🤝 Contributing

We'd love your help in making Kuxani better! Whether you're passionate about **mental health**, **AI**, **real-time collaboration**, or **beautiful UI/UX** — there's a place for you here.

### How to Contribute

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feat/your-feature`
3. **Commit** your changes using [conventional commits](https://www.conventionalcommits.org/): `git commit -m "feat: add new feature"`
4. **Push** to your branch: `git push origin feat/your-feature`
5. **Open** a Pull Request

### Areas We Need Help With

- 🎨 **UI/UX Design** — Improving the visual experience and accessibility
- 🧠 **AI Prompts** — Fine-tuning therapeutic prompts and response quality
- 🌍 **Internationalization** — Translating the platform to more languages
- 🧪 **Testing** — Expanding test coverage (unit, integration, E2E)
- 📱 **Mobile Experience** — Optimizing the responsive design
- 📖 **Documentation** — Writing guides, tutorials, and API docs
- 🔒 **Security** — Reviewing auth flows, data privacy, and encryption
- ♿ **Accessibility** — Ensuring the platform is usable by everyone

### Commit Convention

| Type       | Description                          |
| :--------- | :----------------------------------- |
| `feat`     | A new feature                        |
| `fix`      | A bug fix                            |
| `docs`     | Documentation changes                |
| `style`    | Formatting (no code change)          |
| `refactor` | Code restructuring                   |
| `perf`     | Performance improvement              |
| `test`     | Adding or correcting tests           |
| `chore`    | Build process, tooling, dependencies |

<br />

## 💜 Philosophy

Kuxani is built on the belief that technology can help people connect more deeply. Every feature is designed with empathy, privacy, and therapeutic best practices at its core.

> **Partner Colors**: <img src="https://img.shields.io/badge/Partner_A-6366f1?style=flat-square" alt="Partner A - Indigo" /> Indigo &nbsp;&nbsp; <img src="https://img.shields.io/badge/Partner_B-ec4899?style=flat-square" alt="Partner B - Pink" /> Pink

<br />

---

<div align="center">

**Built with** ♥ **for couples who want to grow together.**

<br />

<sub>
  <a href="https://github.com/sebicas/Kuxani">GitHub</a> •
  <a href="https://github.com/sebicas/Kuxani/issues">Issues</a> •
  <a href="https://github.com/sebicas/Kuxani/pulls">Pull Requests</a>
</sub>

</div>
