/**
 * Worker Watch Extension (central only)
 *
 * Watches ~/.pi-workers/<feature>/state.json for every worker and, when one
 * or more workers transition into "waiting_user" (finished or asking a
 * question), batches them into a single OS notification and a single
 * message injected into central's own chat, so central notices without
 * being asked and relays it to the user.
 *
 * Lives in ~/.pi/agent/extensions/, so pi auto-loads it in every session on
 * the Mac without needing an --extension flag. It only acts when
 * ~/.pi-workers exists, so it is harmless outside this workflow.
 *
 * Uses fs.watch's recursive option, which is native on macOS. This is
 * intended to run on the Mac (central), not inside a worker machine.
 */

import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const ROOT = path.join(os.homedir(), ".pi-workers");
const DEBOUNCE_MS = 2000;

function readStatus(stateFile: string): string | null {
	try {
		const raw = fs.readFileSync(stateFile, "utf-8").trim();
		if (!raw) return null;
		const firstLine = raw.split("\n")[0];
		const obj = JSON.parse(firstLine);
		return typeof obj.status === "string" ? obj.status : null;
	} catch {
		return null;
	}
}

function notifyMac(title: string, body: string): void {
	const esc = (s: string) => s.replace(/"/g, '\\"');
	execFile(
		"osascript",
		["-e", `display notification "${esc(body)}" with title "${esc(title)}"`],
		() => {},
	);
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (!fs.existsSync(ROOT)) return;

		const lastStatus = new Map<string, string>();
		const pending = new Map<string, { status: string; ts: string }>();
		let timer: ReturnType<typeof setTimeout> | null = null;
		let stale = false;

		// Baseline: record existing statuses without alerting, so central only
		// reacts to transitions that happen after it starts watching.
		for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const status = readStatus(path.join(ROOT, entry.name, "state.json"));
			if (status) lastStatus.set(entry.name, status);
		}

		const fire = () => {
			timer = null;
			if (pending.size === 0) return;
			const lines = [...pending.entries()].map(
				([feature, { status }]) => `- ${feature} (${status})`,
			);
			const count = lines.length;
			pending.clear();

			notifyMac("Pi workers", `${count} worker(s) waiting for you`);

			// ctx can go stale between when this timer was scheduled and when it
			// fires, if the session was replaced or reloaded in the meantime
			// (ctx.newSession(), ctx.fork(), ctx.switchSession(), ctx.reload()).
			// Accessing a stale ctx throws, so guard it and don't let a UI toast
			// crash the process; the OS notification above and the sendMessage
			// below don't depend on this ctx and still get through.
			if (!stale) {
				try {
					if (ctx.hasUI) ctx.ui.notify(`${count} worker(s) waiting for you`, "info");
				} catch {
					stale = true;
				}
			}

			pi.sendMessage(
				{
					customType: "worker-watch",
					content: `Worker status update — ${count} worker(s) now waiting for you:\n${lines.join("\n")}\nPeek at each and relay to the user one at a time, waiting for the user's answer before moving to the next.`,
					display: true,
				},
				{ triggerTurn: true },
			);
		};

		fs.watch(ROOT, { recursive: true }, (_eventType, filename) => {
			if (!filename || !filename.endsWith("state.json")) return;
			const feature = filename.split(path.sep)[0];
			if (!feature) return;
			const status = readStatus(path.join(ROOT, filename));
			if (!status) return;
			if (lastStatus.get(feature) === status) return;
			lastStatus.set(feature, status);

			if (status === "waiting_user") {
				pending.set(feature, { status, ts: new Date().toISOString() });
				if (timer) clearTimeout(timer);
				timer = setTimeout(fire, DEBOUNCE_MS);
			}
		});

		// session_shutdown can fire before a pending timer does (session
		// replacement, reload, or process exit); stop touching ctx once that
		// happens, for the same reason as above.
		pi.on("session_shutdown", () => {
			stale = true;
		});

		if (ctx.hasUI) ctx.ui.notify(`Watching workers in ${ROOT}`, "info");
	});
}
