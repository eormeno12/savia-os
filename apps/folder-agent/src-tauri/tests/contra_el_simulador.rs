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
use savia_folder_nucleo::colas::MotivoDeDetencion;
use savia_folder_nucleo::colas::ParametrosDeCola;
use savia_folder_nucleo::dominio::{BarridoId, RaizId, SensibilidadAMayusculas};
#[cfg(target_os = "macos")]
use savia_folder_nucleo::plataforma::Macos as PlataformaLocal;
#[cfg(target_os = "windows")]
use savia_folder_nucleo::plataforma::Windows as PlataformaLocal;
use savia_folder_nucleo::plataforma::{Plataforma, RaizRegistrada};
use savia_folder_nucleo::protocolo::{
    BaseDeApi, Cliente, Credencial, Reclamo, Tiempos, transporte,
};
use savia_folder_nucleo::salvaguardas::Politica;
use std::time::Duration;

/// Parametros del BANCO, no del producto.
const ASENTAMIENTO: Duration = Duration::from_millis(120);
const BASE: &str = "http://127.0.0.1:4477";
const AUTORIDAD: &str = "127.0.0.1:4477";

fn tiempos() -> Tiempos {
    Tiempos {
        conexion: Duration::from_secs(5),
        por_llamada: Duration::from_secs(30),
        envio_de_cuerpo: None,
    }
}

/// EL HUMANO, Y EN EL BANCO TIENE QUE SER CODIGO DEL BANCO. `Cliente` no tiene ningun
/// metodo que llame a `/enroll/approve` ni a `/enroll/revoke`, asi que estas dos son
/// forzosamente HTTP a mano desde acá — y esa imposibilidad ES la propiedad que el
/// codigo corto compra. El dia que alguien le agregue `aprobar()` al cliente, esta
/// funcion deja de tener razon de existir y hay que justificar por que el agente se
/// aprueba solo.
fn como_humano(ruta: &str, cuerpo: String) {
    let r = transporte::pedir(
        AUTORIDAD,
        "POST",
        ruta,
        cuerpo.as_bytes(),
        Some("application/json"),
        None,
        &tiempos(),
    )
    .expect("el simulador tiene que estar corriendo");
    assert_eq!(r.codigo, 200, "{ruta} fallo: {}", r.cuerpo);
}

/// Un dispositivo vinculado DE VERDAD: `begin` → (el humano aprueba) → `claim`.
///
/// Afirma en el medio que sin aprobacion no hay token, asi que ninguna prueba de este
/// archivo puede quedar verde contra un servidor que reparta credenciales sin humano.
fn credencial_enrolada() -> (Credencial, String) {
    let sin_vincular = Cliente::nuevo(
        BaseDeApi::nueva(BASE).unwrap(),
        Credencial::SinAutenticar,
        tiempos(),
    );
    let v = sin_vincular.enrolar().unwrap();
    assert!(
        matches!(sin_vincular.reclamar(&v).unwrap(), Reclamo::Pendiente),
        "sin aprobacion humana no puede haber token"
    );
    como_humano(
        "/enroll/approve",
        format!(r#"{{"code":"{}","userId":"user-banco"}}"#, v.codigo),
    );
    match sin_vincular.reclamar(&v).unwrap() {
        Reclamo::Aprobado { token, .. } => {
            let crudo = token.0.clone();
            (Credencial::TokenDeDispositivo(token), crudo)
        }
        otro => panic!("se esperaba una vinculacion aprobada, vino {otro:?}"),
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
        credencial_enrolada().0,
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
        credencial_enrolada().0,
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
        credencial_enrolada().0,
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

#[test]
#[ignore = "necesita `node apps/folder-agent/sim/server.ts` corriendo en 4477"]
fn un_agente_que_perdio_su_inventario_recupera_el_desfase_por_el_padron() {
    // IMPORTA PORQUE: es el agujero entero del canal, de punta a punta y sobre sockets.
    // Un barrido incremental NO REPORTA LO QUE SIGUE IGUAL, asi que un agente que llega
    // sin memoria no reporta esos archivos ni presentes ni ausentes — y un documento
    // borrado mientras estuvo caido se queda vigente en Savia PARA SIEMPRE. Las 42
    // pruebas contra puertos falsos verifican que el agente ARMA bien el padron, y el
    // ejercicio del simulador que Savia lo APLICA bien; esta es la unica que verifica que
    // las dos mitades se encuentran.
    //
    // CUATRO ARCHIVOS Y SE BORRA UNO a proposito: 1/4 = 25%, por debajo del corte por
    // volumen del banco (30%). Con dos archivos la diferencia seria del 50% y el test
    // estaria probando el corte en vez del padron.
    let dir = std::env::temp_dir().join(format!(
        "savia-folder-padron-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    let nonce = dir.file_name().unwrap().to_string_lossy().to_string();
    for i in 0..4 {
        std::fs::write(dir.join(format!("f{i}.txt")), format!("el {i} de {nonce}")).unwrap();
    }

    let plataforma = PlataformaLocal::nueva().unwrap();
    let ruta = std::fs::canonicalize(&dir).unwrap();
    let raiz = RaizId::nueva(format!("padron-{nonce}"));
    let cliente = Cliente::nuevo(
        BaseDeApi::nueva(BASE).unwrap(),
        credencial_enrolada().0,
        tiempos(),
    );
    let politica = Politica::con_asentamiento(ASENTAMIENTO).unwrap();
    let nuevo_almacen = || {
        let mut a = Almacen::nuevo(ParametrosDeCola {
            max_intentos: None,
            max_entradas_por_lote: None,
        });
        a.enrolar(RaizRegistrada {
            id: raiz.clone(),
            huella: plataforma.huella_de_raiz(&ruta).unwrap(),
            ruta_absoluta: ruta.clone(),
            sensibilidad: SensibilidadAMayusculas::NoDistingue,
        });
        a
    };
    let vuelta = |n: u32, almacen: &mut Almacen| -> Vec<String> {
        std::thread::sleep(ASENTAMIENTO);
        ciclo::barrer(
            &raiz,
            BarridoId::nuevo(format!("b{n}")),
            &plataforma,
            almacen,
            &politica,
        );
        let mut traza = Vec::new();
        ciclo::drenar(&raiz, &plataforma, almacen, &cliente, &mut traza);
        traza
    };

    // 1 · el agente sano: dos vueltas y Savia tiene los cuatro.
    let mut sano = nuevo_almacen();
    vuelta(1, &mut sano);
    let t2 = vuelta(2, &mut sano);
    assert!(
        t2.iter().any(|l| l.starts_with("presence.observed x4")),
        "los cuatro llegaron a Savia: {t2:?}"
    );
    assert!(
        !t2.iter().any(|l| l.starts_with("presence.roster")),
        "y coincidiendo NO se manda ningun padron: {t2:?}"
    );

    // 2 · el agente se cae, y mientras esta caido se borra un archivo.
    drop(sano);
    std::fs::remove_file(dir.join("f2.txt")).unwrap();

    // 3 · vuelve SIN inventario. Savia compara su cuenta contra el `total` y pide el
    //     padron; el agente manda las TRES rutas que ve.
    let mut amnesico = nuevo_almacen();
    let t3 = vuelta(3, &mut amnesico);
    assert!(
        t3.iter().any(|l| l.starts_with("sweep.open total=0")),
        "arranca creyendo la raiz vacia: {t3:?}"
    );
    assert!(
        t3.iter().any(|l| l == "sweep.open -> PADRON REQUERIDO"),
        "y Savia lo nota, porque el numero ya viajaba: {t3:?}"
    );
    assert!(
        t3.iter().any(|l| l.starts_with("presence.roster x3")),
        "manda las tres que VE, no las cuatro que Savia cree: {t3:?}"
    );

    // 4 · la diferencia entro a cuarentena, no a retiro. Recien pasada la ventana y con
    //     otro barrido COMPLETO encima, `f2.txt` se retira.
    assert!(
        !t3.iter().any(|l| l.starts_with("  retirados")),
        "una desaparicion sigue siendo una hipotesis aunque la descubra una diferencia \
         de conjuntos: {t3:?}"
    );
    std::thread::sleep(Duration::from_millis(5_200));
    let t4 = vuelta(4, &mut amnesico);
    assert!(
        t4.iter().any(|l| l == "  retirados: f2.txt"),
        "el documento que iba a quedar vigente para siempre se retiro: {t4:?}"
    );

    std::fs::remove_dir_all(&dir).ok();
}

/// **EL CAMINO QUE NO EJERCIA NADA.** La cola tiene desde el principio la regla «un error
/// de credenciales para y avisa» —`Desenlace::Credenciales` detiene el DISPOSITIVO
/// ENTERO, no la raiz, porque el token es por persona y no por carpeta—, y hasta ahora
/// esa regla no la disparaba ninguna prueba de integracion: el cliente mandaba
/// `SinAutenticar`, el simulador no miraba headers, y ningun 401 nacia nunca.
///
/// Se acredita con una REVOCACION y no con un token inventado, porque son dos cosas
/// distintas: un token basura prueba que el servidor rechaza basura; un token que fue
/// valido y dejo de serlo prueba lo que le pasa a un dispositivo real cuando su duena lo
/// da de baja desde su cuenta — una laptop robada, o una que dejo de ser suya.
#[test]
#[ignore = "necesita `node apps/folder-agent/sim/server.ts` corriendo en 4477"]
fn un_token_revocado_detiene_el_dispositivo_entero() {
    let dir = std::env::temp_dir().join(format!(
        "savia-folder-revoca-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    let nonce = dir.file_name().unwrap().to_string_lossy().to_string();
    std::fs::write(dir.join("acta.txt"), format!("un acta {nonce}")).unwrap();

    let plataforma = PlataformaLocal::nueva().unwrap();
    let ruta = std::fs::canonicalize(&dir).unwrap();
    let raiz = RaizId::nueva(format!("revoca-{nonce}"));
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

    let (credencial, token) = credencial_enrolada();
    let cliente = Cliente::nuevo(BaseDeApi::nueva(BASE).unwrap(), credencial, tiempos());
    let politica = Politica::con_asentamiento(ASENTAMIENTO).unwrap();

    // Dos vueltas SIN drenar: el asentamiento exige dos observaciones, y recien la
    // segunda encola la aparicion. Se drena despues de revocar, a proposito.
    for n in 1..=2 {
        std::thread::sleep(ASENTAMIENTO);
        ciclo::barrer(
            &raiz,
            BarridoId::nuevo(format!("b{n}")),
            &plataforma,
            &mut almacen,
            &politica,
        );
    }
    assert!(
        almacen.colas().detenido().is_none(),
        "hasta acá el dispositivo tiene que estar sano: si ya estuviera detenido, la afirmación de abajo sería verde sin que la revocación hiciera nada"
    );

    como_humano("/enroll/revoke", format!(r#"{{"deviceToken":"{token}"}}"#));

    let mut traza = Vec::new();
    ciclo::drenar(&raiz, &plataforma, &mut almacen, &cliente, &mut traza);

    assert_eq!(
        almacen.colas().detenido(),
        Some(MotivoDeDetencion::Credenciales),
        "un 401 tiene que detener el dispositivo entero: {traza:?}"
    );
}

#[test]
#[ignore = "necesita el simulador: pnpm --filter @savia-os/folder-agent sim"]
fn el_congelamiento_de_savia_llega_hasta_el_agente() {
    let dir = std::env::temp_dir().join(format!(
        "savia-folder-congela-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    let nonce = dir.file_name().unwrap().to_string_lossy().to_string();
    for n in 1..=2 {
        std::fs::write(
            dir.join(format!("acta-{n}.txt")),
            format!("acta {n} de {nonce}"),
        )
        .unwrap();
    }

    let plataforma = PlataformaLocal::nueva().unwrap();
    let ruta = std::fs::canonicalize(&dir).unwrap();
    let raiz = RaizId::nueva(format!("congela-{nonce}"));
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

    let (credencial, _) = credencial_enrolada();
    let cliente = Cliente::nuevo(BaseDeApi::nueva(BASE).unwrap(), credencial, tiempos());
    let politica = Politica::con_asentamiento(ASENTAMIENTO).unwrap();
    let mut traza = Vec::new();
    let mut vuelta = 0;
    let mut ciclo_completo = |almacen: &mut Almacen, traza: &mut Vec<String>| {
        vuelta += 1;
        std::thread::sleep(ASENTAMIENTO);
        ciclo::barrer(
            &raiz,
            BarridoId::nuevo(format!("b{vuelta}")),
            &plataforma,
            almacen,
            &politica,
        );
        ciclo::drenar(&raiz, &plataforma, almacen, &cliente, traza);
    };

    // Dos vueltas: el asentamiento exige dos observaciones para que la aparicion se
    // encole, y la segunda ademas sube los bytes.
    ciclo_completo(&mut almacen, &mut traza);
    ciclo_completo(&mut almacen, &mut traza);
    assert!(
        !almacen.colas().congelada(&raiz),
        "hasta acá la raíz tiene que estar sana: si ya estuviera congelada, la afirmación de abajo sería verde sin que el borrado masivo hiciera nada. Traza: {traza:?}"
    );

    // EL BORRADO MASIVO: los dos archivos de golpe son el 100% de lo vivo, muy por
    // encima del corte por volumen del simulador. Savia congela la raíz, y el agente
    // **tiene que enterarse** — es uno de los cuatro estados que el panel muestra.
    for n in 1..=2 {
        std::fs::remove_file(dir.join(format!("acta-{n}.txt"))).unwrap();
    }
    ciclo_completo(&mut almacen, &mut traza);
    assert!(
        almacen.colas().congelada(&raiz),
        "`sweep.close` contestó `frozen` y el agente lo tiró: sin esto el panel muestra «Sincronizado» sobre una raíz que Savia está reteniendo. Traza: {traza:?}"
    );

    // Y EL DESHIELO, que es la mitad que se olvida. Un barrido completo más sobre la
    // misma raíz es la evidencia que el congelamiento exigía; Savia la suelta y contesta
    // `frozen: false`. Si el agente solo supiera INSERTAR, la raíz quedaría congelada en
    // el panel para siempre.
    ciclo_completo(&mut almacen, &mut traza);
    assert!(
        !almacen.colas().congelada(&raiz),
        "un `frozen: false` tiene que descongelar, no ser ignorado por no traer novedad. Traza: {traza:?}"
    );
}
