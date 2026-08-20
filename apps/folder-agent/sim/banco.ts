/**
 * EL BANCO DE INTEGRACION, EN UN SOLO COMANDO. Levanta el simulador, corre las pruebas
 * `#[ignore]` de `tests/contra_el_simulador.rs` contra sockets de verdad, y lo baja pase
 * lo que pase.
 *
 * **EXISTE PARA QUE ESAS CUATRO PRUEBAS ESTEN EN LA CADENA Y NO EN UN README.** Van
 * `#[ignore]` a proposito —`cargo test` tiene que pasar en una maquina sin nada
 * levantado— y el precio de eso era que solo corrian si alguien se acordaba de abrir dos
 * terminales. Una prueba que depende de que alguien se acuerde no es un guardian.
 *
 * Son las unicas que pueden atrapar un problema de TRANSPORTE, que es justamente lo que
 * ningun doble de HTTP muestra: el primer hallazgo del banco fue Node contestando
 * `Transfer-Encoding: chunked` aunque se le pidiera `Connection: close`.
 *
 * El servidor corre EN ESTE PROCESO y las pruebas en otro, porque el aislamiento que
 * hace falta es el del ESTADO —`documentos`, `objetos`, `barridos` y `congeladas` son
 * modulo— y no el del proceso. Correr el ejercicio y el banco en el mismo proceso
 * mezclaria los dos corpus.
 */
import { spawn } from "node:child_process";
import { connect } from "node:net";
import { iniciar } from "./server.ts";

const PUERTO = 4477; // La base la tienen HARDCODEADA las pruebas: `BASE` en contra_el_simulador.rs.

/** El puerto ocupado no es «falla del banco»: es otro simulador con OTRO corpus. */
const ocupado = () =>
  new Promise<boolean>((ok) => {
    const s = connect({ port: PUERTO, host: "127.0.0.1" })
      .on("connect", () => { s.destroy(); ok(true); })
      .on("error", () => ok(false));
  });

if (await ocupado()) {
  console.error(
    `BANCO-ERR: el puerto ${PUERTO} ya esta ocupado.\n` +
      `           Las pruebas correrian contra ESE servidor, con un corpus que no es el\n` +
      `           de este banco. Baja el \`pnpm sim\` que tengas corriendo y repeti.`,
  );
  process.exit(1);
}

const servidor = await iniciar(PUERTO);

const cargo = spawn(
  "cargo",
  ["test", "--manifest-path", "src-tauri/Cargo.toml", "--", "--ignored", "--test-threads=1"],
  { stdio: "inherit" },
);

// `close` y no `exit`: `stdio: inherit` no crea pipes que esperar, pero el codigo sale
// por `close` en los dos casos y `exit` no garantiza que la salida ya se haya vaciado.
const codigo = await new Promise<number>((ok) => {
  cargo.on("error", (e) => {
    console.error(`BANCO-ERR: no se pudo ejecutar \`cargo\`: ${e.message}`);
    ok(127);
  });
  cargo.on("close", (c, senal) => ok(senal ? 1 : (c ?? 1)));
});

servidor.cerrar();
process.exit(codigo);
