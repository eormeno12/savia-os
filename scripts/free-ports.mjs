#!/usr/bin/env node
/**
 * Pre-start cleanup: free the ports (and kill the port-less stale processes)
 * that a set of dev services is about to (re)start on, so a previous run never
 * lingers. Invoked by the `pre<script>` hooks of dev / dev:stack / legacy-api:dev /
 * legacy-worker:dev / legacy-mcp:dev / legacy-app:dev / landing:dev (and from dev-stack.mjs directly).
 *
 * Why not just `lsof -ti :PORT | xargs kill` (the old predev:stack): the ingest
 * WORKER has no port at all, so a port-only sweep can never reap a stale worker —
 * exactly the failure we hit, where a worker from a prior run kept draining the
 * engine queue with a stale in-memory Prisma client. So each service is reaped by
 * BOTH its port AND a process-signature match.
 *
 * Safety: signature matches are scoped to THIS repo's absolute path, so we only
 * ever kill our own dev processes — never another Node/Nest/Next project the dev
 * has running elsewhere. Port matches are inherently scoped (whoever holds our
 * port must go). Graceful: SIGTERM first, then SIGKILL for anything still alive.
 *
 *   node scripts/free-ports.mjs legacy-worker            # just the worker
 *   node scripts/free-ports.mjs legacy-api legacy-worker legacy-mcp legacy-app
 *   node scripts/free-ports.mjs                    # every known service
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');

/**
 * Each service: the port it listens on (if any) + signature predicates matched
 * against a process's full command line (already known to contain REPO_ROOT).
 */
const SERVICES = {
  'legacy-api': { port: 4400, sig: (c) => (c.includes('nest') && c.includes('start') && c.includes('--watch') && !c.includes('--entryFile')) || c.includes('dist/main') },
  'legacy-mcp': { port: 4401, sig: (c) => c.includes('--entryFile mcp') || c.includes('dist/mcp') },
  'legacy-worker': { port: null, sig: (c) => c.includes('--entryFile worker') || c.includes('dist/worker') },
  'legacy-app': { port: 4345, sig: (c) => c.includes('apps/legacy-app') && c.includes('next') },
  landing: { port: 4343, sig: (c) => c.includes('apps/landing') && c.includes('next') },
  'demo-api': { port: 4344, sig: (c) => c.includes('apps/demo-api') },
};

const SELF = new Set([process.pid, process.ppid]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// A dev box can easily have >1MB of `ps` output (the execSync default), which
// throws ENOBUFS and — if swallowed — makes the whole signature sweep silently
// no-op. Give both probes plenty of room.
const EXEC = { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 };

/** PIDs listening on a TCP port (macOS/Linux lsof). */
function pidsOnPort(port) {
  if (!port) return [];
  try {
    return execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, EXEC)
      .toString().trim().split('\n').filter(Boolean).map(Number);
  } catch {
    return []; // lsof exits non-zero when nothing matches
  }
}

/** [pid, commandLine] for every process, full args, no width truncation. */
function processTable() {
  try {
    return execSync('ps -axww -o pid=,args=', EXEC)
      .toString().trim().split('\n')
      .map((line) => {
        const m = line.trim().match(/^(\d+)\s+(.*)$/);
        return m ? [Number(m[1]), m[2]] : null;
      })
      .filter(Boolean);
  } catch (e) {
    // Fail loud, never silent: a signature sweep that can't read the process
    // table would look identical to "nothing to clean" — the port-less worker
    // would survive undetected. Warn so it's visible.
    console.warn(`[free-ports] no pude leer la tabla de procesos (${e.message}) — limpieza por firma omitida`);
    return [];
  }
}

/** PIDs whose command line is in THIS repo and matches a service signature. */
function pidsBySignature(sig, table) {
  return table
    .filter(([, cmd]) => cmd.includes(REPO_ROOT) && !cmd.includes('free-ports') && sig(cmd))
    .map(([pid]) => pid);
}

function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function signal(pid, sig) {
  try { process.kill(pid, sig); return true; } catch { return false; }
}

async function main() {
  const requested = process.argv.slice(2).filter((s) => SERVICES[s]);
  const services = requested.length ? requested : Object.keys(SERVICES);
  const unknown = process.argv.slice(2).filter((s) => !SERVICES[s]);
  if (unknown.length) console.warn(`[free-ports] servicios desconocidos ignorados: ${unknown.join(', ')}`);

  const table = processTable();
  const targets = new Map(); // pid -> label (how it was matched)

  for (const name of services) {
    const { port, sig } = SERVICES[name];
    for (const pid of pidsOnPort(port)) if (!SELF.has(pid)) targets.set(pid, `${name}:port ${port}`);
    for (const pid of pidsBySignature(sig, table)) if (!SELF.has(pid)) targets.set(pid, `${name}:proc`);
  }

  if (targets.size === 0) {
    console.log(`[free-ports] ${services.join(', ')}: nada que limpiar ✓`);
    return;
  }

  for (const [pid, how] of targets) {
    if (signal(pid, 'SIGTERM')) console.log(`[free-ports] SIGTERM ${pid} (${how})`);
  }

  // Give them up to ~1.5s to exit, then SIGKILL whatever clung on.
  for (let i = 0; i < 15 && [...targets.keys()].some(isAlive); i++) await sleep(100);
  for (const [pid, how] of targets) {
    if (isAlive(pid)) { signal(pid, 'SIGKILL'); console.log(`[free-ports] SIGKILL ${pid} (${how})`); }
  }
  console.log(`[free-ports] ${services.join(', ')}: ${targets.size} proceso(s) liberado(s) ✓`);
}

export async function freePorts(services = []) {
  process.argv = [process.argv[0], process.argv[1], ...services];
  await main();
}

// Run when invoked as a CLI (not when imported).
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(`[free-ports] error: ${e.message}`); process.exit(0); }); // never block the dev start
}
