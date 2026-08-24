//! LA UNICA PUERTA DE SALIDA DEL AGENTE, y no tiene ninguna otra responsabilidad:
//! traduce las seis llamadas del plan a HTTP, clasifica lo que vuelve, **y no decide
//! nada**.
//!
//! Es el espejo de la regla que `packages/ir` ya impone —`sha256` y `targetSizeChars`
//! entran por parametro— aplicada aca: no abre rutas, no hashea, no consulta el reloj,
//! no toca la cola, **no reintenta**. Los bytes entran ya leidos y el hash entra ya
//! computado. Una llamada es un intento.
//!
//! TRES COSAS DE LA LECTURA DEL SIMULADOR MANDAN SOBRE EL DISENO, Y NINGUNA ES
//! COSMETICA:
//!
//!  1. **El simulador contesta `200` con `{error: "..."}`** en tres caminos. Por eso
//!     toda respuesta pasa por `Sobre`, donde el `error` se prueba PRIMERO.
//!  2. **La respuesta de `presence.observed` echa `path`, no `hash`.** Para promover un
//!     `known` a hash verificado hace falta el afirmado, que esta en el PEDIDO. Asi que
//!     el cliente no puede devolver la respuesta cruda: **aparea por `path`, exige
//!     biyeccion**, y entrega `Veredicto`s con el afirmado al lado. Si apareara por
//!     indice o tolerase faltantes, un archivo quedaria sin subir y el agente creeria
//!     que si.
//!  3. **`upload.completed` NO es idempotente**: consume el permiso. Un reintento tras
//!     perder la respuesta devuelve `{error: "permiso desconocido"}`, que es
//!     indistinguible de «nunca llego». Se clasifica `Ambiguo` —ni reintentable ni cola
//!     muerta— y su salida es volver a observar.
//!
//! **EL LAZO DE LA DIVERGENCIA SE CIERRA POR TIPO, NO POR DISCIPLINA.** `HashAfirmado` y
//! `HashVerificado` son tipos distintos y `presence.vanished` solo acepta el segundo —lo
//! garantiza `salvaguardas::Desaparicion`, cuyos campos son privados—. Este modulo es el
//! unico que acuna verificados, y lo hace en dos lugares nombrados: `known` y
//! `upload.completed`.

pub mod alambre;
pub mod transporte;

use alambre::*;
use savia_folder_contrato::colas::{
    Decision, Permiso, PermisoId, RangoDeTamano, SweepId, Veredicto,
};
use savia_folder_contrato::dominio::{
    EstadoDelBarrido, HashAfirmado, HashVerificado, RaizId, RutaRelativa, de_hex,
};
use savia_folder_contrato::protocolo::{
    BarridoAbierto, CierreAplicado, Clase, Confirmacion, Credencial, Cuarentena, Reclamo, Secreto,
    Vinculacion,
};
use savia_folder_politica::salvaguardas::{Desaparicion, EstadoDeRaiz};
use std::time::Duration;
pub use transporte::Tiempos;

// ─────────────────────────────── La base ────────────────────────────────────

/// Base de la API. Se guarda SIN barra final y se CONCATENA. Se valida ACA y no en cada
/// llamada porque una base mala convierte las seis en 404.
#[derive(Clone, Debug)]
pub struct BaseDeApi {
    autoridad: String,
    prefijo: String,
}

impl BaseDeApi {
    pub fn nueva(s: &str) -> Result<Self, FalloDeProtocolo> {
        let sin_barra = s.trim_end_matches('/');
        let resto = sin_barra
            .strip_prefix("http://")
            .ok_or_else(|| FalloDeProtocolo::BaseInvalida(s.to_string()))?;
        if resto.contains('?') || resto.contains('#') {
            return Err(FalloDeProtocolo::BaseInvalida(s.to_string()));
        }
        let (autoridad, prefijo) = match resto.find('/') {
            Some(i) => (resto[..i].to_string(), resto[i..].to_string()),
            None => (resto.to_string(), String::new()),
        };
        Ok(Self { autoridad, prefijo })
    }
    fn ruta(&self, r: &str) -> String {
        format!("{}{}", self.prefijo, r)
    }
}

// ───────────────────────────── Los errores ──────────────────────────────────

#[derive(Debug)]
pub enum FalloDeProtocolo {
    /// No llego a destino: DNS, socket, timeout.
    Transporte(transporte::FalloDeRed),
    /// Llego y contesto un codigo que no es 2xx.
    Estado {
        llamada: &'static str,
        codigo: u16,
        cuerpo: String,
    },
    /// `2xx` CON `{error: "..."}`. Existe porque el simulador lo hace.
    Aplicacion {
        llamada: &'static str,
        mensaje: String,
    },
    /// La respuesta no tiene la forma del contrato: campo faltante, decisiones que no
    /// aparean con las entradas, permiso sin ultimo segmento.
    Cuerpo {
        llamada: &'static str,
        detalle: String,
    },
    /// El archivo no entra en el permiso. Se detecta ANTES del PUT.
    NoCabeEnElPermiso {
        bytes: u64,
        rango: RangoDeTamano,
    },
    /// `upload.completed` sobre un permiso que ya no esta.
    PermisoConsumidoOInexistente,
    BaseInvalida(String),
    DestinoDePermisoInvalido(String),
}

impl std::fmt::Display for FalloDeProtocolo {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FalloDeProtocolo::Transporte(e) => write!(f, "no llego a destino: {e:?}"),
            FalloDeProtocolo::Estado {
                llamada,
                codigo,
                cuerpo,
            } => {
                // El cuerpo viaja SIEMPRE: el 404 del simulador trae
                // `{error: "sin ruta: ..."}` y ese texto es el diagnostico entero.
                write!(f, "{llamada} contesto {codigo}: {cuerpo}")
            }
            FalloDeProtocolo::Aplicacion { llamada, mensaje } => {
                write!(
                    f,
                    "{llamada} contesto 2xx con error de aplicacion: {mensaje}"
                )
            }
            FalloDeProtocolo::Cuerpo { llamada, detalle } => {
                write!(
                    f,
                    "{llamada} devolvio algo que no tiene la forma del contrato: {detalle}"
                )
            }
            FalloDeProtocolo::NoCabeEnElPermiso { bytes, rango } => write!(
                f,
                "{bytes} bytes no entran en el permiso [{}, {}]",
                rango.minimo, rango.maximo
            ),
            FalloDeProtocolo::PermisoConsumidoOInexistente => f.write_str(
                "el permiso ya no esta: o nunca llego, o se consumio y la respuesta se perdio",
            ),
            FalloDeProtocolo::BaseInvalida(s) => write!(f, "base de api invalida: {s}"),
            FalloDeProtocolo::DestinoDePermisoInvalido(s) => {
                write!(f, "el permiso no trae un destino usable: {s}")
            }
        }
    }
}

impl std::error::Error for FalloDeProtocolo {}

impl FalloDeProtocolo {
    pub fn clase(&self) -> Clase {
        match self {
            FalloDeProtocolo::Transporte(_) => Clase::Reintentable,
            FalloDeProtocolo::Estado { codigo, .. } => match codigo {
                401 | 403 => Clase::Credenciales,
                429 => Clase::Reintentable,
                c if *c >= 500 => Clase::Reintentable,
                _ => Clase::ColaMuerta,
            },
            FalloDeProtocolo::PermisoConsumidoOInexistente => Clase::Ambiguo,
            FalloDeProtocolo::Aplicacion { mensaje, .. } => {
                // «el objeto no llego» es reintentable (falta el PUT); «permiso
                // desconocido» y «barrido desconocido» son ambiguos: el efecto pudo
                // haber ocurrido y la respuesta haberse perdido.
                if mensaje.contains("no llego") {
                    Clase::Reintentable
                } else {
                    Clase::Ambiguo
                }
            }
            _ => Clase::ColaMuerta,
        }
    }

    /// EL CODIGO CRUDO, Y SOLO PARA LA ALERTA QUE UNA PERSONA VA A LEER. No contradice la
    /// regla de arriba —«aguas abajo se lee `clase()` y nunca el codigo»— porque no
    /// decide nada: llena el campo que la entrada muerta muestra. Sin esto, una entrada
    /// muerta se ve como `COLA-MUERTA 0` y el 404 real solo sobrevive adentro del texto
    /// de debug.
    pub fn codigo_http(&self) -> Option<u16> {
        match self {
            FalloDeProtocolo::Estado { codigo, .. } => Some(*codigo),
            _ => None,
        }
    }
}

// ─────────────────────────────── El cliente ─────────────────────────────────

pub struct Cliente {
    base: BaseDeApi,
    credencial: Credencial,
    tiempos: Tiempos,
}

/// Testigo de que el PUT termino. **Campos privados y `#[must_use]`**: no se puede
/// confirmar una subida que no ocurrio, ni fabricar uno, ni olvidarse de confirmar una
/// que si — y como `confirmar_subida` lo consume por valor, tampoco confirmarla dos
/// veces.
#[must_use = "un PUT sin `confirmar_subida` deja el objeto colgado y al agente sin el hash verificado"]
pub struct Subido {
    permiso: PermisoId,
    bytes_enviados: u64,
}

impl Subido {
    pub fn bytes_enviados(&self) -> u64 {
        self.bytes_enviados
    }
}

impl Cliente {
    /// La base entra por PARAMETRO. Este modulo no lee variables de entorno ni archivos
    /// de config: quien decide a donde apunta es `main` — o el banco. Es la misma regla
    /// por la que `sha256` entra por parametro en los paquetes del pipeline.
    pub fn nuevo(base: BaseDeApi, credencial: Credencial, tiempos: Tiempos) -> Self {
        Self {
            base,
            credencial,
            tiempos,
        }
    }

    /// EL HEADER SE ARMA ACA Y EN NINGUN OTRO LADO. `SinAutenticar` no manda nada, que
    /// es lo que hace que el caso sin auth sea un camino y no un olvido.
    fn autorizacion(&self) -> Option<String> {
        match &self.credencial {
            Credencial::SinAutenticar => None,
            Credencial::TokenDeDispositivo(s) => Some(format!("Bearer {}", s.0)),
        }
    }

    /// Las SIETE llamadas del protocolo. Todas llevan la credencial.
    fn post<R: serde::de::DeserializeOwned>(
        &self,
        llamada: &'static str,
        ruta: &str,
        cuerpo: &impl serde::Serialize,
    ) -> Result<R, FalloDeProtocolo> {
        self.post_con(llamada, ruta, cuerpo, self.autorizacion().as_deref())
    }

    /// Las TRES del enrolamiento. **No pueden llevar credencial porque son las que la
    /// producen**, y por eso son una funcion aparte en vez de un `if`: un `if` deja el
    /// camino sin credencial disponible para cualquier llamada, y este es el unico
    /// lugar del cliente donde no mandarla es correcto.
    fn post_de_enrolamiento<R: serde::de::DeserializeOwned>(
        &self,
        llamada: &'static str,
        ruta: &str,
        cuerpo: &impl serde::Serialize,
    ) -> Result<R, FalloDeProtocolo> {
        self.post_con(llamada, ruta, cuerpo, None)
    }

    fn post_con<R: serde::de::DeserializeOwned>(
        &self,
        llamada: &'static str,
        ruta: &str,
        cuerpo: &impl serde::Serialize,
        autorizacion: Option<&str>,
    ) -> Result<R, FalloDeProtocolo> {
        let json = serde_json::to_vec(cuerpo).map_err(|e| FalloDeProtocolo::Cuerpo {
            llamada,
            detalle: e.to_string(),
        })?;
        let r = transporte::pedir(
            &self.base.autoridad,
            "POST",
            &self.base.ruta(ruta),
            &json,
            Some("application/json"),
            autorizacion,
            &self.tiempos,
        )
        .map_err(FalloDeProtocolo::Transporte)?;
        if !(200..300).contains(&r.codigo) {
            return Err(FalloDeProtocolo::Estado {
                llamada,
                codigo: r.codigo,
                cuerpo: r.cuerpo,
            });
        }
        let sobre: Sobre<R> =
            serde_json::from_str(&r.cuerpo).map_err(|e| FalloDeProtocolo::Cuerpo {
                llamada,
                detalle: format!("{e}: {}", r.cuerpo),
            })?;
        match sobre {
            Sobre::Error { error } => Err(FalloDeProtocolo::Aplicacion {
                llamada,
                mensaje: error,
            }),
            Sobre::Valor(v) => Ok(v),
        }
    }

    /// `POST /enroll/begin` → `{enrollmentId, code, expiresIn}`.
    ///
    /// El primer contacto de un agente que no tiene NADA. Devuelve dos cosas que no se
    /// pueden confundir: `codigo`, que se MUESTRA y no sirve para reclamar, y `id`, que
    /// es opaco y es con lo que se reclama.
    pub fn enrolar(&self) -> Result<Vinculacion, FalloDeProtocolo> {
        let r: alambre::RtaEnrolar =
            self.post_de_enrolamiento("enroll.begin", "/enroll/begin", &alambre::PedidoEnrolar {})?;
        Ok(Vinculacion {
            id: r.enrollment_id,
            codigo: r.code,
            expira_en: Duration::from_secs(r.expires_in),
        })
    }

    /// `POST /enroll/claim` → el estado de esa vinculacion.
    ///
    /// **`Pendiente` NO ES UN ERROR y por eso vuelve como valor.** Es el estado normal
    /// entre que el agente muestra el codigo y la persona lo aprueba, que puede ser un
    /// rato largo: modelarlo como `Err` obligaria a distinguir «todavia no» de «se
    /// rompio» en cada sitio que llame, y el primero que se olvide convierte una espera
    /// normal en una alerta.
    ///
    /// **Y APROBAR NO ES UNA LLAMADA DE ESTE CLIENTE.** No existe `aprobar()` y no se
    /// puede agregar: lo hace la persona desde su cuenta. Si el agente pudiera
    /// aprobarse solo, el codigo corto no ataria nada.
    pub fn reclamar(&self, vinculacion: &Vinculacion) -> Result<Reclamo, FalloDeProtocolo> {
        let r: alambre::RtaReclamar = self.post_de_enrolamiento(
            "enroll.claim",
            "/enroll/claim",
            &alambre::PedidoReclamar {
                enrollment_id: &vinculacion.id,
            },
        )?;
        Ok(match r {
            alambre::RtaReclamar::Pending => Reclamo::Pendiente,
            alambre::RtaReclamar::Approved {
                device_token,
                user_id,
            } => Reclamo::Aprobado {
                token: Secreto(device_token),
                usuario: user_id,
            },
            alambre::RtaReclamar::Denied => Reclamo::Denegado,
            alambre::RtaReclamar::Expired => Reclamo::Vencido,
        })
    }

    /// `POST /sweep/open` → `{sweepId, padronRequerido}`.
    ///
    /// `total` es el denominador del corte por volumen. **PREGUNTA ABIERTA que hay que
    /// dejar escrita**: el simulador lo guarda y NUNCA lo usa —calcula la fraccion sobre
    /// `vivos.length`, lo vivo de SU lado—. Aca se manda el tamano del inventario de esa
    /// raiz, que es lo unico conocido al ABRIR el barrido: lo enumerado en este barrido
    /// todavia no se sabe.
    pub fn abrir_barrido(
        &self,
        raiz: &RaizId,
        total: u64,
    ) -> Result<BarridoAbierto, FalloDeProtocolo> {
        let r: RtaAbrirBarrido = self.post(
            "sweep.open",
            "/sweep/open",
            &PedidoAbrirBarrido {
                root: raiz.como_str(),
                total,
            },
        )?;
        Ok(BarridoAbierto {
            sweep_id: SweepId(r.sweep_id),
            padron_requerido: r.padron_requerido,
        })
    }

    /// `POST /presence/roster` - el padron, y SOLO cuando el servidor lo pidio.
    ///
    /// EL AGENTE NO DECIDE MANDARLO. Lo pide Savia comparando el `total` que ya viajaba
    /// en `sweep.open` contra sus documentos vivos de esa raiz. Que la deteccion viva
    /// alla y no aca es lo que cubre los casos que el agente NO PUEDE declarar porque no
    /// los conoce: un inventario corrupto que el cree bueno, una restauracion desde un
    /// backup viejo, o dos agentes sobre la misma raiz.
    pub fn enviar_padron(
        &self,
        barrido: &SweepId,
        entradas: &[(String, Option<String>)],
    ) -> Result<u64, FalloDeProtocolo> {
        let entries = entradas
            .iter()
            .map(|(ruta, hash)| EntradaDePadron {
                path: ruta.as_str(),
                hash: hash.clone(),
            })
            .collect();
        let r: RtaPadron = self.post(
            "presence.roster",
            "/presence/roster",
            &PedidoPadron {
                sweep_id: &barrido.0,
                entries,
            },
        )?;
        Ok(r.received)
    }

    /// `POST /presence/observed` → `{decisions}`, que ES `presence.decision`. Cero bytes.
    ///
    /// Exige BIYECCION por `path` con las entradas enviadas, y que las rutas del lote
    /// sean unicas —`path` es la unica clave de correlacion que la respuesta trae—. Una
    /// decision salteada en silencio es un archivo que nunca se sube y un agente que
    /// cree que si.
    pub fn reportar_observados(
        &self,
        raiz: &RaizId,
        entradas: &[(RutaRelativa, HashAfirmado)],
    ) -> Result<Vec<Veredicto>, FalloDeProtocolo> {
        const LLAMADA: &str = "presence.observed";
        let mut vistas = std::collections::BTreeSet::new();
        for (r, _) in entradas {
            if !vistas.insert(r.clone()) {
                return Err(FalloDeProtocolo::Cuerpo {
                    llamada: LLAMADA,
                    detalle: format!("ruta repetida en el lote: {}", r.como_str()),
                });
            }
        }
        let pedido = PedidoObservados {
            root: raiz.como_str(),
            entries: entradas
                .iter()
                .map(|(r, h)| EntradaObservada {
                    path: r.como_str(),
                    hash: h.hex(),
                })
                .collect(),
        };
        let r: RtaObservados = self.post(LLAMADA, "/presence/observed", &pedido)?;
        if r.decisions.len() != entradas.len() {
            return Err(FalloDeProtocolo::Cuerpo {
                llamada: LLAMADA,
                detalle: format!(
                    "llegaron {} decisiones para {} entradas",
                    r.decisions.len(),
                    entradas.len()
                ),
            });
        }
        let mut salida = Vec::with_capacity(entradas.len());
        for d in r.decisions {
            let Some((ruta, afirmado)) = entradas.iter().find(|(r, _)| r.como_str() == d.path)
            else {
                return Err(FalloDeProtocolo::Cuerpo {
                    llamada: LLAMADA,
                    detalle: format!("decision para una ruta que no se envio: {}", d.path),
                });
            };
            let decision = match d.veredicto {
                // LA PROMOCION A VERIFICADO ES LEGITIMA: una coincidencia solo puede
                // direccionar un objeto que ese lado YA escribio y YA verifico, asi que
                // la propia respuesta es la verificacion. Es una de las tres puertas.
                VeredictoDeAlambre::Known => Decision::Known {
                    verificado: HashVerificado::acunar(*afirmado.bytes()),
                },
                VeredictoDeAlambre::Upload { permit } => Decision::Upload {
                    permiso: Permiso {
                        id: id_de_permiso(&permit.url)?,
                        destino: resolver_destino(&self.base, &permit.url),
                        rango: RangoDeTamano {
                            minimo: permit.content_length_range[0],
                            maximo: permit.content_length_range[1],
                        },
                    },
                },
            };
            salida.push(Veredicto {
                ruta: ruta.clone(),
                afirmado: *afirmado,
                decision,
            });
        }
        Ok(salida)
    }

    /// El PUT directo al almacen. La API NO lo ve, y **por eso esta llamada no lleva
    /// credencial de Savia**: mandarla seria filtrar el token de dispositivo a un host
    /// de almacenamiento de terceros que ademas eligio la respuesta del servidor.
    ///
    /// Verifica el tamano contra el rango del permiso ANTES de abrir el socket, y cuenta
    /// lo efectivamente escrito.
    pub fn subir(&self, permiso: &Permiso, bytes: &[u8]) -> Result<Subido, FalloDeProtocolo> {
        let n = bytes.len() as u64;
        if !permiso.rango.admite(n) {
            return Err(FalloDeProtocolo::NoCabeEnElPermiso {
                bytes: n,
                rango: permiso.rango.clone(),
            });
        }
        // **A QUE SOCKET SE ABRE EL PUT LO DECIDE EL PERMISO, NO LA BASE DE LA API.** Lo
        // anterior pasaba la autoridad de la API SIEMPRE y usaba el destino solo como
        // request-target: con un permiso absoluto salia
        // `PUT http://otro-host/... HTTP/1.1` con `Host:` de la API, por el socket de la
        // API. Un permiso prefirmado REAL es siempre absoluto a otro host, asi que el dia
        // que el simulador se reemplace por Savia los bytes de todos los archivos del
        // usuario habrian llegado a la API — lo contrario exacto de «la API nunca toca
        // bytes», que es la razon entera por la que existe la subida directa.
        let (autoridad, ruta) = destino_del_put(&self.base, &permiso.destino)?;
        let r = transporte::pedir(
            &autoridad,
            "PUT",
            &ruta,
            bytes,
            Some("application/octet-stream"),
            // **`None` ESCRITO A MANO, no heredado de un default.** Es la unica llamada
            // del cliente que va a un host que eligio la RESPUESTA del servidor, asi
            // que mandar el token seria entregarselo a quien conteste.
            None,
            &self.tiempos,
        )
        .map_err(FalloDeProtocolo::Transporte)?;
        if !(200..300).contains(&r.codigo) {
            return Err(FalloDeProtocolo::Estado {
                llamada: "upload.put",
                codigo: r.codigo,
                cuerpo: r.cuerpo,
            });
        }
        Ok(Subido {
            permiso: permiso.id.clone(),
            bytes_enviados: n,
        })
    }

    /// `POST /upload/completed` → `{verifiedHash, diverged}`.
    ///
    /// Consume el testigo por valor: no se puede confirmar dos veces ni sin PUT. Devuelve
    /// el hash VERIFICADO, que es lo que cierra la divergencia — la segunda de las tres
    /// puertas.
    pub fn confirmar_subida(&self, subido: Subido) -> Result<Confirmacion, FalloDeProtocolo> {
        const LLAMADA: &str = "upload.completed";
        let r: RtaConfirmarSubida = match self.post(
            LLAMADA,
            "/upload/completed",
            &PedidoConfirmarSubida {
                permit: &subido.permiso.0,
            },
        ) {
            Ok(r) => r,
            Err(FalloDeProtocolo::Aplicacion { mensaje, .. })
                if mensaje.contains("permiso desconocido") =>
            {
                return Err(FalloDeProtocolo::PermisoConsumidoOInexistente);
            }
            Err(e) => return Err(e),
        };
        let bytes = de_hex(&r.verified_hash).ok_or_else(|| FalloDeProtocolo::Cuerpo {
            llamada: LLAMADA,
            detalle: format!("verifiedHash no es sha256 hex: {}", r.verified_hash),
        })?;
        Ok(Confirmacion {
            verificado: HashVerificado::acunar(bytes),
            divergio: r.diverged,
        })
    }

    /// La segunda fase, reanudada desde el `PermisoId` persistido.
    ///
    /// **Y HAY QUE DECIR POR QUE EXISTE, PORQUE DEBILITA EL TESTIGO.** `Subido` es
    /// `#[must_use]`, de campos privados y se consume por valor justamente para que no se
    /// pueda confirmar una subida que no ocurrio. Pero la subida se parte en dos fases
    /// PERSISTIDAS a proposito —si el proceso muere entre el PUT y el ACK hay que
    /// reintentar el ACK, no re-subir el archivo entero— y un testigo en memoria no
    /// sobrevive a que el proceso muera. Asi que esta puerta toma el id de la cola, y lo
    /// que la mantiene honesta es que la cola solo la ofrece cuando ya marco el PUT como
    /// hecho: el `Trabajo::ConfirmarSubida` no existe hasta que el `Trabajo::Subir` se
    /// resolvio.
    pub fn confirmar_subida_reanudada(
        &self,
        permiso: &PermisoId,
    ) -> Result<Confirmacion, FalloDeProtocolo> {
        self.confirmar_subida(Subido {
            permiso: permiso.clone(),
            bytes_enviados: 0,
        })
    }

    /// `POST /presence/vanished` → `{quarantined, frozen}`.
    ///
    /// Reporta un HECHO OBSERVADO; no pide un retiro. Dos cosas estan en la FIRMA y no en
    /// un comentario: las entradas son `Desaparicion` —cuyo `ultimo_hash` es un
    /// `HashVerificado` por construccion— y `_viva` es el testigo de que la raiz esta
    /// viva. Si la raiz no esta, no se reporta NI UNA baja, y un disco desmontado produce
    /// exactamente el mismo conjunto de ausencias que un borrado masivo.
    pub fn reportar_desaparecidos(
        &self,
        raiz: &RaizId,
        entradas: &[Desaparicion],
        _viva: &EstadoDeRaiz,
    ) -> Result<Cuarentena, FalloDeProtocolo> {
        debug_assert!(
            _viva.permite_reportar_bajas(),
            "el testigo existe justamente para que esto no pueda pasar"
        );
        let pedido = PedidoDesaparecidos {
            root: raiz.como_str(),
            entries: entradas
                .iter()
                .map(|d| EntradaDesaparecida {
                    path: d.ruta().como_str(),
                    last_seen_hash: d.ultimo_hash().hex(),
                })
                .collect(),
        };
        let r: RtaDesaparecidos = self.post("presence.vanished", "/presence/vanished", &pedido)?;
        Ok(Cuarentena {
            en_cuarentena: r.quarantined,
            raiz_congelada: r.frozen,
        })
    }

    /// `POST /sweep/close` → `{retired}`.
    ///
    /// `retired` es informativo para el panel: quien retira es Savia. Un cierre
    /// reintentado devuelve menos retiros —los ya retirados se saltean—, asi que esta
    /// lista **nunca** puede ser la fuente de verdad del inventario.
    pub fn cerrar_barrido(
        &self,
        barrido: &SweepId,
        cierre: EstadoDelBarrido,
    ) -> Result<CierreAplicado, FalloDeProtocolo> {
        const LLAMADA: &str = "sweep.close";
        // `"complete"` esta FIJADO por el simulador (`if (status !== "complete")`).
        // `"interrupted"` NO lo esta: hoy cualquier cadena distinta se comporta igual,
        // asi que el valor de alambre del segundo es una suposicion que hay que fijar
        // antes de que signifique algo.
        let status = match cierre {
            EstadoDelBarrido::Completo => "complete",
            EstadoDelBarrido::Interrumpido => "interrupted",
        };
        let r: RtaCerrarBarrido = self.post(
            LLAMADA,
            "/sweep/close",
            &PedidoCerrarBarrido {
                sweep_id: &barrido.0,
                status,
            },
        )?;
        let retirados = r
            .retired
            .into_iter()
            .map(|p| {
                RutaRelativa::canonica(&p).map_err(|_| FalloDeProtocolo::Cuerpo {
                    llamada: LLAMADA,
                    detalle: format!("ruta retirada no canonica: {p}"),
                })
            })
            .collect::<Result<Vec<_>, _>>()?;
        Ok(CierreAplicado {
            retirados,
            congelada: r.frozen,
        })
    }
}

/// El `permit` que pide `POST /upload/completed` NO viene como campo propio: hoy es el
/// ultimo segmento de `permit.url` (`/upload/permit-3` → `permit-3`), que es lo que hace
/// `sim/ejercicio.ts`. Contra un prefirmado real ese segmento es la clave del objeto y
/// no un id de permiso. **Todo el acoplamiento con el simulador vive en ESTA funcion y
/// en ninguna otra parte**, para que el cambio sea de una linea.
fn id_de_permiso(url: &str) -> Result<PermisoId, FalloDeProtocolo> {
    url.rsplit('/')
        .next()
        .filter(|s| !s.is_empty())
        .map(|s| PermisoId(s.to_string()))
        .ok_or_else(|| FalloDeProtocolo::DestinoDePermisoInvalido(url.to_string()))
}

/// Absoluta si el servidor mando una absoluta; concatenada a la base si mando una
/// relativa, que es lo que hace el simulador. Es lo que permite que el mismo cliente
/// hable con los dos sin una rama de configuracion — y quien lo vuelve verdad es
/// `destino_del_put`, que parte esa cadena en autoridad y ruta.
fn resolver_destino(base: &BaseDeApi, url: &str) -> String {
    if url.starts_with("http://") || url.starts_with("https://") {
        return url.to_string();
    }
    base.ruta(url)
}

/// EL SOCKET Y EL REQUEST-TARGET DEL PUT, partidos. Publico al crate para que el banco
/// pueda afirmar sobre el reparto sin abrir una conexion.
///
/// Un destino absoluto manda a SU host —es la unica forma de que «la API nunca toca
/// bytes» sea cierta con un permiso prefirmado real— y uno relativo cae a la base, que es
/// lo que hace el simulador. Un destino `https` **falla en vez de degradar**:
/// `transporte.rs` no tiene TLS y lo dice, y mandar los bytes del usuario en claro (o al
/// host equivocado) porque el esquema no se soporta es exactamente el fallo silencioso que
/// este archivo existe para no tener. El dia que entre `ureq` con `rustls`, este brazo se
/// borra.
pub(crate) fn destino_del_put(
    base: &BaseDeApi,
    destino: &str,
) -> Result<(String, String), FalloDeProtocolo> {
    if let Some(resto) = destino.strip_prefix("http://") {
        let (autoridad, ruta) = match resto.find('/') {
            Some(i) => (resto[..i].to_string(), resto[i..].to_string()),
            None => (resto.to_string(), "/".to_string()),
        };
        if autoridad.is_empty() {
            return Err(FalloDeProtocolo::DestinoDePermisoInvalido(
                destino.to_string(),
            ));
        }
        return Ok((autoridad, ruta));
    }
    if destino.starts_with("https://") {
        return Err(FalloDeProtocolo::DestinoDePermisoInvalido(format!(
            "{destino} (este transporte no tiene TLS: ver protocolo/transporte.rs)"
        )));
    }
    Ok((base.autoridad.clone(), destino.to_string()))
}
