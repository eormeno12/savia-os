//! LOS DTO, 1:1 CON LO QUE EMITE `apps/folder-agent/sim/server.ts`.
//!
//! Estan aparte del dominio porque el dominio se puede mejorar y esto no: cambiarlo es
//! cambiar el contrato. **Son ingles**, y el dominio es espanol; es exactamente el
//! reparto que ya exhibe el simulador —espanol adentro, ingles en el cable— y renombrar
//! estos invita a la deriva.
//!
//! `rename_all = "camelCase"` cubre las cuatro que difieren de snake case —`sweepId`,
//! `lastSeenHash`, `contentLengthRange`, `verifiedHash`— y ninguna necesita un rename
//! suelto. Verificado campo por campo contra `server.ts`.
//!
//! **NINGUN campo lleva `#[serde(default)]`, y es deliberado**: un `diverged` ausente
//! que se leyera `false` se traga la divergencia en silencio, que es justo el modo de
//! falla que `upload.completed` existe para cerrar; un `verifiedHash` ausente que se
//! leyera `""` guardaria la cadena vacia como version.
//!
//! Y **NO** se usa `deny_unknown_fields` en las respuestas: un servidor que agrega un
//! campo no puede romper a un agente ya instalado en cuarenta escritorios.

use serde::{Deserialize, Serialize};

// ─────────────────────────── El enrolamiento ────────────────────────────────
//
// LAS UNICAS TRES QUE NO LLEVAN CREDENCIAL, porque son las que la producen. Van aparte
// del resto a proposito: el resto del archivo describe el protocolo de un agente YA
// vinculado, y estas describen como llega a estarlo.

/// Cuerpo vacio: el agente no tiene NADA que ofrecer todavia. Es un tipo y no un
/// `serde_json::json!({})` para que el cuerpo del pedido sea igual de explicito que el
/// de las otras seis llamadas.
#[derive(Serialize)]
pub struct PedidoEnrolar {}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RtaEnrolar {
    /// OPACO, y con esto se reclama. Es distinto de `code` a proposito: si se reclamara
    /// con el codigo corto, adivinar seis caracteres seria adivinar un token de
    /// dispositivo.
    pub enrollment_id: String,
    /// CORTO, y con esto NO se reclama nada. Existe para que lo lea una persona.
    pub code: String,
    pub expires_in: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PedidoReclamar<'a> {
    pub enrollment_id: &'a str,
}

/// **`Approved` SIN token es inexpresable**, y esa es la garantia del tipo: un servidor
/// que conteste aprobado y se olvide el token falla al deserializar en vez de dejar al
/// agente creyendose vinculado con la credencial vacia.
#[derive(Deserialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum RtaReclamar {
    Pending,
    Approved {
        #[serde(rename = "deviceToken")]
        device_token: String,
        #[serde(rename = "userId")]
        user_id: String,
    },
    Denied,
    Expired,
}

// ──────────────────────── Las siete del protocolo ───────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PedidoAbrirBarrido<'a> {
    pub root: &'a str,
    pub total: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RtaAbrirBarrido {
    pub sweep_id: String,
    /// SIN `#[serde(default)]`, como todo lo demas de este archivo: si el servidor deja
    /// de mandarlo, esto tiene que FALLAR y no asumir `false`. Asumirlo apagaria en
    /// silencio la unica deteccion del desfase de inventario, que es justo el modo de
    /// falla que el campo vino a tapar.
    pub padron_requerido: bool,
}

/// EL PADRON. Todo lo que el agente VE en la raiz, sin bytes. Solo viaja cuando el
/// servidor lo pide, porque cuesta una entrada por archivo y el barrido incremental
/// existe para no pagar eso todas las vueltas.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PedidoPadron<'a> {
    pub sweep_id: &'a str,
    pub entries: Vec<EntradaDePadron<'a>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntradaDePadron<'a> {
    pub path: &'a str,
    /// `None` viaja como `null` y significa **PRESENTE CON HASH DESCONOCIDO**, no
    /// ausente. Es el caso del deshidratado: nunca se leyo, asi que no hay hash — y
    /// omitirlo del padron lo volveria ausente y Savia lo retiraria, que es retirar un
    /// archivo que esta perfectamente ahi. En macOS, ademas, leerlo para probar que
    /// existe significa descargar el drive de nube entero.
    pub hash: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RtaPadron {
    pub received: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PedidoObservados<'a> {
    pub root: &'a str,
    pub entries: Vec<EntradaObservada<'a>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntradaObservada<'a> {
    pub path: &'a str,
    pub hash: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RtaObservados {
    pub decisions: Vec<DecisionDeAlambre>,
}

/// `path` es HERMANO del tag `decision`, asi que el enum va internamente etiquetado y
/// aplanado. Es la unica forma que reproduce `{path, decision:"known"}` y
/// `{path, decision:"upload", permit:{...}}` sin inventar un nivel de anidamiento que el
/// servidor no emite.
#[derive(Deserialize)]
pub struct DecisionDeAlambre {
    pub path: String,
    #[serde(flatten)]
    pub veredicto: VeredictoDeAlambre,
}

#[derive(Deserialize)]
#[serde(tag = "decision", rename_all = "lowercase")]
pub enum VeredictoDeAlambre {
    Known,
    Upload { permit: PermisoDeAlambre },
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermisoDeAlambre {
    /// En el simulador es RELATIVA (`/upload/permit-3`); contra un prefirmado real sera
    /// absoluta y a OTRO host. Las dos formas se resuelven, y cual es cual lo decide si
    /// parsea como URL absoluta.
    pub url: String,
    /// Dos numeros, `[minimo, maximo]`. Es el tope de tamano, y viaja ACA porque la API
    /// nunca toca bytes: es la unica palanca preventiva que la subida directa deja en
    /// pie.
    pub content_length_range: [u64; 2],
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PedidoConfirmarSubida<'a> {
    pub permit: &'a str,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RtaConfirmarSubida {
    pub verified_hash: String,
    pub diverged: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PedidoDesaparecidos<'a> {
    pub root: &'a str,
    pub entries: Vec<EntradaDesaparecida<'a>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntradaDesaparecida<'a> {
    pub path: &'a str,
    pub last_seen_hash: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RtaDesaparecidos {
    pub quarantined: u32,
    pub frozen: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PedidoCerrarBarrido<'a> {
    pub sweep_id: &'a str,
    pub status: &'a str,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RtaCerrarBarrido {
    pub retired: Vec<String>,
    /// **SIN `#[serde(default)]`, como todo este archivo, y aca duele mas que en el
    /// resto.** `Congelado` es uno de los cuatro estados que el panel muestra por raiz;
    /// leer un `frozen` ausente como `false` seria mostrar «Sincronizado» sobre una raiz
    /// que Savia esta reteniendo — o sea la respuesta tranquilizadora, que es siempre la
    /// peor para inventar.
    pub frozen: bool,
}

/// **EL SOBRE.** El simulador contesta `200` CON `{error: "..."}` en tres caminos:
/// «permiso desconocido», «el objeto no llego» y «barrido desconocido». Un cliente que
/// solo mire el status los lee como exito y confirma subidas que nunca ocurrieron.
///
/// **El orden de las variantes importa**: `Error` se prueba PRIMERO, asi que no hay
/// forma de llegar al `T` sin haberlo descartado.
#[derive(Deserialize)]
#[serde(untagged)]
pub enum Sobre<T> {
    Error { error: String },
    Valor(T),
}
