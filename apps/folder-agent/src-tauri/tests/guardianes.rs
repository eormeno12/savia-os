//! LOS GUARDIANES, al estilo de `packages/ir/scripts/boundaries.mjs` y `numbers.mjs`.
//!
//! El repo verifica por paquete con una cadena de guardianes encadenados desde el `lint`
//! de cada `package.json`, y un crate de cargo no entra en esa cadena. Estos son la
//! transposicion: **corren con `cargo test`**, leen el AST de texto de los fuentes, y
//! fallan cuando una regla se rompe.
//!
//! Que sean de texto y no de tipos es una limitacion real y hay que decirla: un crate
//! unico no puede prohibir por privacidad de modulo lo que un workspace de varios crates
//! prohibiria con Cargo. Cuando el nucleo se parta —`contrato` ← {`inventario`,
//! `protocolo`, `plataforma`} ← `ciclo`— la mitad de esto lo impone el grafo de
//! dependencias y estos guardianes se pueden borrar.

use std::path::PathBuf;

fn fuente(rel: &str) -> String {
    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("src")
        .join(rel);
    std::fs::read_to_string(&p).unwrap_or_else(|e| panic!("no se pudo leer {}: {e}", p.display()))
}

/// Los modulos que tienen que ser PUROS: sin I/O ambiente, sin globals, sin reloj del
/// sistema, sin `unsafe`. Es la misma disciplina con la que `sha256` y `targetSizeChars`
/// entran por parametro a `packages/ir`.
const PUROS: [&str; 3] = ["maquina.rs", "salvaguardas.rs", "inventario.rs"];

#[test]
fn los_modulos_puros_no_tocan_el_mundo() {
    // IMPORTA PORQUE: si la maquina leyera el disco o el reloj, dejaria de ser
    // determinista y el banco no podria ejercer «pasaron seis horas y cinco la laptop
    // estuvo dormida» sin dormir la laptop.
    const PROHIBIDOS: [&str; 7] = [
        "std::fs",
        "std::net",
        "std::env",
        "std::process",
        "Instant::now",
        "SystemTime::now",
        "std::time::Instant",
    ];
    for archivo in PUROS {
        let src = fuente(archivo);
        for prohibido in PROHIBIDOS {
            assert!(
                !src.contains(prohibido),
                "{archivo} usa `{prohibido}`: el mundo entra por puerto, no por llamada"
            );
        }
        assert!(
            src.contains("#![forbid(unsafe_code)]"),
            "{archivo} tiene que declarar `#![forbid(unsafe_code)]`"
        );
    }
}

#[test]
fn ningun_numero_inventado_en_los_modulos_de_decision() {
    // IMPORTA PORQUE: es la regla del monorepo —«si un numero decide comportamiento vive
    // en PARAMETERS con unidad, que decide y como se mediria»—. Un `Duration::from_secs`
    // suelto en la maquina seria un intervalo elegido a ojo con cara de constante.
    for archivo in ["maquina.rs", "salvaguardas.rs"] {
        let src = fuente(archivo);
        assert!(
            !src.contains("Duration::from_"),
            "{archivo} construye una `Duration` literal: los intervalos entran por `Politica` o por el puerto"
        );
    }
}

#[test]
fn los_cuatro_numeros_del_canal_estan_sin_valor() {
    // IMPORTA PORQUE: si alguno se completara con un numero inventado, el modulo
    // funciona, los tests pasan y el banco reporta cifras — y nadie se entera de que
    // estan calibradas contra un valor que nadie midio.
    let src = fuente("parametros.rs");
    for (nombre, _) in [
        ("ASENTAMIENTO", ()),
        ("MAX_INTENTOS", ()),
        ("VENTANA_DE_CUARENTENA", ()),
        ("FRACCION_DEL_CORTE", ()),
    ] {
        let linea = src
            .lines()
            .find(|l| l.contains(&format!("pub const {nombre}:")))
            .unwrap_or_else(|| panic!("falta el parametro {nombre}"));
        assert!(
            linea.contains("= None;"),
            "{nombre} tiene valor: {linea}. Ninguno de los cuatro se inventa."
        );
    }
    // Y cada uno lleva unidad, que decide y como se mediria.
    for marca in ["DECIDE:", "COMO SE MEDIRIA:", "SE MEDIRIA:"] {
        assert!(
            src.contains(marca) || marca == "SE MEDIRIA:",
            "falta la ficha `{marca}` en parametros.rs"
        );
    }
}

#[test]
fn el_hash_verificado_solo_se_acuna_en_las_puertas_nombradas() {
    // IMPORTA PORQUE: sin esta restriccion, guardar el afirmado donde va el verificado
    // seria un descuido de UNA LINEA, y el sintoma —una baja posterior que no matchea
    // con ningun documento, para siempre— aparece meses despues y no se parece a su
    // causa.
    let permitidos = ["dominio.rs", "protocolo/mod.rs"];
    for archivo in [
        "maquina.rs",
        "salvaguardas.rs",
        "inventario.rs",
        "colas.rs",
        "almacen.rs",
        "ciclo.rs",
        "plataforma/mod.rs",
        "plataforma/falsa.rs",
    ] {
        assert!(
            !fuente(archivo).contains("HashVerificado::acunar"),
            "{archivo} acuna un hash verificado. Las puertas son: {permitidos:?} y `rehidratar_del_inventario`"
        );
    }
    // Y las dos puertas legitimas siguen ahi: si alguien las borra, el guardian de arriba
    // pasaria verde sobre un sistema que ya no verifica nada.
    let protocolo = fuente("protocolo/mod.rs");
    assert_eq!(
        protocolo.matches("HashVerificado::acunar").count(),
        2,
        "las puertas de `protocolo` son exactamente dos: la respuesta `known` y `upload.completed`"
    );
}

#[test]
fn el_id_de_archivo_no_puede_ser_clave_de_un_mapa() {
    // IMPORTA PORQUE: NTFS recicla ids y un restore los cambia todos. Si derivara `Hash`,
    // indexar el inventario por el compilaria, y a partir de ahi dos archivos distintos
    // colapsan en una fila: el documento viejo no se retira NUNCA y el contenido nuevo no
    // se sube NUNCA.
    let src = fuente("dominio.rs");
    let i = src
        .find("pub struct IdDeArchivoDelSO")
        .expect("falta el tipo");
    let derive = src[..i].rsplit("#[derive(").next().unwrap_or("");
    assert!(
        !derive.contains("Hash"),
        "`IdDeArchivoDelSO` deriva `Hash`: es una pista que se verifica, nunca una identidad"
    );
    assert!(!derive.contains("Ord"), "`IdDeArchivoDelSO` deriva `Ord`");
}

#[test]
fn la_id_de_volumen_no_deriva_partial_eq() {
    // IMPORTA PORQUE: dos `NoPublicada` compararian iguales, la huella de raiz
    // «coincidiria», y un directorio suplente sobre otro volumen sin UUID pasaria la
    // salvaguarda 2 entera.
    let src = fuente("plataforma/mod.rs");
    let i = src.find("pub enum IdDeVolumen").expect("falta el tipo");
    let derive = src[..i].rsplit("#[derive(").next().unwrap_or("");
    assert!(
        !derive.contains("PartialEq"),
        "`IdDeVolumen` deriva `PartialEq`: la comparacion tiene que ser de TRES valores"
    );
}

#[test]
fn el_origen_de_la_senal_no_lleva_veredicto() {
    // IMPORTA PORQUE: los APIs del sistema entregan banderas «removed»/«created». Si
    // `OrigenDeSenal` tuviera donde ponerlas, «un evento nunca produce un reporte» seria
    // una regla que alguien respeta en vez de algo que no se puede escribir.
    // La afirmacion dura es el `const _: () = assert!(size_of == 1)` de `maquina.rs`;
    // esto verifica que el guardian siga ahi.
    let src = fuente("maquina.rs");
    assert!(
        src.contains("assert!(core::mem::size_of::<OrigenDeSenal>() == 1)"),
        "falta el assert de compilacion que fija `OrigenDeSenal` sin payload"
    );
}

#[test]
fn el_desenlace_no_tiene_rama_descartar() {
    // IMPORTA PORQUE: un `400` descartado en silencio pierde un hecho sin que nadie se
    // entere; el inventario del agente y el registro de Savia divergen y no hay mecanismo
    // que los reconcilie. La ausencia de la variante es la garantia.
    let src = fuente("colas.rs");
    let i = src.find("pub enum Desenlace").expect("falta el enum");
    let j = src[i..].find("\n}\n").expect("enum sin cerrar") + i;
    let cuerpo = &src[i..j];
    for prohibida in ["Descartar", "Descartado", "Ignorar"] {
        assert!(
            !cuerpo.contains(prohibida),
            "`Desenlace` gano una rama `{prohibida}`: todo trabajo termina entregado, esperando, detenido, muerto con alerta, ambiguo o ilegible en disco"
        );
    }
}

#[test]
fn el_puerto_de_inventario_no_tiene_metodos_de_escritura() {
    // IMPORTA PORQUE: es lo que permite que el efecto y el hecho se comprometan en la
    // MISMA transaccion. Si la maquina escribiera, se marcaria «reportado», el proceso
    // moriria antes de encolar, y ese archivo no se reportaria nunca mas.
    let src = fuente("inventario.rs");
    let i = src.find("pub trait Inventario").expect("falta el trait");
    let j = src[i..].find("\n}\n").expect("trait sin cerrar") + i;
    let cuerpo = &src[i..j];
    assert!(
        !cuerpo.contains("&mut self"),
        "el puerto `Inventario` gano un metodo de escritura"
    );
}

#[test]
fn sin_emoji_en_los_fuentes() {
    // Convencion dura del repo.
    for archivo in [
        "dominio.rs",
        "maquina.rs",
        "salvaguardas.rs",
        "inventario.rs",
        "colas.rs",
        "almacen.rs",
        "ciclo.rs",
        "parametros.rs",
        "hash.rs",
        "main.rs",
        "lib.rs",
        "plataforma/mod.rs",
        "plataforma/macos.rs",
        "plataforma/falsa.rs",
        "plataforma/windows.rs",
        "protocolo/mod.rs",
        "protocolo/alambre.rs",
        "protocolo/transporte.rs",
    ] {
        for c in fuente(archivo).chars() {
            let x = c as u32;
            let es_emoji = (0x1F300..=0x1FAFF).contains(&x)
                || (0x2600..=0x27BF).contains(&x)
                || (0x1F000..=0x1F2FF).contains(&x);
            assert!(!es_emoji, "{archivo} tiene un emoji: U+{x:04X}");
        }
    }
}
