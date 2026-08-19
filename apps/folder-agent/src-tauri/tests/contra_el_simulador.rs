//! EL BANCO DE INTEGRACION: el nucleo contra `apps/folder-agent/sim/server.ts`, sobre
//! sockets de verdad.
//!
//! **Va `#[ignore]` a proposito**, y no por comodidad: `cargo test` tiene que pasar en una
//! maquina sin nada levantado, y una prueba que depende de un proceso externo o es
//! opt-in o es intermitente. Se corre asi:
//!
//! ```text
//!   node apps/folder-agent/sim/server.ts &
//!   cargo test -- --ignored --test-threads=1
//! ```
//!
//! Por que existe habiendo 36 pruebas contra puertos falsos: los falsos no pueden
//! atrapar un problema de TRANSPORTE. El primero que aparecio fue justamente eso — Node
//! contesta `Transfer-Encoding: chunked` aunque se le pida `Connection: close`, `serde`
//! no reconocia el `sweepId` envuelto en los marcadores de tamano, y el `Sobre` lo
//! clasificaba como cuerpo malformado: o sea COLA MUERTA por un problema de red. Ningun
//! doble de HTTP lo habria mostrado, que es la razon por la que el diseno de `protocolo`
//! decide NO tener un `trait ClienteHttp`.

use savia_folder_nucleo::almacen::Almacen;
use savia_folder_nucleo::ciclo;
use savia_folder_nucleo::colas::ParametrosDeCola;
use savia_folder_nucleo::dominio::{BarridoId, RaizId, SensibilidadAMayusculas};
#[cfg(target_os = "macos")]
use savia_folder_nucleo::plataforma::Macos as PlataformaLocal;
#[cfg(target_os = "windows")]
use savia_folder_nucleo::plataforma::Windows as PlataformaLocal;
use savia_folder_nucleo::plataforma::{Plataforma, RaizRegistrada};
use savia_folder_nucleo::protocolo::{BaseDeApi, Cliente, Credencial, Tiempos};
use savia_folder_nucleo::salvaguardas::Politica;
use std::time::Duration;

/// Parametros del BANCO, no del producto.
const ASENTAMIENTO: Duration = Duration::from_millis(120);
const BASE: &str = "http://127.0.0.1:4477";

fn tiempos() -> Tiempos {
    Tiempos {
        conexion: Duration::from_secs(5),
        por_llamada: Duration::from_secs(30),
        envio_de_cuerpo: None,
    }
}

#[test]
#[ignore = "necesita `node apps/folder-agent/sim/server.ts` corriendo en 4477"]
fn el_ciclo_entero_contra_el_simulador() {
    let dir = std::env::temp_dir().join(format!(
        "savia-folder-banco-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(dir.join("sub")).unwrap();
    // EL CONTENIDO LLEVA UN NONCE, y el banco lo aprendio fallando: el simulador
    // deduplica por CONTENIDO y guarda estado entre corridas, asi que con bytes fijos la
    // segunda ejecucion contesta `known` y no hay ningun PUT que observar. Que la
    // afirmacion «la primera vez se transfieren bytes» se rompa sola cuando el contenido
    // se repite es, de hecho, el dedupe funcionando.
    let nonce = dir.file_name().unwrap().to_string_lossy().to_string();
    std::fs::write(
        dir.join("contrato.docx"),
        format!("el contrato marco {nonce}"),
    )
    .unwrap();
    std::fs::write(
        dir.join("sub/informe.xlsx"),
        format!("el informe q3 {nonce}"),
    )
    .unwrap();

    let plataforma = PlataformaLocal::nueva().unwrap();
    let ruta = std::fs::canonicalize(&dir).unwrap();
    let raiz = RaizId::nueva(format!("banco-{}", ruta.to_string_lossy().len()));
    let huella = plataforma.huella_de_raiz(&ruta).unwrap();
    let mut almacen = Almacen::nuevo(ParametrosDeCola {
        max_intentos: None,
        max_entradas_por_lote: None,
    });
    almacen.enrolar(RaizRegistrada {
        id: raiz.clone(),
        huella,
        ruta_absoluta: ruta.clone(),
        sensibilidad: SensibilidadAMayusculas::NoDistingue,
    });
    let cliente = Cliente::nuevo(
        BaseDeApi::nueva(BASE).unwrap(),
        Credencial::SinAutenticar,
        tiempos(),
    );
    let politica = Politica::con_asentamiento(ASENTAMIENTO).unwrap();

    let vuelta = |n: u32, almacen: &mut Almacen| -> (ciclo::ResumenDelBarrido, Vec<String>) {
        std::thread::sleep(ASENTAMIENTO);
        let r = ciclo::barrer(
            &raiz,
            BarridoId::nuevo(format!("b{n}")),
            &plataforma,
            almacen,
            &politica,
        );
        let mut traza = Vec::new();
        ciclo::drenar(&raiz, &plataforma, almacen, &cliente, &mut traza);
        (r, traza)
    };

    // 1 y 2 · el asentamiento exige dos observaciones; recien la segunda hashea y sube.
    let (r1, _) = vuelta(1, &mut almacen);
    assert_eq!(r1.esperando, 2, "la primera vuelta solo anota candidatos");
    let (r2, t2) = vuelta(2, &mut almacen);
    assert_eq!(r2.apariciones, 2);
    assert!(
        t2.iter().any(|x| x.starts_with("PUT ")),
        "la primera vez se transfieren bytes: {t2:?}"
    );

    // 3 · se borra uno. LA BAJA SALE, porque la raiz esta viva y el contenido no
    //     reaparece en ninguna ruta nueva.
    std::fs::remove_file(dir.join("sub/informe.xlsx")).unwrap();
    let (r3, t3) = vuelta(3, &mut almacen);
    assert_eq!(r3.bajas, 1, "la baja se observa y se reporta");
    assert!(
        t3.iter().any(|x| x.starts_with("presence.vanished")),
        "y viaja como `presence.vanished`, que reporta un HECHO OBSERVADO y no pide un retiro: {t3:?}"
    );

    // 4 · se mueve el que queda. NO sale nada: el movimiento muere en el agente y ni
    //     siquiera cuesta leerlo.
    std::fs::create_dir_all(dir.join("otra")).unwrap();
    std::fs::rename(dir.join("contrato.docx"), dir.join("otra/contrato.docx")).unwrap();
    let (r4, t4) = vuelta(4, &mut almacen);
    assert_eq!(r4.bajas, 0, "mover no es borrar");
    assert_eq!(r4.apariciones, 0, "y tampoco es un alta");
    assert_eq!(r4.movimientos, 1);
    assert!(
        !t4.iter().any(|x| x.starts_with("presence.vanished")),
        "el movimiento NO llega al servidor: {t4:?}"
    );

    std::fs::remove_dir_all(&dir).ok();
}

#[test]
#[ignore = "necesita `node apps/folder-agent/sim/server.ts` corriendo en 4477"]
fn el_dedupe_previo_a_la_transferencia_ahorra_los_bytes() {
    // IMPORTA PORQUE: es la razon entera de las dos colas. Sin esto, cuarenta maquinas
    // con la misma presentacion la suben cuarenta veces. Y con el inventario perdido, el
    // costo es UN BARRIDO, no una re-subida.
    let cliente = Cliente::nuevo(
        BaseDeApi::nueva(BASE).unwrap(),
        Credencial::SinAutenticar,
        tiempos(),
    );
    let raiz = RaizId::nueva("banco-dedupe");
    let contenido = format!("contenido unico {}", std::process::id());
    let h = savia_folder_nucleo::hash::sha256(contenido.as_bytes());
    let ruta = savia_folder_nucleo::dominio::RutaRelativa::canonica("x.txt").unwrap();

    let vs = cliente
        .reportar_observados(&raiz, &[(ruta.clone(), h)])
        .expect("presence.observed");
    let permiso = match &vs[0].decision {
        savia_folder_nucleo::colas::Decision::Upload { permiso } => permiso.clone(),
        savia_folder_nucleo::colas::Decision::Known { .. } => {
            panic!("sin bytes en el almacen no hay nada que deduplicar: tiene que pedir upload")
        }
    };
    let subido = cliente.subir(&permiso, contenido.as_bytes()).expect("PUT");
    assert_eq!(subido.bytes_enviados(), contenido.len() as u64);
    let c = cliente.confirmar_subida(subido).expect("upload.completed");
    assert!(!c.divergio, "no cambio entre el hasheo y el PUT");
    assert_eq!(
        c.verificado.hex(),
        h.hex(),
        "el verificado es el que computo quien LEYO los bytes; aca coinciden"
    );

    // Segunda vez: cero bytes.
    let vs = cliente
        .reportar_observados(&raiz, &[(ruta, h)])
        .expect("presence.observed");
    assert!(
        matches!(
            vs[0].decision,
            savia_folder_nucleo::colas::Decision::Known { .. }
        ),
        "la segunda vez sale `known` y no se transfiere un byte"
    );
}

#[test]
#[ignore = "necesita `node apps/folder-agent/sim/server.ts` corriendo en 4477"]
fn la_divergencia_vuelve_en_el_hash_verificado() {
    // IMPORTA PORQUE: entre que el agente hashea y que termina el PUT, el archivo puede
    // cambiar. Sin este retorno, el agente y el registro creen cosas distintas del mismo
    // archivo PARA SIEMPRE, y una desaparicion posterior no matchea con nada.
    let cliente = Cliente::nuevo(
        BaseDeApi::nueva(BASE).unwrap(),
        Credencial::SinAutenticar,
        tiempos(),
    );
    let raiz = RaizId::nueva("banco-divergencia");
    let afirmado = savia_folder_nucleo::hash::sha256(b"lo que vi");
    let ruta = savia_folder_nucleo::dominio::RutaRelativa::canonica("movil.txt").unwrap();
    let vs = cliente
        .reportar_observados(&raiz, &[(ruta, afirmado)])
        .unwrap();
    let savia_folder_nucleo::colas::Decision::Upload { permiso } = &vs[0].decision else {
        panic!("contenido nuevo: tiene que pedir upload")
    };
    // Se suben OTROS bytes: el archivo cambio entre el hasheo y el PUT.
    let subido = cliente.subir(permiso, b"lo que subi").unwrap();
    let c = cliente.confirmar_subida(subido).unwrap();
    assert!(
        c.divergio,
        "el servidor detecta que lo afirmado no es lo que llego"
    );
    assert_eq!(
        c.verificado.hex(),
        savia_folder_nucleo::hash::sha256(b"lo que subi").hex(),
        "y devuelve LA AUTORIDAD, que es con lo que el agente corrige su inventario"
    );
}
