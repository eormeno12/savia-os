//! HTTP/1.1 a mano sobre `TcpStream`, y **es una decision con disparador nombrado**.
//!
//! El diseno de `protocolo` elegia `ureq` 3.4 con `rustls`, y las razones eran buenas y
//! verificadas: `impl AsSendBody for File` deriva el `Content-Length` de `metadata()`
//! —con un `Read` generico se manda `Transfer-Encoding: chunked`, que Node acepta feliz
//! y un PUT prefirmado de S3 rechaza, o sea banco verde y produccion rota—, y
//! `http_status_as_error = false` conserva el cuerpo del error, que en el simulador ES
//! el diagnostico entero.
//!
//! Nada de eso se pierde aca, porque este cliente hace las dos cosas a proposito: manda
//! SIEMPRE `Content-Length` y **nunca** `chunked`, y devuelve el cuerpo junto con el
//! codigo pase lo que pase.
//!
//! LO QUE SI FALTA, Y ES EL DISPARADOR: **no hay TLS**. Este tramo habla con
//! `127.0.0.1:4477`. El dia que exista un permiso prefirmado real —https, a otro host,
//! con redirecciones— se cambia por `ureq` con `rustls` y la edicion es de ESTE archivo
//! y de ninguno mas.
#![forbid(unsafe_code)]

use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;

/// SIN `impl Default`, y es la misma disciplina que el resto del repo: un timeout es un
/// numero que decide comportamiento y este modulo no tiene con que medirlo. Lo nombra
/// quien construye el cliente — el binario o el banco.
#[derive(Clone, Copy, Debug)]
pub struct Tiempos {
    pub conexion: Duration,
    pub por_llamada: Duration,
    /// `None` a proposito: una subida de 50 MB por un enlace malo no tiene plazo
    /// defendible, y cortarla cuesta re-subir entera.
    pub envio_de_cuerpo: Option<Duration>,
}

#[derive(Debug)]
pub enum FalloDeRed {
    NoResuelve(String),
    NoConecta(String),
    Escritura(String),
    Lectura(String),
    RespuestaMalformada(String),
}

pub struct Respuesta {
    pub codigo: u16,
    pub cuerpo: String,
}

/// `host:puerto` mas la ruta. La base se CONCATENA, nunca `Url::join`: el simulador
/// rutea por `${method} ${url}` exacto, asi que una barra final, un query o un join que
/// se coma el ultimo segmento devuelven 404 — y un 404 se clasifica como cola muerta, o
/// sea que un typo de configuracion parece seis bugs de contrato.
pub fn pedir(
    autoridad: &str,
    metodo: &str,
    ruta: &str,
    cuerpo: &[u8],
    tipo: Option<&str>,
    tiempos: &Tiempos,
) -> Result<Respuesta, FalloDeRed> {
    use std::net::ToSocketAddrs;
    let dir = autoridad
        .to_socket_addrs()
        .map_err(|e| FalloDeRed::NoResuelve(e.to_string()))?
        .next()
        .ok_or_else(|| FalloDeRed::NoResuelve(autoridad.to_string()))?;
    let mut s = TcpStream::connect_timeout(&dir, tiempos.conexion)
        .map_err(|e| FalloDeRed::NoConecta(e.to_string()))?;
    s.set_read_timeout(Some(tiempos.por_llamada)).ok();
    s.set_write_timeout(tiempos.envio_de_cuerpo.or(Some(tiempos.por_llamada)))
        .ok();

    let mut cab = format!(
        "{metodo} {ruta} HTTP/1.1\r\nHost: {autoridad}\r\nConnection: close\r\nContent-Length: {}\r\n",
        cuerpo.len()
    );
    if let Some(t) = tipo {
        cab.push_str(&format!("Content-Type: {t}\r\n"));
    }
    cab.push_str("\r\n");
    s.write_all(cab.as_bytes())
        .map_err(|e| FalloDeRed::Escritura(e.to_string()))?;
    s.write_all(cuerpo)
        .map_err(|e| FalloDeRed::Escritura(e.to_string()))?;
    s.flush()
        .map_err(|e| FalloDeRed::Escritura(e.to_string()))?;

    let mut crudo = Vec::new();
    s.read_to_end(&mut crudo)
        .map_err(|e| FalloDeRed::Lectura(e.to_string()))?;
    let texto = String::from_utf8_lossy(&crudo).to_string();
    let (cabeceras, cuerpo) = texto
        .split_once("\r\n\r\n")
        .ok_or_else(|| FalloDeRed::RespuestaMalformada("sin separador de cabeceras".into()))?;
    let primera = cabeceras
        .lines()
        .next()
        .ok_or_else(|| FalloDeRed::RespuestaMalformada("sin linea de estado".into()))?;
    let codigo: u16 = primera
        .split_whitespace()
        .nth(1)
        .and_then(|c| c.parse().ok())
        .ok_or_else(|| FalloDeRed::RespuestaMalformada(primera.to_string()))?;
    // `Connection: close` NO alcanza: Node no declara `Content-Length` y contesta
    // `Transfer-Encoding: chunked` igual. Se descubrio corriendo el binario contra
    // `sim/server.ts`, y el sintoma era del peor tipo —el `sweepId` llegaba envuelto en
    // los marcadores de tamano, `serde` no lo reconocia, y el `Sobre` lo clasificaba
    // como cuerpo malformado: o sea, COLA MUERTA por un problema de transporte—.
    let chunked = cabeceras
        .lines()
        .any(|l| l.to_ascii_lowercase().starts_with("transfer-encoding:") && l.contains("chunked"));
    let cuerpo = if chunked {
        desarmar_chunked(cuerpo)?
    } else {
        cuerpo.to_string()
    };
    Ok(Respuesta { codigo, cuerpo })
}

/// Desarma `Transfer-Encoding: chunked`. Es lo minimo que hace falta para hablar con un
/// servidor de Node, y es tambien la razon por la que este archivo tiene fecha de
/// vencimiento: cada linea de aca es una que `ureq` ya tiene resuelta.
fn desarmar_chunked(cuerpo: &str) -> Result<String, FalloDeRed> {
    let mut salida = String::new();
    let mut resto = cuerpo;
    loop {
        let Some((cabeza, cola)) = resto.split_once("\r\n") else {
            return Err(FalloDeRed::RespuestaMalformada(
                "chunk sin terminador".into(),
            ));
        };
        // El tamano puede traer extensiones despues de un `;`; se ignoran.
        let hex = cabeza.split(';').next().unwrap_or("").trim();
        let n = usize::from_str_radix(hex, 16)
            .map_err(|_| FalloDeRed::RespuestaMalformada(format!("tamano de chunk: {hex}")))?;
        if n == 0 {
            return Ok(salida);
        }
        if cola.len() < n {
            return Err(FalloDeRed::RespuestaMalformada("chunk incompleto".into()));
        }
        salida.push_str(&cola[..n]);
        resto = cola[n..].trim_start_matches("\r\n");
    }
}
