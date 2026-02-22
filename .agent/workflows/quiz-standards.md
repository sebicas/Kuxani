---
description: Standards and checklist for creating a new couple quiz (e.g. Love Languages, Attachment Styles). Ensures consistent design, partner results, answer tracking, real-time updates, and tests.
---

# Quiz Standards Workflow

Follow this checklist whenever you create a **new couple quiz** in Kuxani.
Reference implementations: `love-languages` and `attachment-styles`.

---

## 1. Data File — `src/lib/data/<quiz-name>.ts`

Every quiz needs a single data file exporting:

| Export                                | Type                              | Purpose                       |
| ------------------------------------- | --------------------------------- | ----------------------------- |
| `<Key>` type                          | union literal (e.g. `"W" \| "A"`) | Short key per category        |
| `QUIZ_QUESTIONS` or `QUIZ_STATEMENTS` | array of question objects         | Quiz content                  |
| `<QUIZ>_NAMES`                        | `Record<Key, string>`             | Human-readable category names |
| `<QUIZ>_EMOJIS`                       | `Record<Key, string>`             | Emoji per category            |
| `<QUIZ>_COLORS`                       | `Record<Key, string>`             | Hex color per category        |
| `<QUIZ>_DESCRIPTIONS`                 | `Record<Key, string>`             | Long description per category |

**Question format** — choose one:

- **Paired choice** (like Love Languages): `{ id, optionA: {text, language}, optionB: {text, language} }`
- **Likert scale** (like Attachment Styles): `{ id, text, style }` + `LIKERT_LABELS` constant

---

## 2. DB Schema — `src/lib/db/schema/mood.ts`

Add a new table to the existing schema file:

```typescript
export const <quizName>Results = pgTable("<quiz_name>_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  // One integer column per category (score)
  <category1>: integer("<category_1>").notNull(),
  <category2>: integer("<category_2>").notNull(),
  // ...
  answers: jsonb("answers"), // Raw quiz answers for review
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

Also add:

- **Relations**: `one(user)` relation
- **Type export**: `export type <QuizName>Result = typeof <quizName>Results.$inferSelect;`

Then run `npx drizzle-kit generate` and `npx drizzle-kit push` (or migrate).

---

## 3. Socket Event — `src/lib/socket/events.ts`

Add a new event constant:

```typescript
export const <QUIZ_NAME>_UPDATED = "<quiz-name>-updated";
```

---

## 4. API Route — `src/app/api/<quiz-name>/route.ts`

Create a route with **GET** and **POST**:

### GET `/api/<quiz-name>`

1. Authenticate via `getServerSession()`
2. Fetch user's **latest** result (order by `createdAt DESC`, limit 1)
3. Fetch user's **name** from `user` table
4. Find **partner** via `coupleMembers` join (same couple, different userId)
5. Fetch partner's **name** + **latest result**
6. Return: `{ userResult, partnerResult, userName, partnerName }`

### POST `/api/<quiz-name>`

1. Authenticate
2. Parse & **validate** scores (range check per quiz type)
3. Insert into DB with `answers` field
4. **Emit socket event** to `couple:<coupleId>` room:
   ```typescript
   getIO()
     .to(`couple:${coupleId}`)
     .emit(<QUIZ_NAME>_UPDATED, {
       resultId: result.id,
       action: "<quiz-name>-completed",
       userId: session.user.id,
     });
   ```
5. Wrap socket emit in `try/catch` (not available in test env)
6. Return the created result with status 201

---

## 5. Page Component — `src/app/(dashboard)/<quiz-name>/page.tsx`

### Architecture: 4-State View Machine

```
"loading" → "start" → "quiz" → "results"
                ↑                    │
                └────── (retake) ────┘
```

### Required State

```typescript
// View
const [view, setView] = useState<ViewState>("loading");

// Results (both partners)
const [userResult, setUserResult] = useState<Result | null>(null);
const [partnerResult, setPartnerResult] = useState<Result | null>(null);
const [userName, setUserName] = useState("You");
const [partnerName, setPartnerName] = useState<string | null>(null);
const [selectedPartner, setSelectedPartner] = useState<"user" | "partner">(
  "user",
);

// Quiz progress
const [currentQuestion, setCurrentQuestion] = useState(0);
const [answers, setAnswers] = useState(/* array of nulls */);

// Real-time
const [coupleId, setCoupleId] = useState<string | null>(null);
const [currentUserId, setCurrentUserId] = useState<string | null>(null);
```

### Required Behaviors

| Behavior                      | Implementation                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| **Initial load**              | `useEffect` → fetch `/api/<quiz-name>`, `/api/couples`, `/api/auth/get-session`      |
| **Real-time partner updates** | `useCoupleSocket(coupleId, <EVENT>, currentUserId, fetchResults)`                    |
| **Score derivation**          | `useMemo` from answers array                                                         |
| **Submit**                    | POST scores + answers → GET full results (including partner) → set view to "results" |
| **Partner toggle**            | Tab UI switching between user/partner results                                        |
| **Ranked display**            | Sort categories by score descending                                                  |
| **Bar chart**                 | Horizontal bars with category colors, width = `score / maxScore * 100%`              |
| **Answer review**             | Show each question with the chosen answer highlighted                                |
| **Retake**                    | Reset answers array, set view to "quiz"                                              |

### View States

1. **Loading**: Show header + spinner
2. **Start**: Card with icon, title, description, category preview tags, "Start Quiz" button
3. **Quiz**: Progress bar, question card, option buttons, navigation (Back / Next / Submit)
4. **Results**: Partner toggle → summary card (top category) → bar chart → quiz answers → retake button

---

## 6. CSS Module — `src/app/(dashboard)/<quiz-name>/<quiz-name>.module.css`

Use the **exact same class structure** as `love-languages.module.css`. Required sections:

| Section        | Key classes                                                                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header         | `.llHeader` (rename prefix per quiz)                                                                                                                                       |
| Start screen   | `.startCard`, `.startIcon`, `.startTitle`, `.startDescription`, `.languagePreview`, `.languageTag`                                                                         |
| Quiz           | `.quizContainer`, `.progressBar`, `.progressFill`, `.progressText`, `.questionCard`, `.questionText`, `.optionsList`, `.optionBtn`, `.selectedOption`                      |
| Navigation     | `.quizNav`, `.navBtn`, `.navBtnDisabled`                                                                                                                                   |
| Results        | `.resultsContainer`, `.resultsSummary`, `.resultsTopEmoji`, `.resultsTopLabel`, `.resultsTopName`, `.resultsDescription`                                                   |
| Bar chart      | `.barChart`, `.barRow`, `.barLabel`, `.barTrack`, `.barFill`, `.barScore`                                                                                                  |
| Partner toggle | `.partnerToggle`, `.partnerTab`, `.partnerTabActive`, `.partnerTabDisabled`, `.partnerTabEmoji`, `.partnerTabBadge`, `.partnerTabPending`                                  |
| Answers        | `.answersSection`, `.answersList`, `.answerItem`, `.answerNumber`, `.answerOptions`, `.answerOption`, `.answerChosen`, `.answerLanguageTag`, `.answerText`, `.answerCheck` |
| Retake         | `.retakeRow`                                                                                                                                                               |
| Responsive     | `@media (max-width: 768px)` overrides                                                                                                                                      |

Use **design system variables** for all values: `var(--space-*)`, `var(--font-*)`, `var(--radius-*)`, `var(--shadow-*)`, `var(--transition-*)`, `var(--bg-*)`, `var(--text-*)`, `var(--border-*)`, `var(--accent-*)`.

---

## 7. Tests

Create **two test files**:

### Data test — `tests/<quiz-name>-data.test.ts`

- All questions have unique IDs
- Each category has the expected number of questions
- Names/Emojis/Colors/Descriptions cover all keys

### Page test — `tests/<quiz-name>-page.test.tsx`

- Renders loading state
- Shows start screen when no results
- Navigates through quiz questions
- Submits and shows results
- Partner toggle works
- Partner "Pending" state shows correctly

---

## 8. Checklist

Use this checklist when building a new quiz:

```markdown
- [ ] Create `src/lib/data/<quiz-name>.ts` with types, questions, names, emojis, colors, descriptions
- [ ] Add DB table + relations + type export in `src/lib/db/schema/mood.ts`
- [ ] Run `npx drizzle-kit generate` + `npx drizzle-kit push`
- [ ] Add socket event in `src/lib/socket/events.ts`
- [ ] Create API route `src/app/api/<quiz-name>/route.ts` (GET + POST)
- [ ] Create page `src/app/(dashboard)/<quiz-name>/page.tsx`
- [ ] Create CSS module `src/app/(dashboard)/<quiz-name>/<quiz-name>.module.css`
- [ ] Add nav link (if applicable)
- [ ] Create data test `tests/<quiz-name>-data.test.ts`
- [ ] Create page test `tests/<quiz-name>-page.test.tsx`
- [ ] Verify: `npm run build` passes
- [ ] Verify: `npm test` passes
- [ ] Verify: partner real-time updates work in browser
```
