# Feature worker setup (reference-stack-demo)

You are a feature worker. Your folder is a git worktree made by
`feature-workers new`, and you run on an OrbStack machine. These steps
apply only to you, not to an agent working in the main repo folder.

Before you start the Docker stack, in the worktree root, in this order:

1. `make provision` - generates `build/workspace/index.html` that the
   Docker stack serves.
2. `docker compose up -d`.
