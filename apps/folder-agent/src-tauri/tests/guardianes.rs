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

/// Quita los comentarios de linea. Un guardian que busca sintaxis no se puede disparar
/// con una prosa que la menciona — y varios comentarios de este crate citan justamente la
/// sintaxis que estos tests prohiben.
fn sin_comentarios(src: &str) -> String {
    src.lines()
        .map(|l| match l.find("//") {
            Some(i) => &l[..i],
            None => l,
        })
        .collect::<Vec<_>>()
        .join("\n")
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

#[test]
fn el_resumen_del_barrido_cuenta_los_diez_nodos() {
    // IMPORTA PORQUE: el doc de `Nodo` dice que la rama va en la salida «porque es lo que
    // el panel muestra por raiz». Durante toda la vida del crate el resumen conto SEIS de
    // diez y las otras cuatro caian en una rama comodin — entre ellas `RaizAusente`, que
    // es la salvaguarda disparandose («se desmonto el disco y no reporte ni una baja»), y
    // `BajaNoReportable`, que OLVIDA una fila. Las dos terminaban sin dejar rastro.
    //
    // La rama comodin es lo que lo hizo posible y lo que lo volveria a hacer posible: con
    // ella, una variante nueva de `Nodo` entra al arbol y desaparece del panel en
    // silencio.
    const NODOS: [&str; 10] = [
        "Aparecio",
        "Desaparecio",
        "Omitido",
        "Esperando",
        "Movimiento",
        "Indeterminado",
        "SinCambio",
        "RaizAusente",
        "BajaNoReportable",
        "AgendaBarrido",
    ];
    let src = sin_comentarios(&fuente("ciclo.rs"));
    let i = src
        .find("match &paso.nodo {")
        .expect("falta el match que arma el resumen");
    let j = src[i..].find("\n        }").expect("match sin cerrar") + i;
    let cuerpo = &src[i..j];

    assert!(
        !cuerpo.contains("_ =>"),
        "el match del resumen gano una rama comodin: una variante nueva de `Nodo` se volveria a caer del panel sin que nada avise"
    );
    for n in NODOS {
        assert!(
            cuerpo.contains(&format!("Nodo::{n}")),
            "`Nodo::{n}` no se cuenta en el resumen del barrido"
        );
    }
}

#[test]
fn el_cierre_no_tira_su_propio_diagnostico() {
    // IMPORTA PORQUE: `Cierre::retenidas` lleva el motivo por el que cada ausencia NO
    // salio, y su propio doc dice «para el panel, nunca para el servidor». No lo leia
    // NADIE —ni `ciclo`, ni `almacen`, ni un test—: el cierre calculaba el diagnostico y
    // el resumen lo tiraba en la misma linea en que consumia el `Cierre`.
    //
    // Es el caso mas caro de todos: no es que falte informacion, es que existe, cuesta
    // calcularla, y se descarta.
    const MOTIVOS: [&str; 4] = [
        "RaizAusente",
        "EsMovimiento",
        "SinHashConfirmado",
        "Deshidratado",
    ];
    let src = sin_comentarios(&fuente("ciclo.rs"));
    assert!(
        src.contains("cierre.retenidas"),
        "`ciclo` volvio a consumir el `Cierre` sin leer `retenidas`"
    );
    for m in MOTIVOS {
        assert!(
            src.contains(&format!("PorQueNoSeReporta::{m}")),
            "el motivo `{m}` no llega al resumen"
        );
    }
}

/// **EL AGENTE NO SE PUEDE APROBAR A SI MISMO**, y esa imposibilidad es todo lo que el
/// codigo corto compra. Si `Cliente` pudiera llamar a `/enroll/approve`, un binario que
/// llego a una maquina se vincularia solo y el paso del humano no ataria nada.
///
/// Se verifica por AUSENCIA de la ruta en el fuente del cliente, que es lo mas fuerte
/// que un crate unico puede hacer: la separacion real vive del lado del servidor —donde
/// esa ruta la protege la sesion web de la persona— y aca lo unico que se puede impedir
/// es que el agente tenga con que llamarla.
#[test]
fn el_cliente_no_tiene_con_que_aprobarse() {
    let src = sin_comentarios(&fuente("protocolo/mod.rs"));
    for prohibida in ["/enroll/approve", "/enroll/deny", "/enroll/revoke"] {
        assert!(
            !src.contains(prohibida),
            "`{prohibida}` es una accion de la PERSONA desde su cuenta, no del agente. \
             Que el cliente pueda llamarla convierte el enrolamiento en un tramite que \
             el binario completa solo."
        );
    }
}

/// Las tres del enrolamiento **producen** la credencial, asi que no la pueden exigir; las
/// siete del protocolo **la exigen todas**. Que el reparto sea dos funciones distintas y
/// no un `if` es lo que impide que el camino sin credencial quede disponible para una
/// llamada que si deberia mandarla.
#[test]
fn el_camino_sin_credencial_es_solo_el_del_enrolamiento() {
    let src = sin_comentarios(&fuente("protocolo/mod.rs"));
    let cuerpo = src
        .split_once("fn post_de_enrolamiento")
        .expect("tiene que existir el post del enrolamiento")
        .1;
    let hasta_el_fin = cuerpo.split("\n    fn ").next().unwrap();
    assert!(
        hasta_el_fin.contains("None"),
        "`post_de_enrolamiento` tiene que pasar `None` como autorizacion"
    );
    // Y el post normal NO puede pasar `None`: si lo hiciera, las siete llamadas del
    // protocolo saldrian sin header y el servidor las rechazaria todas — o peor, si el
    // servidor dejara de exigirlo, saldrian anonimas sin que nada avise.
    let normal = src
        .split_once("    fn post<R:")
        .expect("tiene que existir el post del protocolo")
        .1;
    let cuerpo_normal = normal.split("\n    fn ").next().unwrap();
    assert!(
        cuerpo_normal.contains("self.autorizacion()"),
        "las siete llamadas del protocolo tienen que mandar la credencial"
    );
}

/// El PUT prefirmado va a un host que **eligio la respuesta del servidor**. Mandarle el
/// token de dispositivo seria entregarselo a quien conteste.
#[test]
fn el_put_prefirmado_no_lleva_la_credencial() {
    let src = sin_comentarios(&fuente("protocolo/mod.rs"));
    let cuerpo = src
        .split_once("pub fn subir(")
        .expect("tiene que existir `subir`")
        .1;
    let hasta_el_fin = cuerpo.split("\n    pub fn ").next().unwrap();
    assert!(
        !hasta_el_fin.contains("autorizacion"),
        "`subir` no puede tocar la autorizacion: el destino del PUT lo elige la respuesta \
         del servidor, asi que el token se le estaria entregando a quien conteste."
    );
}

/// Todo lo que hay bajo `src/`, menos `src/bin/`. Se camina en vez de listarse a mano
/// para que un modulo nuevo quede cubierto sin que nadie se acuerde de agregarlo — que es
/// exactamente el caso en que un guardian de lista se vuelve decorativo.
fn fuentes_fuera_del_binario_de_ventana() -> Vec<(String, String)> {
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
                // **`bin/` ES LA UNICA EXCEPCION, Y ES EL PUNTO DE TODO ESTO.**
                if nombre == "bin" {
                    continue;
                }
                caminar(&e.path(), &rel, salida);
            } else if nombre.ends_with(".rs") {
                salida.push((
                    rel,
                    std::fs::read_to_string(e.path()).expect("fuente legible"),
                ));
            }
        }
    }
    let raiz = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut v = Vec::new();
    caminar(&raiz, "", &mut v);
    v
}

#[test]
fn el_nucleo_no_conoce_la_ventana() {
    // IMPORTA PORQUE: es la garantia que sostiene otras dos, y las dos se rompen en
    // silencio. **Una:** `pnpm nucleo:windows` cruza `--lib` a `x86_64-pc-windows-msvc`
    // para comprobar que el nucleo no se ata a macOS; el dia que `lib.rs` importe `objc2`
    // ese cruce deja de significar nada, porque lo que falle va a ser el cruce y no el
    // codigo. **Dos:** las pruebas corren sin levantar una ventana ni un runtime de
    // eventos, y por eso son deterministas y rapidas — un `tauri::` adentro del nucleo
    // arrastra ese runtime a `cargo test`.
    //
    // Lo afirme en dos comentarios («Un guardian lo comprueba») antes de que existiera.
    // Ahora existe.
    const PROHIBIDOS: [&str; 4] = ["tauri", "objc2", "block2", "webview"];

    let fuentes = fuentes_fuera_del_binario_de_ventana();

    // **SIN ESTO EL GUARDIAN PUEDE PASAR SIN MIRAR NADA**, y el primer intento de esta
    // comprobacion era exactamente eso: un piso de «al menos 12 fuentes». La raiz de
    // `src/` ya tiene 13 archivos sueltos, asi que el piso se cumplia **aunque el
    // caminado no bajara a ningun subdirectorio** — o sea sin mirar `plataforma/macos.rs`,
    // que es el unico lugar del nucleo donde `objc2` podria aparecer de verdad. Se
    // acredito rompiendolo y no murio.
    //
    // Lo que se comprueba ahora es la propiedad que importa: **que el caminado BAJE a
    // cada subdirectorio de `src/`**, menos `bin/`. Se deriva del disco en vez de
    // escribirse a mano, asi que un modulo nuevo en su propia carpeta queda cubierto sin
    // que nadie se acuerde.
    let esperados: Vec<String> =
        std::fs::read_dir(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src"))
            .expect("src/ legible")
            .filter_map(Result::ok)
            .filter(|e| e.path().is_dir() && e.file_name() != "bin")
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect();
    for dir in &esperados {
        assert!(
            fuentes
                .iter()
                .any(|(rel, _)| rel.starts_with(&format!("{dir}/"))),
            "el guardian no bajo a src/{dir}/: esta mirando menos de lo que dice"
        );
    }
    assert!(
        fuentes.iter().any(|(rel, _)| !rel.contains('/')),
        "el guardian no vio ni un fuente en la raiz de src/"
    );

    for (archivo, src) in &fuentes {
        // Los comentarios de este crate NOMBRAN a Tauri a cada rato —explicando
        // justamente por que no esta— asi que se miran solo si sobreviven al recorte.
        let codigo = sin_comentarios(src);
        for prohibido in PROHIBIDOS {
            assert!(
                !codigo.contains(prohibido),
                "src/{archivo} nombra `{prohibido}`: el runtime de ventana vive en \
                 `src/bin/bandeja/` y en ningun otro lado"
            );
        }
    }
}
