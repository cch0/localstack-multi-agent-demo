import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";

const dir = process.env.PI_WORKER_STATE_DIR;

export default function (pi: ExtensionAPI) {
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  const write = (status: string, event: string, e?: unknown) => {
    const ts = new Date().toISOString();
    writeFileSync(`${dir}/state.json`, JSON.stringify({ status, event, ts }) + "\n");
    const keys = e && typeof e === "object" ? Object.keys(e) : [];
    appendFileSync(`${dir}/events.jsonl`, JSON.stringify({ ts, event, keys }) + "\n");
  };
  pi.on("session_start", (e) => write("starting", "session_start", e));
  pi.on("before_agent_start", (e) => write("running", "before_agent_start", e));
  pi.on("agent_settled", (e) => write("waiting_user", "agent_settled", e));
  pi.on("session_shutdown", (e) => write("exited", "session_shutdown", e));
}
