//! LO QUE UNA PERSONA VE, y por que la precedencia entre los cuatro estados es una
//! decision y no un `match` cualquiera.
//!
//! Todo lo de acá corre contra la plataforma falsa: `panel::vista` no toca disco ni red
//! —deriva del `Almacen` y de una lectura de la raiz—, asi que se ejercita entera sin
//! nada levantado.

use savia_folder_aplicacion::ciclo;
use savia_folder_aplicacion::panel::{
    self, EstadoDeArchivo, EstadoDeCarpeta, Motivo, MotivoDeArchivoFallido,
};
use savia_folder_contrato::colas::{Decision, SweepId, Veredicto};
use savia_folder_contrato::dominio::{
    BarridoId, HashVerificado, IdDeArchivoDelSO, RaizId, SensibilidadAMayusculas,
};
use savia_folder_contrato::plataforma::{HuellaDeRaiz, IdDeVolumen, RaizRegistrada};
use savia_folder_estado::almacen::Almacen;
use savia_folder_estado::colas::{Desenlace, ParametrosDeCola, Proximo, Recibido, Trabajo};
use savia_folder_plataforma_falsa::falsa::Falsa;
use savia_folder_politica::salvaguardas::Politica;
use std::time::Duration;

const ASENTAMIENTO_DEL_BANCO: Duration = Duration::from_secs(30);
/// El tope del BANCO, no del producto: `parametros::MAX_FILAS_DEL_PANEL` sigue en `None`.
const TOPE: usize = 3;

fn raiz() -> RaizId {
    RaizId::nueva("root-1")
}

fn registrada() -> RaizRegistrada {
    RaizRegistrada {
        id: raiz(),
        huella: Falsa::huella_del_banco(),
        ruta_absoluta: std::path::PathBuf::from("/Usuarios/nadie/Savia"),
        sensibilidad: SensibilidadAMayusculas::Distingue,
    }
}

fn politica() -> Politica {
    Politica::con_asentamiento(ASENTAMIENTO_DEL_BANCO).expect("el banco lo provee")
}

fn almacen() -> Almacen {
    let mut a = Almacen::nuevo(ParametrosDeCola {
        max_intentos: None,
        max_entradas_por_lote: None,
    });
    a.enrolar(registrada());
    a
}

/// Barre y contesta como un servidor que dice `known` a todo: las filas quedan con hash
/// CONFIRMADO, que es lo unico que el panel muestra como `indexado`.
fn barrer_y_confirmar(p: &Falsa, a: &mut Almacen, n: u32) {
    ciclo::barrer(
        &raiz(),
        BarridoId::nuevo(format!("b{n}")),
        p,
        a,
        &politica(),
    );
    drenar_con(a, |t| match *t {
        Trabajo::AbrirBarrido { id, .. } => (
            id,
            Recibido::Barrido {
                sweep: SweepId(format!("sweep-{n}")),
                padron_requerido: false,
            },
        ),
        Trabajo::Observar { id, entradas, .. } => (
            id,
            Recibido::Decisiones(
                entradas
                    .into_iter()
                    .map(|(ruta, afirmado)| Veredicto {
                        ruta,
                        afirmado,
                        decision: Decision::Known {
                            verificado: HashVerificado::rehidratar_del_inventario(
                                *afirmado.bytes(),
                            ),
                        },
                    })
                    .collect(),
            ),
        ),
        Trabajo::CerrarBarrido { id, .. } => (
            id,
            Recibido::Retirados {
                rutas: Vec::new(),
                congelada: false,
            },
        ),
        Trabajo::EnviarPadron { id, .. }
        | Trabajo::Desvanecer { id, .. }
        | Trabajo::Subir { id, .. }
        | Trabajo::ConfirmarSubida { id, .. } => (id, Recibido::Nada),
    });
}

fn drenar_con(
    a: &mut Almacen,
    mut responder: impl FnMut(Box<Trabajo>) -> (savia_folder_estado::colas::TrabajoId, Recibido),
) {
    while let Proximo::Trabajo(t) = a.siguiente(&raiz()) {
        let (id, recibido) = responder(t);
        a.resolver(&raiz(), &id, Desenlace::Entregado(recibido));
    }
}

// ══════════════════════════ Los cuatro estados ══════════════════════════════

#[test]
fn una_raiz_al_dia_dice_sincronizado() {
    let p = Falsa::como_macos();
    p.poner("contrato.docx", b"uno", 100, Some(1));
    let mut a = almacen();
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);

    let v = panel::vista(&a, &p, TOPE);
    assert_eq!(v.estado, EstadoDeCarpeta::Sincronizado);
    assert_eq!(v.carpetas.len(), 1);
    assert_eq!(v.carpetas[0].filas.len(), 1);
    assert_eq!(v.carpetas[0].filas[0].estado, EstadoDeArchivo::Indexado);
    assert_eq!(v.carpetas[0].indexados, 1);
}

#[test]
fn el_disco_desmontado_le_gana_a_todo_lo_demas() {
    let p = Falsa::como_macos();
    p.poner("contrato.docx", b"uno", 100, Some(1));
    let mut a = almacen();
    barrer_y_confirmar(&p, &mut a, 1);

    // Un barrido ABIERTO y sin cerrar: si la precedencia no existiera, esto diria
    // «Barriendo» sobre un disco que no esta.
    a.abrir_barrido(&raiz(), BarridoId::nuevo("b2"));
    p.desmontar();

    let v = panel::vista(&a, &p, TOPE);
    assert!(
        matches!(
            v.carpetas[0].estado,
            EstadoDeCarpeta::CarpetaAusente {
                porque: Motivo::NoSeAlcanza
            }
        ),
        "con el disco fuera ningun otro estado es averiguable: {:?}",
        v.carpetas[0].estado
    );
}

#[test]
fn el_suplente_se_dice_distinto_del_disco_que_no_esta() {
    let p = Falsa::como_macos();
    p.poner("contrato.docx", b"uno", 100, Some(1));
    let mut a = almacen();
    barrer_y_confirmar(&p, &mut a, 1);

    p.suplantar();

    let v = panel::vista(&a, &p, TOPE);
    assert!(
        matches!(
            v.carpetas[0].estado,
            EstadoDeCarpeta::CarpetaAusente {
                porque: Motivo::OtraCarpeta
            }
        ),
        "«hay otra carpeta en esa ruta» es lo unico de los dos motivos que pide una decision del usuario, y colapsarlo con «no se alcanza» le pediria que reconecte un disco que esta conectado: {:?}",
        v.carpetas[0].estado
    );
}

#[test]
fn congelado_le_gana_a_barriendo() {
    let p = Falsa::como_macos();
    p.poner("contrato.docx", b"uno", 100, Some(1));
    let mut a = almacen();
    barrer_y_confirmar(&p, &mut a, 1);

    // El cierre del barrido 2 vuelve congelado...
    ciclo::barrer(&raiz(), BarridoId::nuevo("b2"), &p, &mut a, &politica());
    drenar_con(&mut a, |t| match *t {
        Trabajo::CerrarBarrido { id, .. } => (
            id,
            Recibido::Retirados {
                rutas: Vec::new(),
                congelada: true,
            },
        ),
        Trabajo::AbrirBarrido { id, .. } => (
            id,
            Recibido::Barrido {
                sweep: SweepId("sweep-2".into()),
                padron_requerido: false,
            },
        ),
        Trabajo::Observar { id, .. } => (id, Recibido::Decisiones(Vec::new())),
        Trabajo::EnviarPadron { id, .. }
        | Trabajo::Desvanecer { id, .. }
        | Trabajo::Subir { id, .. }
        | Trabajo::ConfirmarSubida { id, .. } => (id, Recibido::Nada),
    });
    assert_eq!(
        panel::vista(&a, &p, TOPE).estado,
        EstadoDeCarpeta::Congelado
    );

    // ...y ahora ademas hay un barrido abierto. Barrer dura segundos y se resuelve solo;
    // congelado dura barridos y es lo unico de los cuatro que dice que paso algo que el
    // usuario no pidio. Taparlo justo mientras se resuelve es taparlo cuando importa.
    a.abrir_barrido(&raiz(), BarridoId::nuevo("b3"));
    assert_eq!(
        panel::vista(&a, &p, TOPE).estado,
        EstadoDeCarpeta::Congelado
    );
}

#[test]
fn un_barrido_abierto_dice_barriendo() {
    let p = Falsa::como_macos();
    p.poner("contrato.docx", b"uno", 100, Some(1));
    let mut a = almacen();
    barrer_y_confirmar(&p, &mut a, 1);
    a.abrir_barrido(&raiz(), BarridoId::nuevo("b2"));

    assert_eq!(
        panel::vista(&a, &p, TOPE).estado,
        EstadoDeCarpeta::Barriendo
    );
}

#[test]
fn el_contador_de_fallos_no_se_topea() {
    let p = Falsa::como_macos();
    p.poner("contrato.docx", b"uno", 100, Some(1));
    let mut a = almacen();
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);
    envenenar(&p, &mut a, "contrato.docx");

    // Tope CERO: no entra ni una fila. El contador tiene que seguir diciendo que hay un
    // fallo, porque es lo unico que va a llegar al agregado — y el agregado es lo unico
    // visible con el panel cerrado.
    let v = panel::vista(&a, &p, 0);
    assert!(v.carpetas[0].filas.is_empty(), "el tope es 0");
    assert_eq!(
        v.fallos, 1,
        "un contador que se topea miente justo cuando mas hay que contar: con mas fallos que lugar en la lista, la bandeja diria que no pasa nada"
    );
    assert_eq!(v.carpetas[0].fallos, 1);
}

// ═══════════════════════════ El agregado ════════════════════════════════════

#[test]
fn el_agregado_es_el_peor_y_no_el_mas_comun() {
    let p = Falsa::como_macos();
    p.poner("contrato.docx", b"uno", 100, Some(1));
    let mut a = almacen();
    barrer_y_confirmar(&p, &mut a, 1);

    // Una segunda raiz enrolada con OTRA huella. La falsa contesta la misma evidencia
    // para las dos —no sabe de raices—, pero `raiz_viva` compara contra la huella que
    // cada una registro al enrolar: la primera coincide y la segunda no. O sea: una
    // sana y una ausente, que es exactamente el caso que el agregado tiene que resolver.
    a.enrolar(RaizRegistrada {
        id: RaizId::nueva("root-2"),
        huella: HuellaDeRaiz {
            volumen: IdDeVolumen::Uuid([9u8; 16]),
            directorio: IdDeArchivoDelSO(2),
        },
        ruta_absoluta: std::path::PathBuf::from("/Volumenes/Archivo"),
        sensibilidad: SensibilidadAMayusculas::Distingue,
    });

    let v = panel::vista(&a, &p, TOPE);
    assert_eq!(v.carpetas.len(), 2);
    assert_eq!(
        v.carpetas
            .iter()
            .filter(|c| c.estado == EstadoDeCarpeta::Sincronizado)
            .count(),
        1,
        "una de las dos tiene que estar sana, o el agregado no elige nada"
    );
    assert!(
        matches!(v.estado, EstadoDeCarpeta::CarpetaAusente { .. }),
        "el icono de la bandeja tiene que decir que algo pasa aunque la mayoria este bien: {:?}",
        v.estado
    );
}

// ══════════════════════ El orden y el tope de filas ═════════════════════════

#[test]
fn lo_que_pide_atencion_no_se_esconde_detras_del_tope() {
    let p = Falsa::como_macos();
    for n in 1..=5 {
        p.poner(
            &format!("doc-{n}.docx"),
            format!("c{n}").as_bytes(),
            100,
            Some(n),
        );
    }
    let mut a = almacen();
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);

    // Uno solo cambia y su hash queda AFIRMADO: el agente lo leyo, Savia no contesto.
    // Van DOS barridos porque el asentamiento exige ver la misma tripleta dos veces —el
    // primero solo anota el candidato— y el segundo NO se drena, que es lo que deja la
    // fila en afirmado.
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    p.poner("doc-5.docx", b"c5-editado", 200, Some(5));
    ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), &p, &mut a, &politica());
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b4"), &p, &mut a, &politica());

    let v = panel::vista(&a, &p, 1);
    assert_eq!(v.carpetas[0].filas.len(), 1, "el tope es 1");
    assert_eq!(
        v.carpetas[0].filas[0].estado,
        EstadoDeArchivo::Procesando,
        "con lugar para una sola fila, la que se muestra es la que esta pasando algo — no la primera alfabeticamente"
    );
    assert_eq!(v.carpetas[0].filas[0].ruta, "doc-5.docx");
    assert_eq!(
        v.carpetas[0].ocultas, 4,
        "y las que quedaron afuera se CUENTAN: sin ese numero la lista parece ser todo lo que hay"
    );
    assert_eq!(v.carpetas[0].indexados, 4);
}

#[test]
fn la_lapida_se_muestra_como_retirado() {
    let p = Falsa::como_macos();
    p.poner("contrato.docx", b"uno", 100, Some(1));
    let mut a = almacen();
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);

    p.sacar("contrato.docx");
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 3);

    let v = panel::vista(&a, &p, TOPE);
    assert_eq!(
        v.carpetas[0].filas[0].estado,
        EstadoDeArchivo::Retirado,
        "la lapida sobrevive al borrado a proposito, y el panel tiene que poder decir que ese documento existio"
    );
    assert_eq!(v.carpetas[0].indexados, 0);
}

#[test]
fn la_ruta_envenenada_pisa_al_indexado() {
    let p = Falsa::como_macos();
    p.poner("contrato.docx", b"uno", 100, Some(1));
    let mut a = almacen();
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);
    assert_eq!(
        panel::vista(&a, &p, TOPE).carpetas[0].filas[0].estado,
        EstadoDeArchivo::Indexado,
        "arranca indexada: si ya estuviera en fallo, la afirmacion de abajo seria verde sin que el rechazo hiciera nada"
    );

    // El servidor rechaza la observacion con un 400 y la entrada se muere; el hecho
    // siguiente sobre esa misma ruta no puede entregarse fuera de orden, y la envenena.
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    p.poner("contrato.docx", b"dos", 200, Some(1));
    ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), &p, &mut a, &politica());
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b4"), &p, &mut a, &politica());
    let mut aperturas = 0;
    while let Proximo::Trabajo(t) = a.siguiente(&raiz()) {
        let (id, d) = match *t {
            Trabajo::Observar { id, .. } => (
                id,
                Desenlace::Rechazado {
                    status: 400,
                    cuerpo: "entrada invalida".into(),
                    culpables: Vec::new(),
                },
            ),
            Trabajo::AbrirBarrido { id, .. } => {
                aperturas += 1;
                (
                    id,
                    Desenlace::Entregado(Recibido::Barrido {
                        // UN `sweepId` DISTINTO POR APERTURA. Reusar el mismo haria que
                        // dos segmentos compartieran barrido del lado del servidor, que
                        // es un estado que el de verdad nunca produce.
                        sweep: SweepId(format!("sweep-v{aperturas}")),
                        padron_requerido: false,
                    }),
                )
            }
            Trabajo::CerrarBarrido { id, .. } => (
                id,
                Desenlace::Entregado(Recibido::Retirados {
                    rutas: Vec::new(),
                    congelada: false,
                }),
            ),
            Trabajo::EnviarPadron { id, .. }
            | Trabajo::Desvanecer { id, .. }
            | Trabajo::Subir { id, .. }
            | Trabajo::ConfirmarSubida { id, .. } => (id, Desenlace::Entregado(Recibido::Nada)),
        };
        a.resolver(&raiz(), &id, d);
    }
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    p.poner("contrato.docx", b"tres", 300, Some(1));
    ciclo::barrer(&raiz(), BarridoId::nuevo("b5"), &p, &mut a, &politica());
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b6"), &p, &mut a, &politica());
    assert!(
        !a.colas().rutas_envenenadas(&raiz()).is_empty(),
        "el banco tiene que haber envenenado la ruta, o esta prueba no prueba nada"
    );

    let v = panel::vista(&a, &p, TOPE);
    assert_eq!(
        v.carpetas[0].filas[0].estado,
        EstadoDeArchivo::Fallo(MotivoDeArchivoFallido::RechazadoPorSavia),
        "la fila sigue diciendo `Presente/Confirmado` —verdadero sobre el pasado— y el panel mostraria `indexado` sobre un archivo que hace tres barridos que no entra"
    );
    assert_eq!(
        v.carpetas[0].indexados, 0,
        "y no se cuenta como indexado: el contador es lo que se muestra cuando la fila no entra en el tope"
    );
}

#[test]
fn el_token_revocado_se_dice_aparte_del_estado_de_las_carpetas() {
    let p = Falsa::como_macos();
    p.poner("contrato.docx", b"uno", 100, Some(1));
    let mut a = almacen();
    barrer_y_confirmar(&p, &mut a, 1);
    assert!(panel::vista(&a, &p, TOPE).detenido.is_none());

    ciclo::barrer(&raiz(), BarridoId::nuevo("b2"), &p, &mut a, &politica());
    let Proximo::Trabajo(t) = a.siguiente(&raiz()) else {
        panic!("tiene que haber trabajo");
    };
    let id = match *t {
        Trabajo::AbrirBarrido { id, .. } => id,
        otro => panic!("se esperaba la apertura, vino {otro:?}"),
    };
    // `Credenciales` y no `Rechazado{status:401}`: el codigo HTTP crudo no cruza a la
    // cola — `a_desenlace` lo traduce a una CLASE en `ciclo`, y este banco hace de
    // `ciclo`. Un banco que pasara el 401 estaria ejercitando una via que no existe.
    a.resolver(
        &raiz(),
        &id,
        Desenlace::Credenciales("token revocado".into()),
    );

    let v = panel::vista(&a, &p, TOPE);
    assert_eq!(
        v.detenido,
        Some(panel::Detencion::Credenciales),
        "«Savia no esta entrando» no es un estado de una carpeta: es del dispositivo, y se resuelve volviendo a vincular"
    );
}

// ═════════════════ Las fotos que dibuja `panel/index.html` ══════════════════

/// **EL MAQUETADO NO INVENTA SUS DATOS.** Cada escenario de `panel/ejemplo.json` sale de
/// `panel::vista` corriendo de verdad sobre el `Almacen`, y `panel/panel.js` los lee tal
/// cual. Si alguien renombra un campo, esto se pone rojo ANTES de que la interfaz empiece
/// a dibujar `undefined` en silencio.
///
/// Son VARIOS escenarios y no uno porque los cuatro estados de carpeta son excluyentes:
/// una raiz no puede estar sincronizada y congelada a la vez, asi que una sola foto no
/// puede mostrar el vocabulario entero. Cada escenario es una corrida aparte.
///
/// Para regenerarlo a proposito:
///
/// ```text
///   GOLDEN=reescribir cargo test --test panel las_fotos_de_ejemplo
/// ```
#[test]
fn las_fotos_de_ejemplo_del_panel_estan_al_dia() {
    let escenarios = serde_json::json!({
        "escenarios": [
            { "nombre": "Al día", "vista": escenario_al_dia() },
            { "nombre": "Barriendo", "vista": escenario_barriendo() },
            { "nombre": "Congelado", "vista": escenario_congelado() },
            { "nombre": "Carpeta ausente", "vista": escenario_ausente() },
            { "nombre": "Un archivo falló", "vista": escenario_con_fallo() },
            { "nombre": "Hay que volver a vincular", "vista": escenario_detenido() },
        ]
    });
    let actual = serde_json::to_string_pretty(&escenarios).unwrap() + "\n";
    let golden =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../panel/ejemplo.json");
    if std::env::var("GOLDEN").as_deref() == Ok("reescribir") {
        std::fs::write(&golden, &actual).unwrap();
        return;
    }
    let esperado = std::fs::read_to_string(&golden).unwrap_or_else(|e| {
        panic!(
            "no se pudo leer {}: {e}. Para crearlo: GOLDEN=reescribir cargo test --test panel las_fotos_de_ejemplo",
            golden.display()
        )
    });
    assert_eq!(
        actual, esperado,
        "\nLA FORMA QUE EL PANEL DIBUJA CAMBIO. `panel/panel.js` lee estos campos por \
         nombre: un campo renombrado no rompe nada, dibuja vacio. Si el cambio es a \
         proposito, actualiza el maquetado y regenera con \
         `GOLDEN=reescribir cargo test --test panel las_fotos_de_ejemplo`.\n"
    );
}

/// Tres archivos indexados y uno en vuelo. Es el estado normal del canal.
fn corpus_al_dia() -> (Falsa, Almacen) {
    let p = Falsa::como_macos();
    for (n, nombre) in ["contrato-marco.docx", "informe-q3.xlsx", "acta-2024.pdf"]
        .into_iter()
        .enumerate()
    {
        p.poner(nombre, format!("c{n}").as_bytes(), 100, Some(n as u128 + 1));
    }
    let mut a = almacen();
    barrer_y_confirmar(&p, &mut a, 1);
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    barrer_y_confirmar(&p, &mut a, 2);
    (p, a)
}

fn en_vuelo(p: &Falsa, a: &mut Almacen) {
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    p.poner("informe-q3.xlsx", b"c1-editado", 200, Some(2));
    ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), p, a, &politica());
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b4"), p, a, &politica());
}

fn escenario_al_dia() -> panel::Vista {
    let (p, mut a) = corpus_al_dia();
    en_vuelo(&p, &mut a);
    panel::vista(&a, &p, 6)
}

fn escenario_barriendo() -> panel::Vista {
    let (p, mut a) = corpus_al_dia();
    a.abrir_barrido(&raiz(), BarridoId::nuevo("b3"));
    panel::vista(&a, &p, 6)
}

fn escenario_congelado() -> panel::Vista {
    let (p, mut a) = corpus_al_dia();
    ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), &p, &mut a, &politica());
    drenar_con(&mut a, |t| match *t {
        Trabajo::CerrarBarrido { id, .. } => (
            id,
            Recibido::Retirados {
                rutas: Vec::new(),
                congelada: true,
            },
        ),
        Trabajo::AbrirBarrido { id, .. } => (
            id,
            Recibido::Barrido {
                sweep: SweepId("sweep-3".into()),
                padron_requerido: false,
            },
        ),
        Trabajo::Observar { id, .. } => (id, Recibido::Decisiones(Vec::new())),
        Trabajo::EnviarPadron { id, .. }
        | Trabajo::Desvanecer { id, .. }
        | Trabajo::Subir { id, .. }
        | Trabajo::ConfirmarSubida { id, .. } => (id, Recibido::Nada),
    });
    panel::vista(&a, &p, 6)
}

/// Una raiz sana y una suplente: el volumen no monto y quedo, en el mismo path, un
/// directorio vacio haciendose pasar por la carpeta. El agregado tiene que decir lo peor.
fn escenario_ausente() -> panel::Vista {
    let (p, mut a) = corpus_al_dia();
    a.enrolar(RaizRegistrada {
        id: RaizId::nueva("root-2"),
        huella: HuellaDeRaiz {
            volumen: IdDeVolumen::Uuid([9u8; 16]),
            directorio: IdDeArchivoDelSO(2),
        },
        ruta_absoluta: std::path::PathBuf::from("/Volumes/Archivo"),
        sensibilidad: SensibilidadAMayusculas::Distingue,
    });
    panel::vista(&a, &p, 6)
}

fn escenario_con_fallo() -> panel::Vista {
    let (p, mut a) = corpus_al_dia();
    envenenar(&p, &mut a, "contrato-marco.docx");
    // Tope 2 sobre cuatro filas: el que fallo tiene que entrar igual.
    panel::vista(&a, &p, 2)
}

fn escenario_detenido() -> panel::Vista {
    let (p, mut a) = corpus_al_dia();
    ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), &p, &mut a, &politica());
    if let Proximo::Trabajo(t) = a.siguiente(&raiz())
        && let Trabajo::AbrirBarrido { id, .. } = *t
    {
        a.resolver(
            &raiz(),
            &id,
            Desenlace::Credenciales("token revocado".into()),
        );
    }
    panel::vista(&a, &p, 6)
}

/// El 400 mata la entrada, y el hecho siguiente sobre esa misma ruta no puede entregarse
/// fuera de orden: la envenena.
fn envenenar(p: &Falsa, a: &mut Almacen, nombre: &str) {
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    p.poner(nombre, b"dos", 200, Some(1));
    ciclo::barrer(&raiz(), BarridoId::nuevo("b3"), p, a, &politica());
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b4"), p, a, &politica());
    let mut aperturas = 0;
    while let Proximo::Trabajo(t) = a.siguiente(&raiz()) {
        let (id, d) = match *t {
            Trabajo::Observar { id, .. } => (
                id,
                Desenlace::Rechazado {
                    status: 400,
                    cuerpo: "entrada invalida".into(),
                    culpables: Vec::new(),
                },
            ),
            Trabajo::AbrirBarrido { id, .. } => {
                aperturas += 1;
                (
                    id,
                    Desenlace::Entregado(Recibido::Barrido {
                        sweep: SweepId(format!("sweep-f{aperturas}")),
                        padron_requerido: false,
                    }),
                )
            }
            Trabajo::CerrarBarrido { id, .. } => (
                id,
                Desenlace::Entregado(Recibido::Retirados {
                    rutas: Vec::new(),
                    congelada: false,
                }),
            ),
            Trabajo::EnviarPadron { id, .. }
            | Trabajo::Desvanecer { id, .. }
            | Trabajo::Subir { id, .. }
            | Trabajo::ConfirmarSubida { id, .. } => (id, Desenlace::Entregado(Recibido::Nada)),
        };
        a.resolver(&raiz(), &id, d);
    }
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    p.poner(nombre, b"tres", 300, Some(1));
    ciclo::barrer(&raiz(), BarridoId::nuevo("b5"), p, a, &politica());
    p.avanzar(ASENTAMIENTO_DEL_BANCO);
    ciclo::barrer(&raiz(), BarridoId::nuevo("b6"), p, a, &politica());
    assert!(
        !a.colas().rutas_envenenadas(&raiz()).is_empty(),
        "la foto de `fallo` tiene que tener una ruta envenenada de verdad"
    );
}
