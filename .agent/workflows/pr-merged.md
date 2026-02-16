---
description: Post-merge cleanup — checkout target branch, pull changes, list merged PRs, and delete local branches that have been merged
---

# PR Merged Cleanup

## Steps

1. **Checkout the target branch**:
   - If the user specifies a branch, use that. **Default**: `development`.
     // turbo
   - Run:
     ```bash
     git checkout <target-branch>
     ```

2. **Pull latest changes from origin**:
   // turbo
   - Run:
     ```bash
     git pull origin <target-branch>
     ```

3. **List recently merged PRs**:
   // turbo
   - Run:
     ```bash
     gh pr list --base <target-branch> --state merged --limit 10
     ```
   - Report the merged PRs to the user.

4. **Identify local branches that have been merged**:
   // turbo
   - Run:
     ```bash
     git branch --merged
     ```
   - Filter out `main`, `development`, and the current branch — these should never be deleted.

5. **Delete merged local branches**:
   - For each merged branch (excluding `main`, `development`, and current branch):
     - Run:
       ```bash
       git branch -d <branch-name>
       ```

6. **Prune stale remote tracking branches**:
   // turbo
   - Run:
     ```bash
     git remote prune origin
     ```

7. **Report**:
   - Inform the user:
     - Which branch they are on
     - Recently merged PRs
     - Which local branches were deleted
     - Which branches were kept (if any besides main/development)
