---
name: feature-workers
description: Dispatch features or bug fixes to worker pi agents, each in its own OrbStack Linux machine with its own git worktree and Docker stack. Use when the user wants parallel work on several features or fixes, or asks to check on, message, or clean up workers.
---

# Feature workers

Each feature or bug fix gets a worker: a pi agent in an OrbStack Linux machine, on its own git worktree and branch, with its own Docker stack. You are the central agent. You dispatch work, watch progress, relay questions to the user, and clean up. Use the shell tool.

In the commands below, `feature-workers` means `~/.pi/agent/skills/feature-workers/scripts/feature-workers`, and `feature-workers-bootstrap` is the script next to it.

## Commands
- `feature-workers status`: workers (feature, machine, up/DOWN, state, last update) and machines.
- `feature-workers new <feature> <machine> [base-branch]`: create the worktree and branch and start the worker. Run it from inside the repo. The worker starts idle.
- `feature-workers send <feature> <text>`: send the worker a message.
- `feature-workers peek <feature> [lines]`: read the worker's screen (default 60 lines).
- `feature-workers rm <feature>`: dry run. `feature-workers rm <feature> --yes` stops the worker, runs `docker compose down -v`, and removes the worktree. The branch is kept.
- `feature-workers-bootstrap <machine>`: create the machine if missing and set it up. Takes several minutes.

States: `starting` (no task yet), `running`, `waiting_user` (idle: finished or asking), `exited`. `DOWN` means the worker's tmux session is gone.

## Rules
1. Before dispatching, run `feature-workers status`. A machine is free only if no worker uses it. Ask the user to confirm before reusing a free machine, since they may still need it. If none is free, ask before creating one with `feature-workers-bootstrap`. Skip the question if the user's own message already named the specific machine to reuse or create; state what you're about to do and proceed.
2. Never run `feature-workers rm --yes`, `orb delete`, `git worktree remove` or `git branch -D` without the user's explicit confirmation. Show the dry run first — unless the user's own message already named the specific feature/machine/branch to delete and explicitly asked for the deletion itself (not just mentioned it), in which case state what you're about to do and proceed.
3. Do not merge branches. Report the branch name and let the user decide.
4. Never print or copy `auth.json`, `.env` files or SSH keys.
5. A worker must not commit or push in its worktree unless the user explicitly asks for it. Finishing a task is not permission to commit or push.

## Dispatch
1. Run `feature-workers new <feature> <machine>` from the repo directory.
2. Wait about 10 seconds, then run `feature-workers send <feature> "<task>"` with this message:
   Work on <task> in this folder on branch <branch>. If you need the Docker stack, run `docker compose up -d` here; it is reachable at http://<machine>.orb.local:<port>. Do not commit or push unless the user explicitly asks you to; leave changes uncommitted in the worktree otherwise. Do not merge or delete branches. If you need a decision from the user, stop and ask one clear question.
3. Tell the user the feature, machine and branch.

## Monitor
- When the user asks for progress, and after dispatching, run `feature-workers status`.
- If a message with `customType: "worker-watch"` arrives (from the `worker-watch.ts` extension), it lists one or more workers that just became `waiting_user`. Peek at each listed worker in order, relay it to the user, and wait for the user's answer before moving to the next one. Do not report all of them in one breath.
- For a worker in `waiting_user`, run `feature-workers peek <feature> 80` and summarize its last message. If it asks a question, pass it to the user in plain words and send their answer with `feature-workers send`.
- For a worker that stays `running` a long time, peek and report what it is doing.
- For `DOWN` or `exited`, peek, report, and ask the user what to do.

## Clean up
When the user says a feature is done, run `feature-workers rm <feature>`, show the output, and run with `--yes` only after the user confirms.

## Untracked files
`feature-workers new` copies the files listed in `<repo>/.pi/feature-workers/copy-list` (one relative path per line, for example `.env`) from the main repo into the new worktree when they exist there and are missing in the worktree. If the repo has no such file, nothing is copied. It also copies `<repo>/.pi/feature-workers/worker-instructions.md` to `<worktree>/.pi/APPEND_SYSTEM.md`, if that file exists and the target does not. Pi adds that file to the worker's system prompt. Tell the user which files were copied.
