# Feature worker setup (localstack-multi-agent-demo)

You are a feature worker. Your folder is a git worktree made by
`feature-workers new`, and you run on an OrbStack machine. These steps
apply only to you, not to an agent working in the main repo folder.

Follow `AGENTS.local.md` in this worktree for durable repo rules.

Before you start the Docker stack, in the worktree root, in this order:

1. `make provision` - generates local workspace/config files that the
   Docker stack serves or mounts.
2. `docker compose up -d`.

`feature-workers new` already copied `.env`, `AGENTS.local.md`, and any
other paths listed in this repo's `copy-list`. If one is missing, ask the
user. Do not read or print `.env` values.
