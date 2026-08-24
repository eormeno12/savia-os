//! Los guardianes de `tests/guardianes.rs` (crate unico, pre-corte) que tocan un solo
//! archivo —`protocolo/mod.rs`, hoy `lib.rs` de esta crate, sin cambiar de contenido en
//! los tramos que estos tests miran—. Movidos tal cual, sin tocar el cuerpo, con la ruta
//! corregida. Ver docs/product/savia-b2b/plan-rediseno-agente.md §2.

use std::path::PathBuf;

fn fuente(rel: &str) -> String {
    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("src")
        .join(rel);
    std::fs::read_to_string(&p).unwrap_or_else(|e| panic!("no se pudo leer {}: {e}", p.display()))
}

/// Quita los comentarios de linea. Un guardian que busca sintaxis no se puede disparar
/// con una prosa que la menciona.
fn sin_comentarios(src: &str) -> String {
    src.lines()
        .map(|l| match l.find("//") {
            Some(i) => &l[..i],
            None => l,
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// **EL AGENTE NO SE PUEDE APROBAR A SI MISMO**, y esa imposibilidad es todo lo que el
/// codigo corto compra. Si `Cliente` pudiera llamar a `/enroll/approve`, un binario que
/// llego a una maquina se vincularia solo y el paso del humano no ataria nada.
///
/// Se verifica por AUSENCIA de la ruta en el fuente del cliente, que es lo mas fuerte
/// que esta crate puede hacer: la separacion real vive del lado del servidor —donde
/// esa ruta la protege la sesion web de la persona— y aca lo unico que se puede impedir
/// es que el agente tenga con que llamarla.
#[test]
fn el_cliente_no_tiene_con_que_aprobarse() {
    let src = sin_comentarios(&fuente("lib.rs"));
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
    let src = sin_comentarios(&fuente("lib.rs"));
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
    let src = sin_comentarios(&fuente("lib.rs"));
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
