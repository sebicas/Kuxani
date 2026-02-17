---
description: Post-merge cleanup — checkout target branch, pull changes, list merged PRs, and delete local branches that have been merged
---

# Post-Merge Cleanup

// turbo-all

## Steps

1. **Checkout the target branch**:
   - If the user specifies a branch, use that. **Default**: `development`.
   - Run:
     ```bash
     git checkout <target-branch>
     ```

2. **Pull latest changes from origin**:
   - Run:
     ```bash
     git pull origin <target-branch>
     ```

3. **Sync `development` with `main`** (fast-forward to include the merge commit):
   - Run:
     ```bash
     git checkout main
     git pull origin main
     git checkout development
     git merge main
     git push origin development
     ```
   - This ensures `development` includes the merge commit created by the PR and both branches are in sync.

4. **Checkout the target branch again** (if it wasn't `development`):
   - Run:
     ```bash
     git checkout <target-branch>
     ```

5. **List recently merged PRs**:
   - Run:
     ```bash
     gh pr list --base <target-branch> --state merged --limit 10
     ```
   - Report the merged PRs to the user.

6. **Identify local branches that have been merged**:
   - Run:
     ```bash
     git branch --merged
     ```
   - Filter out `main`, `development`, and the current branch — these should never be deleted.

7. **Delete merged local branches**:
   - For each merged branch (excluding `main`, `development`, and current branch):
     - Run:
       ```bash
       git branch -d <branch-name>
       ```

8. **Prune stale remote tracking branches**:
   - Run:
     ```bash
     git remote prune origin
     ```

9. **Report**:
   - Inform the user:
     - Which branch they are on.
     - Recently merged PRs.
     - Which local branches were deleted.
     - Which branches were kept (if any besides main/development).
