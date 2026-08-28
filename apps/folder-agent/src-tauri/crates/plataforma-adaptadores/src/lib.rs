#[cfg(target_os = "macos")]
pub mod macos;
// SIN `#[cfg(target_os = ...)]`, y no es un olvido: `macos`/`windows` de arriba SÍ
// gatean por SO porque implementan `Plataforma` con syscalls de una sola plataforma
// cada uno. `observador.rs` es distinto — usa `notify`, que resuelve sus propios
// backends de macOS/Windows por dentro — así que este es el primer módulo del crate
// que corre en cualquier SO donde el workspace compile.
pub mod observador;
#[cfg(target_os = "windows")]
pub mod windows;
