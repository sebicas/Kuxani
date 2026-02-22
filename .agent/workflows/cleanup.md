---
description: Post-merge cleanup — checkout target branch, pull changes, list merged PRs, and delete local branches that have been merged
---

# Post-Merge Cleanup

// turbo-all

## Steps

1. **Verify the PR has been merged on GitHub**:
   - Run:
     ```bash
     gh pr list --base main --head development --state merged --limit 1 --json number,title,mergedAt
     ```
   - If the output is empty (no merged PR found), also check for any **open** PR:
     ```bash
     gh pr list --base main --head development --state open --limit 1 --json number,title,state
     ```
   - **If an open PR exists**: Stop and inform the user that the PR has not been merged yet. Do NOT proceed with cleanup.
   - **If no PR exists at all (open or merged)**: Inform the user and ask if they still want to proceed with cleanup.
   - **If a merged PR is found**: Report the PR number and title, then continue.

2. **Checkout the target branch**:
   - If the user specifies a branch, use that. **Default**: `development`.
   - Run:
     ```bash
     git checkout <target-branch>
     ```

3. **Pull latest changes from origin**:
   - Run:
     ```bash
     git pull origin <target-branch>
     ```

4. **Sync `development` with `main`** (fast-forward to include the merge commit):
   - Run:
     ```bash
     git checkout main
     git pull origin main
     git checkout development
     git merge main
     git push origin development
     ```
   - This ensures `development` includes the merge commit created by the PR and both branches are in sync.

5. **Checkout the target branch again** (if it wasn't `development`):
   - Run:
     ```bash
     git checkout <target-branch>
     ```

6. **List recently merged PRs**:
   - Run:
     ```bash
     gh pr list --base <target-branch> --state merged --limit 10
     ```
   - Report the merged PRs to the user.

7. **Identify local branches that have been merged**:
   - Run:
     ```bash
     git branch --merged
     ```
   - Filter out `main`, `development`, and the current branch — these should never be deleted.

8. **Delete merged local branches**:
   - For each merged branch (excluding `main`, `development`, and current branch):
     - Run:
       ```bash
       git branch -d <branch-name>
       ```

9. **Prune stale remote tracking branches**:
   - Run:
     ```bash
     git remote prune origin
     ```

10. **Report**:
    - Inform the user:
      - Which branch they are on.
      - Recently merged PRs.
      - Which local branches were deleted.
      - Which branches were kept (if any besides main/development).
