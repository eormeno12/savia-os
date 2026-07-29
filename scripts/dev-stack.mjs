#!/usr/bin/env node
/**
 * Local dev stack launcher.
 *
 * Runs the API services (api + ingest worker + mcp, NestJS `--watch`) and the
 * Next.js app as TWO separate process groups instead of one combined turbo run.
 *
 * Why: on macOS, running all four file-watchers under a single turbo invocation
 * exhausts the kernel's watcher limit → Turbopack throws EMFILE and the app
 * serves 404 on every route (empty route manifest). Splitting the app into its
 * own process keeps each watcher set under the limit. See memory:dev-stack-startup.
 *
 * Both children share this process's stdio; Ctrl-C (SIGINT/SIGTERM) tears down
 * both, and if either exits the whole stack stops.
 */
import { spawn } from "node:child_process";

const children = [];
let shuttingDown = false;

function run(label, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.log(`\n[dev:stack] "${label}" salió (code=${code ?? signal}). Deteniendo el stack…`);
    shutdown(code ?? 1);
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    if (!c.killed) c.kill("SIGTERM");
  }
  // Give children a moment to exit, then force-exit the launcher.
  setTimeout(() => process.exit(code), 800);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// Legacy API stack: api + ingest worker + mcp (NestJS watch mode), via turbo.
run("legacy-api-stack", "pnpm", [
  "exec",
  "turbo",
  "run",
  "dev",
  "worker:dev",
  "mcp:dev",
  "--filter=@savia-os/legacy-api",
]);

// App: its own process so Turbopack's watcher doesn't compete with the Nest
// watchers for the kernel watcher limit. Polling is a belt-and-suspenders guard.
run("legacy-app", "pnpm", ["--filter", "@savia-os/legacy-app", "dev"], {
  WATCHPACK_POLLING: "true",
});
