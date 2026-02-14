---
name: git-helpers
description: Git workflow helpers. Use when the user asks to push code to remote or merge to another branch. Supports intelligent commit grouping, push to remote, and branch merging.
---

# Git Helpers

## Push to Remote

### Goal

To intelligently manage the version control process by grouping uncommitted changes into logical commits and pushing them to the remote repository.

### Instructions

1.  **Analyze Repository Status**:
    - Run `git status` and `git diff` to identify all uncommitted changes.

2.  **Group Changes**:
    - Analyze the changed files in the context of recent work.
    - Determine if changes belong to a single logical unit or multiple distinct logical units.
    - **Multiple Units**: If there are changes addressing different issues, split them into separate commits.

3.  **Commit Changes**:
    - For each identified group of changes:
      1.  **Stage**: Run `git add <path/to/files>` for the files in this group.
      2.  **Message**: Generate a specific, descriptive commit message using the format `<type>: <description>`.
          - **Type**: Select strictly from the **Allowed Types** table below.
          - **Description**: A concise summary of the change (start with uppercase, no period).
      3.  **Commit**: Run `git commit -m "<type>: <description>"`.

4.  **Push**:
    - Once all groups are committed, run `git push origin <branch>`.
    - If merging to another branch (e.g., main), follow the merge workflow.

5.  **Report**:
    - Inform the user of:
      - All commits created (with messages).
      - Which branch was pushed.

---

## Merge to Branch

### Goal

To merge the current branch into a target branch, optionally push to remote, and return to the original branch.

### Trigger Phrases

| User says                    | Action                                        |
| ---------------------------- | --------------------------------------------- |
| `merge to <branch>`          | Merge current branch into target branch       |
| `merge to <branch> and push` | Merge, push target branch, return to original |

### Instructions

1.  **Capture Current State**:
    - Run `git branch --show-current` to store the current branch name (e.g., `feature-xyz`).
    - Run `git status` to ensure there are no uncommitted changes. If there are:
      - Ask the user whether to commit them first (using the Push to Remote workflow) or stash them.

2.  **Switch to Target Branch**:
    - Run `git checkout <target-branch>` (e.g., `git checkout main`).
    - Run `git pull` to ensure the target branch is up to date.

3.  **Merge**:
    - Run `git merge <original-branch>` (e.g., `git merge feature-xyz`).
    - If there are merge conflicts:
      - Report the conflicting files to the user.
      - Ask the user how to proceed (resolve manually, abort, etc.).
      - Do NOT continue until conflicts are resolved.

4.  **Push (if requested)**:
    - If the user said "and push":
      - Run `git push` to push the target branch to remote.

5.  **Return to Original Branch**:
    - If "and push" was requested, run `git checkout <original-branch>` to return to the starting branch.
    - If only "merge to" was requested (no push), stay on target branch.

6.  **Report**:
    - Inform the user:
      - Which branch was merged into which.
      - Whether the target branch was pushed.
      - Which branch they are currently on.

---

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
- **Do not** proceed with merge if there are unresolved conflicts.
- **Always** return to the original branch after "merge and push".
