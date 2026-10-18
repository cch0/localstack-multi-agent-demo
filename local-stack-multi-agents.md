# Parallel Feature Workers on OrbStack

Oct 11, 2026 · @cch

A central pi session on the Mac provisions one OrbStack Linux machine per feature, and each machine runs its own pi worker in tmux against a git worktree.

## If you are an agent reading this

Set up the system described here for the user, in the order of the sections: Prepare the Mac, Start the central agent, Install the worker tooling, Set up the repo, Set up a machine.

- Ask the user for permission before each of these actions. Tell the user what the action does. Wait for a clear "yes". Do not ask again if the user's own message already explicitly named this action and its target (for example, they already said which machine to create, or which worktree/branch/machine to delete, and asked for it to happen) — in that case, state what you're about to do and proceed. Only re-ask when the user's request leaves the target or action ambiguous.
  - Installing software on the Mac.
  - Writing files outside the repo.
  - Writing files in the repo's `.pi/` folder or in `.git/info/exclude`.
  - Creating a machine. This includes running `feature-workers-bootstrap`.
  - Deleting a machine, a worktree or a branch.
- A value the user gives you, such as a machine name prefix, is not permission to act.
- Verify every prerequisite yourself, one by one, before treating a step as done. Never assume a step is already satisfied because an earlier session, this doc, or the user said so. For each step: run the actual check (file exists, command exits 0, process is running, version prints) and show the result. If a check fails or a file is missing, say so and fix it before moving to the next step. Do not skip a step, and do not skip a check, for any reason.
- If a file you must write already exists, show the user the difference and ask before you replace it. Never overwrite a file on your own. Do not skip a step because its files exist. Compare them first.
- Run other shell steps yourself. For steps only the user can do (installing OrbStack, logging in to GitHub Copilot in pi, starting the `central` tmux session, restarting pi), tell the user exactly what to do and wait for confirmation before continuing. A restart to reload skills or extensions does not lose the conversation: quit with `/quit`, then start pi again with `pi --continue` (or `-c`), which resumes the same session's full history. Only extensions and skills are reloaded; tell the user this explicitly so they don't mistake a reload for losing context.
- Before writing any script, ask the user for these values: the repo folder, the SSH host alias for git (`GIT_ALIAS_HOST`, or none), the SSH key for git (`GIT_KEY`), the model provider and model id (`MODEL_PROVIDER`, `MODEL_ID`), and the machine name prefix (for example `worker`). Name machines `<prefix>-1`, `<prefix>-2` and so on.
- To find `GIT_KEY`, list the files in `~/.ssh`. Print only file names. Never print key contents. Run `ssh -o BatchMode=yes -vT git@github.com` and read which key GitHub accepts. Show the user the key files you found and the key GitHub accepted. Ask the user to confirm which key to use. Do not choose a key yourself.
- Do not print or copy `auth.json`, `.env` files or SSH keys, except the copy that the bootstrap script does for the key the user confirmed.
- Items under "Open" in the last section are untested. Do not report them as working.
- After setup, run the checks under "Verified" that apply and report the results.

## Architecture

- The central pi agent runs on the Mac inside a tmux session named `central`. It keeps running after the terminal is closed.
- Each worker is a pi agent running in a tmux session (named after the feature) inside its own OrbStack Linux machine.
- Each feature has a git worktree on the Mac, in a sibling folder `<repo>-<feature>`. Mac files appear at the same paths inside the machines, so nothing is cloned or mounted. git-lfs is installed in each machine.
- Each machine has its own Docker daemon, so default ports, container names and volumes do not conflict between features.
- A stack is reached from the Mac at `http://<machine>.orb.local:<port>`. No proxy is used.
- Status: a pi extension in the worker writes `~/.pi-workers/<feature>/state.json` and `events.jsonl`. The folder is shared between the Mac and the machine.
- Control: `feature-workers peek` and `feature-workers send` run `orb -m <machine> tmux ...` to read the worker screen and type into it.
- A worker question shows as state `waiting_user`. A pi extension on the Mac (`worker-watch.ts`) watches the state files and alerts central. Central reads the screen and relays the question to you.
- Rules for workers: keep every worker rule that must survive a rebuild in this repo. `feature-workers new` copies the repo's `AGENTS.local.md` when it is listed in the copy list, and copies `.pi/feature-workers/worker-instructions.md` to `<worktree>/.pi/APPEND_SYSTEM.md`. Put commit/push limits, question-asking rules and repo setup steps there. Do not rely on external global `AGENTS.md` or skills.
- Alerts: `worker-watch.ts` runs in every pi session on the Mac. It acts only when `~/.pi-workers` exists. When a worker changes to `waiting_user`, it starts a 2-second timer. Each new change restarts the timer. When the timer ends, it sends one macOS notification and one message to central, which lists all waiting workers. Central then relays them one at a time.
- Approvals: central asks you before reusing a machine, creating a machine, or deleting a worktree, machine or branch.
- Files are not isolated. pi has no per-tool approval prompts, and the machines can read and write the Mac home folder.

## Design decisions

| Decision | Reason |
| --- | --- |
| One OrbStack machine per feature | Each machine has its own Docker daemon, so default ports, container names and volumes do not conflict between features. |
| One git worktree per feature, on the Mac | A separate branch per worker avoids collisions. Mac files appear at the same paths inside machines, so nothing is cloned or mounted. |
| Reach stacks at `<machine>.orb.local:<port>` | Each machine has its own hostname, so identical ports need no reverse proxy. Traefik is avoided. |
| Central agent runs in tmux on the Mac | The session keeps running after the terminal is closed. Re-attach with `tmux attach -t central`. |
| Workers run in tmux inside the machines | Central can read a worker's screen and type into it through `orb`. |
| Status through files written by a pi extension | Central reads `state.json` from a folder shared between the Mac and the machine. |
| Alert extension auto-loaded from `~/.pi/agent/extensions/` | Central then needs no `--extension` flag. The extension does nothing when `~/.pi-workers` is missing. |
| One batched alert, with a 2-second wait | Several workers can wait at the same time. One message avoids overlapping turns in central. |
| Repo-specific files in the repo's root and `.pi/`, tooling kept global | The tooling knows no repo. `AGENTS.local.md` and the copy-list live at the repo root and in `.pi/`; `.pi/` stays untracked through `.git/info/exclude`. |
| Central asks before reusing or creating a machine | A free-looking machine may still be needed by the user. |
| Deletes only after user confirmation | Worktrees, machines and branches are not removed automatically. |
| Workers default to Sonnet 5 through GitHub Copilot | Set in each machine's pi `settings.json` by the bootstrap script. |

## Prepare the Mac

1. Install OrbStack and pi. Log in to GitHub Copilot in pi (`/login`).
2. Install tmux and git-lfs: `brew install tmux git-lfs`, then `git lfs install`.
3. Write the tmux config:

```
printf 'set -g extended-keys on\nset -g extended-keys-format csi-u\n' > ~/.tmux.conf
```

If `tmux -V` shows a version below 3.5, remove the second line.

4. The repo's git remote must work from inside a machine. If the remote uses an SSH host alias (for example `github-alias`), set `GIT_ALIAS_HOST` in `feature-workers-bootstrap` to that alias. If the remote uses `github.com`, set `GIT_ALIAS_HOST` to an empty string.
5. Choose the SSH key for git. List the key files in `~/.ssh` (names only). Run `ssh -o BatchMode=yes -vT git@github.com` to see which key GitHub accepts. Confirm the choice with the user, then set `GIT_KEY` in `feature-workers-bootstrap` to that path. OrbStack can already link Mac keys into a machine. The bootstrap script copies the key only if it is missing there.

## Start the central agent

1. In a terminal: `tmux new-session -s central -c <repo folder>`, then run `pi` inside it.
2. Detach with Ctrl-b then d (Control key, not Command). The agent keeps running.
3. Re-attach with `tmux attach -t central`.
4. Run shell commands (`feature-workers`, `orb`) in a separate terminal, not inside the central pi screen.
5. To reload skills or extensions (for example after "Install the worker tooling" below) without losing the conversation: `/quit`, then `pi --continue` (or `-c`) in the same folder. This resumes the same session's full history; only extensions and skills are reloaded. Plain `pi` would start a new, empty session instead — use `--continue`.
6. To stop the central agent for good, exit pi inside the session first (`/quit`), then delete the session: `tmux kill-session -t central`. Killing the session without quitting pi first still ends the agent, but does not give it a chance to shut down cleanly.

## Install the worker tooling

Run these on the Mac. Paths under `~/.pi-workers` are visible inside the machines at the same location. The source for every file below lives in this repo under `tooling/`, not only in this doc — read, diff, or edit it there directly.

1. Create the folders.

```bash
mkdir -p ~/.pi-workers ~/.pi/agent/skills/feature-workers/scripts ~/.pi/agent/extensions
```

2. Install each file below the same way: copy it from this repo's `tooling/` folder to its destination, but only after checking whether a different version is already there.

```bash
ROOT="$(git rev-parse --show-toplevel)/tooling"
install() {
  SRC="$ROOT/$1"; DST="$2"
  if [ -e "$DST" ] && ! diff -q "$SRC" "$DST" >/dev/null 2>&1; then
    diff "$DST" "$SRC"; echo "$DST differs from the repo's copy; ask the user before overwriting"
  elif [ ! -e "$DST" ]; then
    mkdir -p "$(dirname "$DST")"; cp "$SRC" "$DST"; echo "installed $DST"
  else
    echo "$DST already matches the repo's copy; nothing to do"
  fi
}

install extensions/status-ext.ts            "$HOME/.pi-workers/status-ext.ts"
install extensions/worker-watch.ts          "$HOME/.pi/agent/extensions/worker-watch.ts"
install scripts/feature-workers-bootstrap   "$HOME/.pi/agent/skills/feature-workers/scripts/feature-workers-bootstrap"
install scripts/feature-workers             "$HOME/.pi/agent/skills/feature-workers/scripts/feature-workers"
install skills/feature-workers/SKILL.md     "$HOME/.pi/agent/skills/feature-workers/SKILL.md"

chmod +x "$HOME/.pi/agent/skills/feature-workers/scripts/feature-workers-bootstrap" "$HOME/.pi/agent/skills/feature-workers/scripts/feature-workers"
```

- `extensions/status-ext.ts`: runs inside a worker. It does nothing unless `PI_WORKER_STATE_DIR` is set, so it is harmless anywhere else, including central's own pi.
- `extensions/worker-watch.ts`: runs in every pi session on the Mac, central included. Pi loads every file in `~/.pi/agent/extensions/` on its own, so it needs no flag. It does nothing when `~/.pi-workers` is missing.
- `scripts/feature-workers-bootstrap`: edit `GIT_ALIAS_HOST`, `GIT_KEY`, `MODEL_PROVIDER` and `MODEL_ID` at the top of the installed copy for your setup, after confirming the values with the user (see "Prepare the Mac"). Do not edit the repo's copy for one user's setup; edit the installed copy at `~/.pi/agent/skills/feature-workers/scripts/feature-workers-bootstrap`.
- `scripts/feature-workers`: drives the machines through `orb`. Run `feature-workers new` from inside the repo you are dispatching features for (not from this tooling repo itself, unless that is the repo you are working on).
- `skills/feature-workers/SKILL.md`: tells the central agent how to use `feature-workers` and encodes the rules. Restart pi in `central` afterwards (`/quit`, then `pi --continue`) so it reloads skills and loads the alert extension, without losing the conversation.

Verify this step, don't assume it: before moving on, confirm each destination file above actually exists and matches the repo's copy. A missing `worker-watch.ts` is the most common reason central never alerts you about a waiting worker, and it won't surface until a worker actually asks something, so check it now rather than waiting to find out.

## Set up the repo

The tooling above is global and knows nothing about any repo. Settings that belong to one repo live in that repo.

1. Ask the user which untracked files each new worktree needs. List them, one relative path per line, in `<repo>/.pi/feature-workers/copy-list`. `feature-workers new` copies each file when it exists in the repo and is missing in the worktree. If the list is missing, nothing is copied.
2. Keep `.pi/` out of Git without changing a tracked file. Add it to `.git/info/exclude`.

```bash
mkdir -p <repo>/.pi/feature-workers
cat > <repo>/.pi/feature-workers/copy-list <<'EOF'
.env
docker-compose.override.yml
AGENTS.local.md
certs
EOF
grep -qxF '.pi/' <repo>/.git/info/exclude || printf '.pi/\n' >> <repo>/.git/info/exclude
```

Replace this example list with the actual untracked paths your repo needs. `AGENTS.local.md` lets each worker follow the repo's local agent rules. A path in a subfolder (for example `examples/requests/.env`) is a valid entry, because each entry is relative to the repo root. The copy is a snapshot: later edits to the main file do not reach existing worktrees. If the stack mounts a local, untracked data folder, list it too; the copy is a real copy, not a link, so size it accordingly. Do not copy a folder the stack regenerates on its own, such as build output, logs, or job data — call the step that creates it in `worker-instructions.md` instead.

Steps that need a command, not a copy, go in `<repo>/.pi/feature-workers/worker-instructions.md`. `feature-workers new` copies it to `<worktree>/.pi/APPEND_SYSTEM.md`, and pi adds it to the worker's system prompt. Workers start with `--approve`, which trusts project files for that run. An agent in the main repo folder never loads it, because the main repo has no `.pi/APPEND_SYSTEM.md`. For `localstack-multi-agent-demo`, keep the durable worker rules in `AGENTS.local.md`, copy that file into each worktree, and use `worker-instructions.md` for stack-specific setup: `make provision`, then `docker compose up -d`.

Write the file for this repo. Change the repo name and the steps for another repo.

```bash
cat > <repo>/AGENTS.local.md <<'EOF'
# Local worker rules

You are a feature worker running in a git worktree for this repo.

- Work only in this worktree on its current branch.
- Do not commit or push unless the user explicitly asks.
- Do not merge or delete branches.
- If you need a decision, missing file or clarification from the user, stop and ask one clear question.
- Do not print secrets from `.env`, `auth.json` or SSH keys.
- When you finish, leave changes uncommitted unless the user asked otherwise, and summarize what changed, what you tested and any open questions.
EOF

cat > <repo>/.pi/feature-workers/worker-instructions.md <<'EOF'
# Feature worker setup (localstack-multi-agent-demo)

You are a feature worker. Your folder is a git worktree made by
`feature-workers new`, and you run on an OrbStack machine. These steps apply
only to you, not to an agent that works in the main repo folder.

Follow `AGENTS.local.md` in this worktree for durable repo rules.

Before you start any Docker stack, do these steps in the worktree root, in this
order:

1. `make provision`. It creates local config/workspace files (for example
   under `build/workspace/`) that `docker-compose.yml` mounts. A new
   worktree has none. Each worktree must make its own. Do not copy or link
   another worktree's folder: the stack writes logs and job data into it.
2. `docker compose up -d`.

`make` and any other project build tools are installed on the machine.
`feature-workers new` already copied `.env`, `AGENTS.local.md`, and any other
paths listed in this repo's `copy-list`. If one is missing, ask the user. Do
not read or print `.env` values.
EOF
```

## Set up a machine

```bash
~/.pi/agent/skills/feature-workers/scripts/feature-workers-bootstrap <prefix>-1
```

It creates the machine if missing (Ubuntu), takes several minutes, and installs:

- tmux, Node, npm, Docker (docker.io) with compose v2, git-lfs, make, uv, and pi
- Docker access without sudo for the machine user
- the tmux config, an SSH config for git, and the git SSH key (copied only if missing)
- pi settings with the default model (Sonnet 5 via GitHub Copilot) and a copy of `~/.pi/agent/auth.json` from the Mac
- no repo-specific rules are installed here; workers get their rules from copied repo files in each worktree (`AGENTS.local.md` and `.pi/APPEND_SYSTEM.md`)

The last lines print tool versions and `docker ps`. If `docker ps` runs without sudo, the machine is ready.

Notes:

- Do not source the project's `.env` for pi credentials. It holds app variables, not pi provider keys.
- Each machine uses about 3 GB of disk.
- Copilot login worked from a copied `auth.json`. Token refresh across several machines is untested.

## Using it

Attach to central (`tmux attach -t central`) and ask in plain words, for example:

> Start a worker for feature "add-login-audit": log every login attempt. Check which machines are free first.

### Prompt template

Run this in the central agent's terminal, not in a regular pi session:

> Start a worker for feature "<feature-name>". Check which machines are free first.

Replace `<feature-name>` with your own value.

Central runs `feature-workers status`, asks you to confirm reusing a free machine (or creating one), and runs `feature-workers new`. The worker starts idle; send it a task afterward.

When a worker finishes or asks a question, you get a macOS notification. Central also gets a message and relays the waiting workers one at a time. You do not need to ask central to check.

**Commands** (central runs these; you can too)

| Command | What it does |
| --- | --- |
| `feature-workers status` | Workers (machine, up/DOWN, state, last update) and machines |
| `feature-workers new <feature> <machine> [base]` | Create worktree and branch, copy the files in the repo's `copy-list`, start the worker |
| `feature-workers send <feature> <text>` | Type a message into the worker |
| `feature-workers peek <feature> [lines]` | Read the worker's screen |
| `feature-workers rm <feature> [--yes]` | Dry run, or stop the worker and remove the worktree (branch kept) |

**States**

| State | Meaning |
| --- | --- |
| `starting` | Worker is up, no task yet |
| `running` | Working |
| `waiting_user` | Idle: finished, or asking a question |
| `exited` | pi quit |
| `DOWN` | The worker's tmux session is gone |

**Rules central follows**

- Asks before reusing a free machine and before creating one.
- Never deletes a worktree, machine or branch without your confirmation, and shows the dry run first.
- Does not merge branches.
- Relays waiting workers one at a time after a `worker-watch` alert, and waits for your answer before the next one.
- Never prints or copies `auth.json`, `.env` files or SSH keys.

**Watching a worker directly**

1. Find the machine name and the feature name: `feature-workers status`.
2. List the tmux sessions in the machine: `orb -m <machine> tmux ls`. The session name is the feature name.
3. Attach to the session to see the worker output as it works.

```bash
orb -m <machine> tmux attach -t <feature>
```

For example, to watch the worker on machine `<prefix>-1` for feature `<feature>`: `orb -m <prefix>-1 tmux attach -t <feature>`.

To look without a risk of typing into the worker, use `feature-workers peek <feature> [lines]`. It prints the screen one time. It does not attach.

Detach with Ctrl-b then d. Do not type `/quit` in the worker; that ends its pi session.

**Cleanup**

When a feature is done, tell central. It shows the `feature-workers rm` dry run and runs `--yes` only after you confirm. Deleting the branch or the machine is a separate confirmation.

## Verified and still open

**Verified**

- Bootstrap on a fresh machine.
- Docker without sudo; a container reached from the Mac by hostname (HTTP 200).
- Worktree plus git-lfs shows a clean `git status` inside a machine.
- `git ls-remote` through the SSH alias from a machine.
- Extension events (`session_start`, `before_agent_start`, `agent_settled`) write `state.json` and `events.jsonl` to the shared folder.
- `feature-workers new`, `status`, `send`, `peek`, `rm`.
- The full central loop: dispatch, a worker question relayed to the user, the answer sent back, cleanup.

**Open**

- A real `git push` from a worker is untested (a `git push --dry-run` is the proposed first check).
- The repo `copy-list` copy in `feature-workers new` is untested.
- Worker-to-worker knowledge sharing is not built.
- The `worker-watch` alert is untested with a real worker question.
- Worker use of the copied `AGENTS.local.md` and the copied `.pi/APPEND_SYSTEM.md` is untested. No pi worker has been started to check that pi loads them.
- The copy of `worker-instructions.md` to `.pi/APPEND_SYSTEM.md`, and pi loading it in a worker, are untested.
- The bootstrap with `make` and `uv` is untested. `make provision` inside a machine is untested, and its run time is unknown.
- The `data/` entries in the copy list were tested only by a simulated copy, not by a real `feature-workers new`.
- Central handles one worker question at a time. This limit is accepted and not addressed.
- Many machines at once use much Mac CPU, memory and disk. This hardware limit is accepted and not addressed.
- Behavior when the Mac sleeps is untested.
- Copilot login across several machines (token refresh) is untested.
- A dead worker (`DOWN`) is visible only through `feature-workers status`.
- Workers have full access to the Mac home folder.
- A real feature compose stack inside a worker has not been run through a full task.

## Reference

**Where things live**

| Item | Location | Source in this repo |
| --- | --- | --- |
| Skill and scripts | `~/.pi/agent/skills/feature-workers/` (`SKILL.md`, `scripts/feature-workers`, `scripts/feature-workers-bootstrap`) | `tooling/skills/feature-workers/SKILL.md`, `tooling/scripts/feature-workers`, `tooling/scripts/feature-workers-bootstrap` |
| Status extension (workers) | `~/.pi-workers/status-ext.ts` | `tooling/extensions/status-ext.ts` |
| Alert extension (central) | `~/.pi/agent/extensions/worker-watch.ts` | `tooling/extensions/worker-watch.ts` |
| Files copied into new worktrees | `<repo>/.pi/feature-workers/copy-list` | (per-repo, not in this tooling repo) |
| Per-feature state | `~/.pi-workers/<feature>/` (`meta`, `state.json`, `events.jsonl`) | n/a (generated) |
| Worktree | `<repo folder>-<feature>` | n/a (generated) |
| Worker pi config in a machine | `~/.pi/agent/settings.json`, `~/.pi/agent/auth.json` | n/a (generated by the bootstrap script) |

**Troubleshooting**

| Symptom | Cause and fix |
| --- | --- |
| pi in a worker shows "No models available" | No provider credentials in the machine. The bootstrap script copies `auth.json`; check that `~/.pi/agent/auth.json` exists on the Mac and re-run it. |
| `git status` in a machine lists modified `.csv` or `.parquet` files | git-lfs is missing in the machine. Install it and run `git lfs install`. |
| `Could not resolve hostname <alias>` in a machine | The SSH host alias exists only on the Mac. The bootstrap script writes it to the machine's `~/.ssh/config`. |
| tmux warns about extended keys | The machine's `~/.tmux.conf` is missing. Write it and restart the tmux server. |
| `docker compose` fails because `.env` is missing | `.env` is untracked, so a new worktree lacks it. List it in `<repo>/.pi/feature-workers/copy-list` before running `feature-workers new`. |
| Central gives no alert when a worker waits | Check whether `~/.pi/agent/extensions/worker-watch.ts` exists at all — it is not installed automatically, only by the "Install the worker tooling" step. If missing, copy it from this repo's `tooling/extensions/worker-watch.ts` and restart pi in `central` (`/quit`, then `pi --continue` — this does not lose the conversation, only reloads extensions). If it exists, pi in `central` may have started before it did, or `~/.pi-workers` was missing at start; restart pi in `central` either way. |
| `feature-workers status` shows `DOWN` | The worker's tmux session is gone. Peek at the machine, then decide whether to restart the worker. |
| Central pi crashes with `uncaughtException: ... ctx is stale after session replacement or reload` naming `worker-watch.ts` | A pending alert timer fired after the session was replaced or reloaded (for example by `pi --continue`), and the extension tried to use its stale captured `ctx`. Fixed in this repo's `tooling/extensions/worker-watch.ts`, which guards that access; reinstall it from there if your copy predates the fix. |

## Sources

- [OrbStack docs: Linux machines, file sharing, networking, Docker](https://docs.orbstack.dev)
- [pi docs: skills, providers, settings, models, extensions, security, tmux, RPC](https://pi.dev/docs/latest)
- [Agent Skills specification](https://agentskills.io)
- [pi-side-agents](https://github.com/pi-dev/pi-side-agents) and its architecture notes
