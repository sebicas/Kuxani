---
description: Intelligently group uncommitted changes into logical commits and push to remote
---

# Push to Remote

// turbo-all

## Steps

1. **Analyze repository status**:
   - Run `git status` and `git diff --stat` to identify all uncommitted changes.
   - If there are no changes, STOP and inform the user.

2. **Group changes**:
   - Analyze the changed files in the context of recent work.
   - Determine if changes belong to a single logical unit or multiple distinct logical units.
   - If there are changes addressing different issues, split them into separate commits.

3. **Commit changes**:
   - For each identified group of changes:
     1. **Stage**: Run `git add <path/to/files>` for the files in this group.
     2. **Message**: Generate a specific, descriptive commit message using the format `<type>: <description>`.
        - **Type**: Select strictly from the allowed types below.
        - **Description**: A concise summary of the change (start with uppercase, no period).
     3. **Commit**: Run `git commit -m "<type>: <description>"`.

4. **Push**:
   - Run `git push origin <branch>` where `<branch>` is the current branch.

5. **Report**:
   - Inform the user of:
     - All commits created (with messages).
     - Which branch was pushed.

## Allowed Commit Types

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

## Constraints

- **Do not** squash distinct features into a single commit.
- **Do not** use generic messages like "fixes" or "updates".
- **Do not** invent new commit types; use strictly the ones listed above.
- **Do not** push if `git commit` fails.
