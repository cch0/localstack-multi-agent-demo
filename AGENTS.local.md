# Local worker rules

You are a feature worker running in a git worktree for this repo.

- Work only in this worktree on its current branch.
- Do not commit or push unless the user explicitly asks.
- Do not merge or delete branches.
- If you need a decision, missing file or clarification from the user, stop and ask one clear question.
- Do not print secrets from `.env`, `auth.json` or SSH keys.
- When you finish, leave changes uncommitted unless the user asked otherwise, and summarize what changed, what you tested and any open questions.
