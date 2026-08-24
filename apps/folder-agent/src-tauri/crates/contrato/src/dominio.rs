//! El vocabulario que TODOS los modulos comparten, y el unico que los seis disenos
//! previos nombraban distinto. Es el equivalente de `packages/ir` para este crate: lo
//! que se congela primero y lo que los demas implementan.
//!
//! LAS RESOLUCIONES DE NOMBRE, porque los disenos se contradecian y hay que dejarlo
//! escrito donde se lee el codigo y no en un resumen que nadie vuelve a abrir:
//!
//!   · el instante monotonico se llamaba `InstanteContinuo` (plataforma), `Instante`
//!     (maquina, colas) y `Monotonico` (salvaguardas). Queda **`Instante`**, porque es
//!     el que usa la maquina, que es el modulo central.
//!   · la tripleta se llamaba `Observacion` (maquina) y `Huella` (salvaguardas). Queda
//!     **`Observacion`**, por lo mismo. `Huella` se reserva para la de la RAIZ, que es
//!     otra cosa y en salvaguardas colisionaba.
//!   · `IdDeArchivo` era `u128` (plataforma, maquina) y `Box<[u8]>` opaco (inventario,
//!     salvaguardas). Queda **`u128`**: cubre el `FILE_ID_128` de ReFS entero y el par
//!     `(st_dev, st_ino)` de APFS, y un `Box<[u8]>` obliga a asignar en el camino mas
//!     caliente del barrido, que es exactamente donde no se puede.

use std::time::Duration;

/// **UN MAPA CON CLAVE DE TUPLA NO CABE EN UN OBJETO JSON**, que solo admite claves de
/// texto. Los dos mapas del estado que van con clave compuesta —`(raiz, ruta)`— se
/// guardan como LISTA DE PARES.
///
/// Se elige esto y no un formato binario que si admita claves arbitrarias porque el
/// deposito ya usa `serde_json`, que el crate tenia: sumar otro formato seria una
/// dependencia mas para no escribir doce lineas. El orden no se pierde — el destino es un
/// `BTreeMap`, asi que la lista puede volver en cualquier orden y el mapa queda igual.
pub mod mapa_como_lista {
    use serde::{Deserialize, Deserializer, Serialize, Serializer};
    use std::collections::BTreeMap;

    pub fn serialize<K, V, S>(m: &BTreeMap<K, V>, s: S) -> Result<S::Ok, S::Error>
    where
        K: Serialize,
        V: Serialize,
        S: Serializer,
    {
        s.collect_seq(m.iter())
    }

    pub fn deserialize<'de, K, V, D>(d: D) -> Result<BTreeMap<K, V>, D::Error>
    where
        K: Deserialize<'de> + Ord,
        V: Deserialize<'de>,
        D: Deserializer<'de>,
    {
        Ok(Vec::<(K, V)>::deserialize(d)?.into_iter().collect())
    }
}

// ───────────────────────────── Identidades ──────────────────────────────────

/// Espejo local de `RootId` (GLOSARIO P32). Se acuna al enrolar y **NO ES UNA RUTA**.
/// El campo es privado a proposito: con un `String` publico, pasarle el path absoluto
/// compila, y a partir de ahi mover la raiz cambia la identidad de todo lo que hay
/// adentro — que es el desastre que `RutaRelativa` existe para evitar, reintroducido un
/// nivel mas arriba.
#[derive(
    serde::Serialize, serde::Deserialize, Clone, PartialEq, Eq, Hash, Debug, PartialOrd, Ord,
)]
pub struct RaizId(String);

impl RaizId {
    pub fn nueva(s: impl Into<String>) -> Self {
        Self(s.into())
    }
    pub fn como_str(&self) -> &str {
        &self.0
    }
}

/// La ruta RELATIVA a la raiz, en forma canonica (decision 9: NFC y separador `/`).
///
/// Relativa y nunca absoluta: si el usuario mueve `~/Savia` a `~/Documents/Savia`, con
/// rutas absolutas **todos** los archivos parecen desaparecer a la vez. Con relativas,
/// mover la raiz entera es UN solo hecho — y por la decision 7 ni siquiera eso, porque
/// reelegirla da el mismo `RootId`.
#[derive(
    serde::Serialize, serde::Deserialize, Clone, PartialEq, Eq, Hash, Debug, PartialOrd, Ord,
)]
pub struct RutaRelativa(String);

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum RutaInvalida {
    Absoluta,
    /// Contiene un `..` que sale de la raiz. Un enlace o un `..` que escapa mete en el
    /// corpus archivos que el usuario no eligio.
    Escapa,
    Vacia,
}

impl RutaRelativa {
    /// La forma canonica del protocolo. Hace cuatro cosas y **una la hace a medias**,
    /// que hay que decirlo:
    ///
    ///  1. rechaza absolutas, vacias y las que escapan con `..`;
    ///  2. traduce `\` a `/`, porque el separador es parte del contrato;
    ///  3. colapsa `//` y saca los `.` intermedios;
    ///  4. **compone las secuencias latinas descompuestas** — y NO es NFC completo.
    ///
    /// LO QUE FALTA, DICHO DE FRENTE: NFC de verdad necesita `unicode-normalization`, y
    /// esa dep es de ESTE modulo el dia que se agregue. Lo que hay hoy cubre el caso
    /// que realmente produce HFS+ en un escritorio hispanohablante —vocales y ene con
    /// tilde, dieresis, acento y cedilla guardadas descompuestas— y deja afuera el
    /// resto de Unicode. La consecuencia de la parte que falta es acotada y conocida:
    /// un archivo con un nombre descompuesto fuera de esa tabla puede aparecer con dos
    /// grafias. No es una perdida de datos; es una fila duplicada en el panel.
    pub fn canonica(bruta: &str) -> Result<Self, RutaInvalida> {
        let unificada = bruta.replace('\\', "/");
        if unificada.starts_with('/') {
            return Err(RutaInvalida::Absoluta);
        }
        let mut partes: Vec<&str> = Vec::new();
        for seg in unificada.split('/') {
            match seg {
                "" | "." => continue,
                ".." => {
                    // Se rechaza en vez de resolverse. Resolverlo dejaria pasar
                    // `a/../../b`, que sale de la raiz, y el modulo que canonicaliza no
                    // es quien decide que entra al corpus.
                    return Err(RutaInvalida::Escapa);
                }
                otro => partes.push(otro),
            }
        }
        if partes.is_empty() {
            return Err(RutaInvalida::Vacia);
        }
        Ok(Self(componer_latino(&partes.join("/"))))
    }

    pub fn como_str(&self) -> &str {
        &self.0
    }
}

/// La composicion parcial del punto 4 de arriba. Se llama por lo que hace y no `a_nfc`,
/// justamente para que nadie la lea como la normalizacion completa que no es.
fn componer_latino(s: &str) -> String {
    let mut salida = String::with_capacity(s.len());
    let mut cs = s.chars().peekable();
    while let Some(base) = cs.next() {
        let compuesto = match cs.peek().copied() {
            Some(marca) => compone(base, marca),
            None => None,
        };
        match compuesto {
            Some(c) => {
                cs.next();
                salida.push(c);
            }
            None => salida.push(base),
        }
    }
    salida
}

fn compone(base: char, marca: char) -> Option<char> {
    // U+0300 grave · U+0301 agudo · U+0302 circunflejo · U+0303 tilde
    // U+0308 dieresis · U+0327 cedilla
    let par = (base, marca);
    let c = match par {
        ('a', '\u{301}') => 'á',
        ('e', '\u{301}') => 'é',
        ('i', '\u{301}') => 'í',
        ('o', '\u{301}') => 'ó',
        ('u', '\u{301}') => 'ú',
        ('n', '\u{301}') => 'ń',
        ('A', '\u{301}') => 'Á',
        ('E', '\u{301}') => 'É',
        ('I', '\u{301}') => 'Í',
        ('O', '\u{301}') => 'Ó',
        ('U', '\u{301}') => 'Ú',
        ('a', '\u{300}') => 'à',
        ('e', '\u{300}') => 'è',
        ('i', '\u{300}') => 'ì',
        ('o', '\u{300}') => 'ò',
        ('u', '\u{300}') => 'ù',
        ('A', '\u{300}') => 'À',
        ('E', '\u{300}') => 'È',
        ('I', '\u{300}') => 'Ì',
        ('O', '\u{300}') => 'Ò',
        ('U', '\u{300}') => 'Ù',
        ('a', '\u{302}') => 'â',
        ('e', '\u{302}') => 'ê',
        ('i', '\u{302}') => 'î',
        ('o', '\u{302}') => 'ô',
        ('u', '\u{302}') => 'û',
        ('A', '\u{302}') => 'Â',
        ('E', '\u{302}') => 'Ê',
        ('I', '\u{302}') => 'Î',
        ('O', '\u{302}') => 'Ô',
        ('U', '\u{302}') => 'Û',
        ('n', '\u{303}') => 'ñ',
        ('N', '\u{303}') => 'Ñ',
        ('a', '\u{303}') => 'ã',
        ('o', '\u{303}') => 'õ',
        ('A', '\u{303}') => 'Ã',
        ('O', '\u{303}') => 'Õ',
        ('a', '\u{308}') => 'ä',
        ('e', '\u{308}') => 'ë',
        ('i', '\u{308}') => 'ï',
        ('o', '\u{308}') => 'ö',
        ('u', '\u{308}') => 'ü',
        ('A', '\u{308}') => 'Ä',
        ('E', '\u{308}') => 'Ë',
        ('I', '\u{308}') => 'Ï',
        ('O', '\u{308}') => 'Ö',
        ('U', '\u{308}') => 'Ü',
        ('c', '\u{327}') => 'ç',
        ('C', '\u{327}') => 'Ç',
        _ => return None,
    };
    Some(c)
}

/// La forma con la que se BUSCA, que no es la que se muestra ni la que viaja.
///
/// La decision 9 deja la sensibilidad a mayusculas del lado del agente porque es el
/// unico que sabe si su sistema de archivos las distingue. Plegarla en un tipo aparte
/// convierte esa rama en un DATO en vez de un `if` repartido por todo el modulo.
#[derive(
    serde::Serialize, serde::Deserialize, Clone, PartialEq, Eq, Hash, Debug, PartialOrd, Ord,
)]
pub struct ClaveDeRuta(String);

#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum SensibilidadAMayusculas {
    Distingue,
    NoDistingue,
}

pub fn clave_de_ruta(p: &RutaRelativa, s: SensibilidadAMayusculas) -> ClaveDeRuta {
    match s {
        SensibilidadAMayusculas::Distingue => ClaveDeRuta(p.0.clone()),
        SensibilidadAMayusculas::NoDistingue => ClaveDeRuta(p.0.to_lowercase()),
    }
}

// ───────────────────────────── Los dos hashes ───────────────────────────────

/// Lo que el agente computo leyendo bytes locales. Es una **AFIRMACION**.
///
/// Vive aca, donde todos lo alcanzan, porque afirmar es gratis y cualquiera lo puede
/// hacer. Su gemelo verificado esta abajo con las puertas contadas.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub struct HashAfirmado([u8; 32]);

/// Lo que ESTE lado confirmo: la respuesta `known`, o el `verifiedHash` que devuelve
/// `upload.completed`.
///
/// **TRES PUERTAS Y NINGUNA MAS**, y su escasez es la regla, no un detalle: no existe
/// `From<HashAfirmado>`. Sin eso, guardar el afirmado donde va el verificado seria un
/// descuido de una linea, y el sintoma —una baja posterior que no matchea con ningun
/// documento, para siempre— aparece meses despues y no se parece a su causa.
///
/// Las tres puertas son `desde_coincidencia_known` (la llama
/// `protocolo::Cliente::reportar_observados`, cuando el servidor contesta `known`),
/// `desde_hex_verificado` (la llama `protocolo::Cliente::confirmar_subida`, con el
/// `verifiedHash` de `upload.completed`) y `rehidratar_del_inventario`. Que sean tres y
/// no mas lo verifica un guardian de texto en `guardianes/tests/guardianes.rs`: Rust no
/// tiene forma de decir "esta `pub fn` la llama el crate `protocolo` y ningun otro" —
/// entre crates una funcion es `pub` (cualquiera la llama) o no es alcanzable, asi que
/// lo que sostiene "exactamente estas puertas, exactamente asi de veces" sigue siendo
/// una prueba que lee las fuentes, no el compilador.
///
/// **LO QUE ESTAS DOS FIRMAS SI CIERRAN POR TIPO, Y LO QUE NO:** ya no existe un
/// `acunar(bytes)` generico, asi que desaparecio la forma de pasar un `[u8; 32]`
/// inventado en el sitio de la llamada. `desde_coincidencia_known` exige tener primero
/// un `HashAfirmado`, y `desde_hex_verificado` exige un string que primero pase por
/// `de_hex` — la validacion de forma es en runtime, no algo que el tipo del parametro
/// imponga por si solo. Ninguna de las dos impide que un llamador FABRIQUE esa
/// evidencia a mano —`HashAfirmado::de_bytes([0; 32])` sigue siendo publica, porque
/// afirmar es gratis por diseno—; lo que cierran es el atajo de una linea que iba
/// directo de bytes crudos a "verificado".
///
/// **LA GRIETA QUE ESTO NO TAPA, DICHA DE FRENTE:** el tipo deriva `serde::Deserialize`,
/// y el codigo que ese derive genera lee el campo privado sin pasar por ninguna de las
/// tres puertas. Es una CUARTA via de construccion que ya existia con un solo crate y
/// sigue existiendo con doce — ninguna firma de este archivo la cierra, porque cerrarla
/// es un problema distinto (un `Deserialize` escrito a mano, o un newtype de
/// deserializacion que si pase por una puerta) y no es lo que esta fase pide.
#[must_use = "el verificado es la autoridad: corregi el inventario con este, nunca con el afirmado"]
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub struct HashVerificado([u8; 32]);

impl HashAfirmado {
    pub fn de_bytes(b: [u8; 32]) -> Self {
        Self(b)
    }
    pub fn bytes(&self) -> &[u8; 32] {
        &self.0
    }
    pub fn hex(&self) -> String {
        a_hex(&self.0)
    }
}

impl HashVerificado {
    /// LA PRIMERA PUERTA: una coincidencia `known`. El servidor solo puede contestar
    /// eso si ESTE lado ya escribio el objeto y ya lo hasheo — la respuesta misma es la
    /// verificacion. Por eso no toma bytes sueltos: toma el `HashAfirmado` que el
    /// pedido YA llevaba, y promoverlo es lo unico que esta funcion hace.
    ///
    /// La llama `protocolo::Cliente::reportar_observados`, una vez, cuando
    /// `VeredictoDeAlambre::Known` llega.
    pub fn desde_coincidencia_known(afirmado: HashAfirmado) -> Self {
        Self(*afirmado.bytes())
    }

    /// LA SEGUNDA PUERTA: el `verifiedHash` de `upload.completed`, todavia en hex
    /// porque asi viaja el alambre. Parsear ACA adentro —y no en `protocolo`, con
    /// `de_hex` mas un `acunar` generico— es lo que cierra el otro costado: no queda un
    /// paso intermedio por `[u8; 32]` donde un llamador pueda meter bytes propios en
    /// vez de los que efectivamente vinieron del servidor.
    ///
    /// La llama `protocolo::Cliente::confirmar_subida`, una vez, con
    /// `r.verified_hash`.
    pub fn desde_hex_verificado(hex: &str) -> Result<Self, HashHexInvalido> {
        de_hex(hex).map(Self).ok_or(HashHexInvalido)
    }

    /// La TERCERA puerta: el inventario que se relee del disco al arrancar. Se llama
    /// asi de largo para que un `grep` la encuentre y para que nadie la use por
    /// comodidad. Sigue tomando bytes crudos a proposito, a diferencia de las dos de
    /// arriba: lo que rehidrata ya paso por una de esas dos puertas en una corrida
    /// anterior — exigirle un `HashAfirmado` o un hex de servidor en el arranque no
    /// tendria con que llenarse.
    pub fn rehidratar_del_inventario(b: [u8; 32]) -> Self {
        Self(b)
    }
    pub fn bytes(&self) -> &[u8; 32] {
        &self.0
    }
    pub fn hex(&self) -> String {
        a_hex(&self.0)
    }
}

/// El error de `desde_hex_verificado`: el string no tenia forma de sha256 hex (64
/// caracteres hexadecimales). Sin datos adentro a proposito — `protocolo` ya tiene el
/// string original en `r.verified_hash` cuando este error vuelve, asi que es ahi donde
/// se arma el mensaje con el detalle, no aca.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct HashHexInvalido;

pub fn a_hex(b: &[u8; 32]) -> String {
    let mut s = String::with_capacity(64);
    for x in b {
        s.push(char::from_digit((x >> 4) as u32, 16).unwrap());
        s.push(char::from_digit((x & 15) as u32, 16).unwrap());
    }
    s
}

pub fn de_hex(s: &str) -> Option<[u8; 32]> {
    if s.len() != 64 {
        return None;
    }
    let mut out = [0u8; 32];
    let cs: Vec<char> = s.chars().collect();
    for (i, par) in cs.chunks(2).enumerate() {
        let alto = par[0].to_digit(16)?;
        let bajo = par[1].to_digit(16)?;
        out[i] = ((alto << 4) | bajo) as u8;
    }
    Some(out)
}

// ───────────────────────────── La tripleta ──────────────────────────────────

/// El `mtime` **CRUDO**, sin pasar por `SystemTime`.
///
/// El borrador dice «se guarda con la precision cruda del sistema y se compara con
/// tolerancia», y la tolerancia es politica de quien compara, no de quien mide. FAT
/// tiene granularidad de dos segundos y las unidades de red truncan distinto:
/// normalizar aca borra la evidencia de cual de los dos casos es.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub struct Mtime {
    pub segundos: i64,
    pub nanos: u32,
}

impl Mtime {
    /// Distancia absoluta entre dos `mtime`. Saturante porque un `mtime` puede venir
    /// del futuro —lo escribe quien escribe el archivo, no el agente— y un desborde en
    /// el camino caliente del barrido es peor que una distancia gigante.
    pub fn distancia(self, otro: Mtime) -> Duration {
        let a = self.segundos as i128 * 1_000_000_000 + self.nanos as i128;
        let b = otro.segundos as i128 * 1_000_000_000 + otro.nanos as i128;
        let d = (a - b).unsigned_abs();
        Duration::from_nanos(u64::try_from(d).unwrap_or(u64::MAX))
    }
}

/// El id de archivo del sistema. **UNA PISTA QUE SE VERIFICA, NUNCA UNA IDENTIDAD**:
/// NTFS recicla ids y un restore desde backup los cambia todos.
///
/// **SIN `Hash` y SIN `Ord`, y esa ausencia es el invariante**: no puede ser la clave de
/// un mapa. Si lo fuera, indexar el inventario por el compilaria, y a partir de ahi dos
/// archivos distintos con el id reciclado colapsan en una fila.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub struct IdDeArchivoDelSO(pub u128);

/// Lo que un `stat` deja ver, y NADA MAS. No lleva contenido a proposito: esta tripleta
/// decide si vale la pena leer bytes, asi que no puede necesitarlos.
#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub struct Observacion {
    pub tamano: u64,
    pub mtime: Mtime,
    /// `None` cuando el volumen no publica ninguno (unidades de red). El ciclo cae al
    /// hash y paga la E/S.
    pub id_de_archivo: Option<IdDeArchivoDelSO>,
}

// ───────────────────────────────── El reloj ─────────────────────────────────

/// Nanosegundos desde un origen arbitrario **QUE AVANZAN DURANTE LA SUSPENSION**.
///
/// Tipo propio y NO `std::time::Instant`, y la razon esta MEDIDA en la maquina de
/// desarrollo, no supuesta: con 24 h 13 min de uptime, `Instant::now()` daba
/// `tv_sec: 39783` —el mismo valor exacto que `mach_absolute_time`— contra 87733 s
/// reales de `mach_continuous_time`. Perdio 13 h 19 min: el 55 % del intervalo.
///
/// El caso que decide si una ventana vencio es justamente «pasaron seis horas y cinco
/// la laptop estuvo dormida», y con `Instant` esas seis horas son una. La consecuencia
/// concreta: el asentamiento no vence NUNCA en una laptop que se cierra, y el archivo
/// no se reporta jamas mientras el agente parece estar funcionando.
///
/// Que hoy `CLOCK_MONOTONIC` en Darwin si avance durante el sueno no cambia nada: la
/// garantia tiene que ser NUESTRA y estar escrita aca, no ser un detalle de
/// implementacion de std que ya cambio una vez.
#[derive(
    serde::Serialize, serde::Deserialize, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug,
)]
pub struct Instante(u64);

impl Instante {
    pub fn desde_nanos(n: u64) -> Self {
        Self(n)
    }
    pub fn nanos(self) -> u64 {
        self.0
    }
    /// Saturante a proposito: un reloj monotonico no deberia retroceder, y si lo hace,
    /// un panico en el observador es peor que un cero.
    pub fn transcurrido_desde(self, antes: Instante) -> Duration {
        Duration::from_nanos(self.0.saturating_sub(antes.0))
    }
}

/// El puerto del reloj. La implementacion es de plataforma justamente porque «avanza
/// durante la suspension» se dice distinto en cada sistema.
pub trait Reloj: Send + Sync {
    fn ahora(&self) -> Instante;
}

// ─────────────────────────────── El barrido ─────────────────────────────────

/// El barrido es la UNIDAD sobre la que se puede decir «completo» o «interrumpido». Sin
/// borde, «desaparecieron 40» no se compara contra nada y el corte por volumen no
/// existe.
#[derive(
    serde::Serialize, serde::Deserialize, Clone, PartialEq, Eq, Hash, Debug, PartialOrd, Ord,
)]
pub struct BarridoId(String);

impl BarridoId {
    pub fn nuevo(s: impl Into<String>) -> Self {
        Self(s.into())
    }
    pub fn como_str(&self) -> &str {
        &self.0
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum EstadoDelBarrido {
    /// Lo unico que le sirve a la cuarentena: prueba a la vez que la raiz esta viva y
    /// que los archivos siguen sin estar.
    Completo,
    /// Un barrido interrumpido y un borrado masivo producen el mismo conjunto de
    /// desapariciones. Este valor es lo unico que los separa.
    Interrumpido,
}
