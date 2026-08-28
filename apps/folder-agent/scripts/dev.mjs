#!/usr/bin/env node
/**
 * UN SOLO COMANDO para levantar el agente de carpeta en desarrollo: libera el puerto
 * del simulador si quedo un proceso viejo colgado, levanta el simulador (hace de Savia
 * hasta que exista la API real) y compila+corre `bandeja` con el codigo actual —
 * `cargo run` siempre reconstruye lo que cambio, asi que esto arranca la version mas
 * reciente sin que haya que acordarse de compilar antes. Ctrl+C corta los dos procesos.
 */
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const PUERTO_SIM = 4477;

function liberarPuerto(puerto) {
  try {
    const pids = execSync(`lsof -ti tcp:${puerto} -sTCP:LISTEN`, {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean);
    for (const pid of pids) {
      try {
        process.kill(Number(pid), "SIGTERM");
      } catch {
        // ya se habia ido
      }
    }
  } catch {
    // lsof sale con codigo distinto de cero cuando no hay nada escuchando: nada que liberar
  }
}

liberarPuerto(PUERTO_SIM);

// El PATH de rustup no siempre esta en el shell que invoca este script (p. ej. un
// terminal nuevo antes de que el rc corra), asi que se lo agregamos nosotros.
const RUSTUP_BIN = "/opt/homebrew/opt/rustup/bin";
const env = { ...process.env, PATH: `${RUSTUP_BIN}:${process.env.PATH ?? ""}` };

console.log(`[dev] simulador en :${PUERTO_SIM}`);
const sim = spawn("node", ["sim/server.ts"], { cwd: APP_ROOT, stdio: "inherit", env });

let cerrando = false;
function cerrarTodo(codigo) {
  if (cerrando) return;
  cerrando = true;
  sim.kill("SIGTERM");
  agente.kill("SIGTERM");
  process.exit(codigo ?? 0);
}

sim.on("exit", (codigo) => {
  // si el simulador muere solo, no dejar el agente hablandole a nadie
  if (!cerrando) cerrarTodo(codigo ?? 1);
});

console.log("[dev] compilando y corriendo bandeja...");
const agente = spawn(
  "cargo",
  ["run", "--manifest-path", path.join(APP_ROOT, "src-tauri", "Cargo.toml"), "--bin", "bandeja"],
  { cwd: APP_ROOT, stdio: "inherit", env },
);

agente.on("exit", (codigo) => cerrarTodo(codigo ?? 0));

process.on("SIGINT", () => cerrarTodo(0));
process.on("SIGTERM", () => cerrarTodo(0));
