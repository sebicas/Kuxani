---
description: Create a GitHub Pull Request from the current branch using the walkthrough as description
---

# Create a PR

## Steps

1. **Get the current branch**:
   // turbo
   - Run `git branch --show-current` to get the source branch name.
   - If the current branch is `main` or `development`, STOP and warn the user — do not create a PR from these branches.

2. **Determine the PR type**:
   - Ask the user (or infer from the branch name) what type of PR this is. Common types:
     - `Feature` — new functionality
     - `Fix` — bug fix
     - `Refactor` — code restructuring
     - `Chore` — tooling, deps, build
     - `Docs` — documentation only
     - `Test` — adding/correcting tests
     - `Perf` — performance improvement

3. **Build the PR title**:
   - Read the **walkthrough.md** artifact from the current conversation's brain directory (`<appDataDir>/brain/<conversation-id>/walkthrough.md`).
   - If no walkthrough exists, STOP and ask the user to describe the changes first.
   - Extract the **title** from the first `# Heading` in the walkthrough (strip the `# ` prefix and any trailing ` — Walkthrough` suffix).
   - Build the PR title as: `<Type> : <Title>`
     - Example: `Feature : AI Context Enrichment`

4. **Determine the target branch**:
   - If the user specifies a target branch, use that.
   - **Default**: `development`

5. **Create the PR**:
   - Use the **entire walkthrough content** as the PR body/description (in markdown).
   - Strip any `file:///` links from the body since they won't work on GitHub.
     // turbo
   - Run:
     ```bash
     gh pr create --base <target-branch> --head <current-branch> --title "<Type> : <Title>" --body '<walkthrough content>'
     ```

6. **Switch to the target branch**:
   // turbo
   - Run:
     ```bash
     git checkout <target-branch>
     ```

7. **Report**:
   - Inform the user:
     - PR title and link
     - Source branch → target branch
     - Confirm they are now on the target branch
