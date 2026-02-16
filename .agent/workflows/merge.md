---
description: Merge the current branch into a target branch, optionally push, and return to the original branch
---

# Merge to Branch

## Steps

1. **Capture current state**:
   // turbo
   - Run `git branch --show-current` to store the current branch name.
   - Run `git status` to ensure there are no uncommitted changes.
   - If there are uncommitted changes, ask the user whether to commit them first (using `/push`) or stash them. Do NOT continue until resolved.

2. **Determine the target branch**:
   - If the user specifies a target branch (e.g., `merge to main`), use that.
   - **Default**: `development`

3. **Determine if push is requested**:
   - If the user says "and push" (e.g., `merge to main and push`), note that the target branch should be pushed after merging.

4. **Switch to target branch**:
   // turbo
   - Run `git checkout <target-branch>`.
   - Run `git pull` to ensure the target branch is up to date.

5. **Merge**:
   - Run `git merge <original-branch>`.
   - If there are merge conflicts:
     - Report the conflicting files to the user.
     - Ask the user how to proceed (resolve manually, abort, etc.).
     - Do NOT continue until conflicts are resolved.

6. **Push (if requested)**:
   // turbo
   - If the user requested push, run `git push` to push the target branch to remote.

7. **Return to original branch**:
   // turbo
   - If push was requested, run `git checkout <original-branch>` to return to the starting branch.
   - If only merge was requested (no push), stay on the target branch.

8. **Report**:
   - Inform the user:
     - Which branch was merged into which.
     - Whether the target branch was pushed.
     - Which branch they are currently on.
