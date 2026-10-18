# localstack-multi-agent-demo

A minimal Docker Compose stack used as a working example for
[`local-stack-multi-agents.md`](./local-stack-multi-agents.md) — a pattern
for running several pi coding agents in parallel, each in its own OrbStack
Linux machine, against its own git worktree and Docker stack.

This repo's `.pi/feature-workers/copy-list` and
`.pi/feature-workers/worker-instructions.md` are the actual files referenced
as examples in that doc. A `make provision` step generates a local page,
then `docker compose up -d` serves it with nginx on port 8088. This exact
flow was run end-to-end through a pi worker on an OrbStack machine and
verified reachable at `http://<machine>.orb.local:8088`.

`tooling/` holds the real, installable source for the global tooling the doc
describes (the `feature-workers` skill and scripts, and the `status-ext.ts`
and `worker-watch.ts` extensions) — the doc installs these by copying them
from here, not by regenerating them from embedded shell heredocs.

## Try it

```
make provision
docker compose up -d
curl localhost:8088
```
