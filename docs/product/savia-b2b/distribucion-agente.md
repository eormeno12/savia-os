# Distribuir el agente de carpeta

Qué hay que tener para que alguien que no seas tú pueda instalarlo, qué está construido, y
qué está esperando una credencial. **Cada paso bloqueado dice de qué está esperando** — no
hay ninguno que dependa de trabajo de código que no esté hecho, salvo Windows, que es un
caso aparte y está al final.

---

## Lo que ya sale del build

```bash
cd apps/folder-agent
TAURI_SIGNING_PRIVATE_KEY=~/.tauri/savia-agente.key \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
pnpm exec tauri build --target universal-apple-darwin
```

**`--target universal-apple-darwin` no es opcional.** Sin eso sale un `.dmg` con la
arquitectura de la máquina que compiló —acá, `aarch64`— y **en una Mac Intel no corre**.
Con eso sale uno solo que corre en las dos; se comprueba con
`lipo -archs …/Contents/MacOS/bandeja`, que tiene que decir `x86_64 arm64`. Requiere
`rustup target add x86_64-apple-darwin`.

Produce tres cosas en `src-tauri/target/universal-apple-darwin/release/bundle/`:

| artefacto | qué es |
|---|---|
| `dmg/Savia_0.1.0_universal.dmg` | **el instalador** — se abre, se arrastra a Aplicaciones |
| `macos/Savia.app.tar.gz` | el paquete que consume el actualizador |
| `macos/Savia.app.tar.gz.sig` | su firma, con la clave privada del actualizador |

**El `.app` lleva un solo binario, y eso hubo que arreglarlo.** El empaquetador de Tauri
mete todos los `[[bin]]` del crate: `Savia.app/Contents/MacOS/` tenía `bandeja` **y**
`folder-agent`, o sea que el instalador le entregaba a cada persona la herramienta de demo
—la que imprime el código de vinculación en la consola y acepta una ruta cruda—. Ahora el
demo está detrás de `required-features = ["demo"]`, fuera de `default`; se corre con
`cargo run --bin folder-agent --features demo -- <ruta>`.

Y la app trae ya adentro:

- **Arrancar al iniciar sesión**, por `LaunchAgent` — o sea que aparece en Ajustes del
  Sistema → Elementos de inicio, que es donde la persona lo va a buscar cuando quiera
  sacarlo. **Registrado pero apagado**: encenderlo es una decisión de la persona y va en la
  última pantalla del onboarding. Un agente que se mete solo en el arranque la primera vez
  que se abre está cambiando la configuración de la máquina sin preguntar.
- **El actualizador**, con su clave pública y su endpoint en `tauri.conf.json`.

---

## La clave del actualizador — ya existe, y hay que cuidarla

```
privada   ~/.tauri/savia-agente.key       (chmod 600, FUERA del repo)
pública   ~/.tauri/savia-agente.key.pub   (está en tauri.conf.json, no es secreta)
```

**Si se pierde la privada, ninguna instalación existente vuelve a recibir una
actualización, nunca.** No hay forma de rotarla hacia atrás: la clave pública viaja adentro
de cada `.app` ya instalado, así que una clave nueva solo la aceptan las instalaciones
hechas después. Antes del primer release público hay que:

1. **Copiarla a un gestor de contraseñas.** No es un archivo que se pueda volver a generar.
2. **Guardarla como secreto de CI** (`TAURI_SIGNING_PRIVATE_KEY`), cuando haya CI.
3. Decidir si lleva contraseña. Se generó **sin** contraseña, o sea que el archivo *es* el
   secreto. Si se le quiere poner una, hay que regenerar el par — y regenerar después del
   primer release rompe las actualizaciones de todo lo instalado. **Es ahora o nunca.**

---

## Paso 1 · El certificado de Apple (bloqueado — 99 USD/año)

Sin esto, en cualquier Mac que no sea la que compiló, el `.app` **no abre**: Gatekeeper lo
rechaza y ni siquiera funciona el «botón derecho → Abrir», porque la firma ad-hoc que sale
por omisión se rompe al copiarse. Hoy `security find-identity -v -p codesigning` devuelve
`0 valid identities found`.

**El App Store no es una alternativa**: la app usa `macos-private-api` —que es lo que da el
fondo transparente del popover— y eso la deja fuera. El camino es **Developer ID**, o sea
distribución directa. Está anotado como costo en `Cargo.toml`.

1. Inscribirse en el [Apple Developer Program](https://developer.apple.com/programs/) —
   99 USD/año.
2. En Acceso a Llaveros → Asistente de certificados → **Solicitar un certificado de una
   autoridad de certificación**, guardarlo en disco. Sale un `.certSigningRequest`.
3. En [developer.apple.com/account/resources/certificates](https://developer.apple.com/account/resources/certificates/list)
   → «+» → **Developer ID Application** → subir el CSR → descargar el `.cer` → doble clic
   para instalarlo en el llavero.
4. Comprobar: `security find-identity -v -p codesigning` tiene que listar
   `Developer ID Application: … (TEAMID)`.

## Paso 2 · La contraseña de notarización (bloqueado por el paso 1)

Apple solo notariza código ya firmado con Developer ID.

1. En [account.apple.com](https://account.apple.com) → Iniciar sesión y seguridad →
   **Contraseñas específicas para apps** → generar una. Aparece una sola vez.
2. Anotar el **Team ID** (arriba a la derecha en el portal de desarrollador).

## Paso 3 · Firmar y notarizar (un comando, cuando existan 1 y 2)

Con las cuatro variables puestas, el mismo `tauri build` firma, notariza y grapa el ticket
sin ningún cambio de configuración:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: TU NOMBRE (TEAMID)"
export APPLE_ID="tu@correo"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"   # la específica de app
export APPLE_TEAM_ID="TEAMID"
```

Tauri firma, notariza y **grapa el ticket** en el mismo comando. Si la primera pasada de
notarización falla por el grapado, `--skip-stapling` la separa. Y **una cuenta gratuita de
Apple Developer no notariza**: firma, pero la app sigue apareciendo como no verificada, así
que la membresía paga no es opcional para esto.

Comprobar que quedó bien, que es lo único que dice la verdad:

```bash
spctl -a -vvv "src-tauri/target/release/bundle/macos/Savia.app"
```

Tiene que decir `accepted` y `source=Notarized Developer ID`. Hoy dice
`code has no resources but signature indicates they must be present`, que es la firma
ad-hoc rota.

## Paso 4 · Dónde vive la descarga (falta decidir)

El endpoint del actualizador está puesto como:

```
https://savia.uno/descargas/agente/latest.json
```

**Es un marcador de posición y hay que confirmarlo** — es lo único de esta página que no
depende de nadie más. Ahí tiene que responder:

```json
{
  "version": "0.1.0",
  "notes": "",
  "pub_date": "…",
  "platforms": {
    "macos-universal": { "signature": "…contenido del .sig…", "url": "https://…/Savia.app.tar.gz" }
  }
}
```

**La clave es `macos-universal` y no `darwin-aarch64`.** Por omisión el actualizador arma
la clave como `{{target}}-{{arch}}`, lo que partiría en dos —`darwin-x86_64` y
`darwin-aarch64`— algo que es un solo archivo, y obligaría a publicar el mismo paquete bajo
dos claves. La documentación llama a esto *custom target*: el agente lo declara con
`.target("macos-universal")` y **ese valor es la clave que se busca acá**.

El `.dmg` es lo que se baja la primera vez; el `.app.tar.gz` es lo que se baja cada
actualización. **Son dos archivos distintos y los dos tienen que estar publicados.**

---

## Windows — no lo bloquea el instalador

**`plataforma/windows.rs` tiene nueve `unimplemented!()`.** Un `.msi` hoy instalaría algo
que compila, arranca, y revienta en la primera operación real: la huella de la raíz, la
ficha de un archivo, el hash, la lectura para subir, la granularidad del mtime y el reloj.
Está acreditado que **la firma es correcta** —`cargo check --lib --target
x86_64-pc-windows-msvc` cruza limpio— y nada más que eso.

O sea que para Windows el orden es: **primero el cuerpo de la plataforma, después el
instalador.** Y cuando toque:

- se compila **en Windows**, no acá — desde una Mac ni siquiera se cruza el binario, porque
  el script de build de Tauri necesita `llvm-rc` para el recurso de Windows (ver
  `src-tauri/build.rs`);
- el instalador es NSIS o WiX, y el que sirve para el actualizador es el mismo;
- necesita su propio certificado, **Authenticode**, que no es el de Apple y no es gratis —
  y desde 2023 los de validación extendida exigen token físico o HSM en la nube, lo que
  complica firmarlo desde CI.

---

## Lo que sigue, en orden

1. Confirmar la URL de descarga (paso 4). No depende de nadie.
2. Guardar la clave privada del actualizador en un gestor de contraseñas. **Hoy.**
3. Sacar el Apple Developer Program y hacer los pasos 1 a 3.
4. CI que empaquete y publique — con la clave privada como secreto, no en el repo.
5. Windows: el cuerpo de la plataforma primero.

---

## De dónde salió todo esto

No de la memoria. Los docs oficiales de Tauri están clonados en
`~/.local/share/savia-fuentes/tauri-docs/src/content/docs/` (`distribute/Sign/macos.mdx`,
`plugin/updater.mdx`, `distribute/dmg.mdx`) y el Cargo Book viene con rustup en
`$(rustc --print sysroot)/share/doc/rust/html/cargo/reference/`. Actualizar los primeros con
`git -C ~/.local/share/savia-fuentes/tauri-docs pull`.
