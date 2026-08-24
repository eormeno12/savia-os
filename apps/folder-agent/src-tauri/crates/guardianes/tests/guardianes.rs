//! LOS TRES GUARDIANES DE `tests/guardianes.rs` QUE NO SE PUEDEN REPARTIR POR CRATE:
//! verifican una propiedad del WORKSPACE ENTERO — un conteo global, un barrido que
//! cruza nueve crates, un chequeo de que el recorrido no se salteo ningun subarbol.
//! Ver docs/product/savia-b2b/plan-rediseno-agente.md §2, "Los tests de
//! `tests/guardianes.rs`, uno por uno".
//!
//! Los otros trece (uno-a-uno) y los dos que se parten en copias por crate se mudaron a
//! `tests/guardianes.rs` de cada crate correspondiente, sin tocar su cuerpo.
//!
//! **La tecnica es la misma que `fuentes_fuera_del_binario_de_ventana` ya usaba en el
//! crate unico**, con un nivel mas de indireccion: en vez de caminar un solo `src/`, se
//! caminan las once crates hermanas por ruta relativa desde el propio
//! `CARGO_MANIFEST_DIR`.

use std::path::PathBuf;

/// La raiz del paquete host: dos niveles arriba de esta crate (`crates/guardianes/` →
/// `crates/` → `src-tauri/`).
fn raiz_del_workspace() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
}

fn fuente(crate_nombre: &str, rel: &str) -> String {
    let p = raiz_del_workspace()
        .join("crates")
        .join(crate_nombre)
        .join("src")
        .join(rel);
    std::fs::read_to_string(&p).unwrap_or_else(|e| panic!("no se pudo leer {}: {e}", p.display()))
}

/// Quita los comentarios de linea. Un guardian que busca sintaxis no se puede disparar
/// con una prosa que la menciona — y varios comentarios de este workspace citan
/// justamente la sintaxis que estos tests prohiben.
fn sin_comentarios(src: &str) -> String {
    src.lines()
        .map(|l| match l.find("//") {
            Some(i) => &l[..i],
            None => l,
        })
        .collect::<Vec<_>>()
        .join("\n")
}

#[test]
fn el_hash_verificado_solo_se_acuna_en_las_puertas_nombradas() {
    // IMPORTA PORQUE: sin esta restriccion, guardar el afirmado donde va el verificado
    // seria un descuido de UNA LINEA, y el sintoma —una baja posterior que no matchea
    // con ningun documento, para siempre— aparece meses despues y no se parece a su
    // causa.
    //
    // Fase 2 reemplazo el `acunar(bytes)` generico por dos puertas nombradas a su
    // escenario: `desde_coincidencia_known` (promueve el afirmado que el pedido YA
    // llevaba) y `desde_hex_verificado` (parsea el hex que vino del alambre). Ninguna
    // acepta un `[u8; 32]` inventado en el sitio de la llamada. El guardian verifica
    // DOS cosas por cada puerta: que no aparece en ningun archivo ajeno, y que aparece
    // EXACTAMENTE UNA VEZ en `savia-folder-protocolo`, que es la unica que la usa hoy.
    //
    // Los once archivos de abajo son los mismos que antes de fase 2 — el tipo-testigo
    // no cambia el grafo de crates, solo las firmas de `dominio.rs`.
    let prohibidos: [(&str, &str); 11] = [
        ("maquina", "maquina.rs"),
        ("contrato", "salvaguardas.rs"),
        ("politica", "salvaguardas.rs"),
        ("contrato", "inventario.rs"),
        ("estado", "inventario.rs"),
        ("contrato", "colas.rs"),
        ("estado", "colas.rs"),
        ("estado", "almacen.rs"),
        ("aplicacion", "ciclo.rs"),
        ("contrato", "plataforma.rs"),
        ("plataforma-falsa", "falsa.rs"),
    ];
    const PUERTAS: [&str; 2] = [
        "HashVerificado::desde_coincidencia_known",
        "HashVerificado::desde_hex_verificado",
    ];
    for (crate_nombre, archivo) in prohibidos {
        let src = fuente(crate_nombre, archivo);
        for puerta in PUERTAS {
            assert!(
                !src.contains(puerta),
                "{crate_nombre}/{archivo} llama `{puerta}`. Las puertas son `savia-folder-protocolo` (la respuesta `known` y `upload.completed`) y `rehidratar_del_inventario`"
            );
        }
    }
    // Y las dos puertas legitimas siguen ahi, cada una llamada exactamente una vez: si
    // alguien las duplica o las mueve, o si alguien borra una de las dos, el guardian
    // de arriba pasaria verde sobre un sistema que ya no verifica lo que dice
    // verificar. `dominio.rs`, donde viven las dos constructoras, no cuenta sus propios
    // llamadores — cuenta quien las invoca, y eso es `savia-folder-protocolo`.
    let protocolo = fuente("protocolo", "lib.rs");
    for puerta in PUERTAS {
        assert_eq!(
            protocolo.matches(puerta).count(),
            1,
            "`{puerta}` tiene que aparecer exactamente una vez en `savia-folder-protocolo`"
        );
    }
}

/// Todo `.rs` bajo `crates/*/src/`, mas `src/main.rs` del paquete host (`src/bin/` queda
/// afuera: es el unico lugar del workspace donde Tauri esta permitido). Se camina en vez
/// de listarse a mano para que un archivo nuevo quede cubierto sin que nadie se acuerde
/// de agregarlo.
fn fuentes_del_workspace() -> Vec<(String, String)> {
    fn caminar(dir: &PathBuf, prefijo: &str, salida: &mut Vec<(String, String)>) {
        let mut entradas: Vec<_> = std::fs::read_dir(dir)
            .unwrap_or_else(|e| panic!("no se pudo leer {}: {e}", dir.display()))
            .filter_map(Result::ok)
            .collect();
        entradas.sort_by_key(std::fs::DirEntry::file_name);
        for e in entradas {
            let nombre = e.file_name().to_string_lossy().into_owned();
            let rel = if prefijo.is_empty() {
                nombre.clone()
            } else {
                format!("{prefijo}/{nombre}")
            };
            if e.path().is_dir() {
                caminar(&e.path(), &rel, salida);
            } else if nombre.ends_with(".rs") {
                salida.push((
                    rel,
                    std::fs::read_to_string(e.path()).expect("fuente legible"),
                ));
            }
        }
    }
    const CRATES: [&str; 9] = [
        "contrato",
        "politica",
        "maquina",
        "estado",
        "protocolo",
        "plataforma-adaptadores",
        "plataforma-falsa",
        "persistencia",
        "aplicacion",
    ];
    let raiz = raiz_del_workspace();
    let mut v = Vec::new();
    for c in CRATES {
        caminar(&raiz.join("crates").join(c).join("src"), c, &mut v);
    }
    let main_rs = raiz.join("src").join("main.rs");
    v.push((
        "host/main.rs".to_string(),
        std::fs::read_to_string(&main_rs)
            .unwrap_or_else(|e| panic!("no se pudo leer {}: {e}", main_rs.display())),
    ));
    v
}

#[test]
fn sin_emoji_en_los_fuentes() {
    // Convencion dura del repo.
    for (archivo, src) in fuentes_del_workspace() {
        for c in src.chars() {
            let x = c as u32;
            let es_emoji = (0x1F300..=0x1FAFF).contains(&x)
                || (0x2600..=0x27BF).contains(&x)
                || (0x1F000..=0x1F2FF).contains(&x);
            assert!(!es_emoji, "{archivo} tiene un emoji: U+{x:04X}");
        }
    }
}

#[test]
fn el_nucleo_no_conoce_la_ventana() {
    // IMPORTA PORQUE: es la garantia que sostiene otras dos, y las dos se rompen en
    // silencio. **Una:** `pnpm nucleo:windows` cruza a `x86_64-pc-windows-msvc` para
    // comprobar que ninguna crate de biblioteca se ata a macOS. **Dos:** las pruebas
    // corren sin levantar una ventana ni un runtime de eventos, y por eso son
    // deterministas y rapidas.
    //
    // **La mitad que se borro, y por que no hace falta escribirla de nuevo:** la
    // prohibicion de `tauri`/`objc2`/`block2` como DEPENDENCIA la impone ahora el propio
    // Cargo — una crate que no las declara no las puede usar, y eso es un error de
    // compilacion, no un `assert`. Lo que Cargo NO puede imponer solo es la palabra
    // `webview` en un comentario, ni que este recorrido haya bajado a cada crate en vez
    // de pasar por arriba — por eso las cuatro palabras siguen aca, con el mismo
    // conjunto que el guardian original: si algun dia una crate de biblioteca declarara
    // `tauri` como dependencia real, este texto lo va a encontrar tambien, antes que el
    // primer error de compilacion en un consumidor lo note.
    const PROHIBIDOS: [&str; 4] = ["tauri", "objc2", "block2", "webview"];

    let fuentes = fuentes_del_workspace();

    // **SIN ESTO EL GUARDIAN PUEDE PASAR SIN MIRAR NADA.** Se comprueba que el recorrido
    // efectivamente bajo a CADA una de las nueve crates de biblioteca, y que ademas vio
    // el archivo suelto del host (`main.rs`).
    const CRATES: [&str; 9] = [
        "contrato",
        "politica",
        "maquina",
        "estado",
        "protocolo",
        "plataforma-adaptadores",
        "plataforma-falsa",
        "persistencia",
        "aplicacion",
    ];
    for c in CRATES {
        assert!(
            fuentes
                .iter()
                .any(|(rel, _)| rel.starts_with(&format!("{c}/"))),
            "el guardian no bajo a la crate `{c}`: esta mirando menos de lo que dice"
        );
    }
    assert!(
        fuentes.iter().any(|(rel, _)| rel == "host/main.rs"),
        "el guardian no vio `src/main.rs` del paquete host"
    );

    for (archivo, src) in &fuentes {
        // Los comentarios de este workspace NOMBRAN a Tauri a cada rato —explicando
        // justamente por que no esta— asi que se miran solo si sobreviven al recorte.
        let codigo = sin_comentarios(src);
        for prohibido in PROHIBIDOS {
            assert!(
                !codigo.contains(prohibido),
                "{archivo} nombra `{prohibido}`: el runtime de ventana vive en \
                 `src/bin/bandeja/` del paquete host y en ningun otro lado"
            );
        }
    }
}
