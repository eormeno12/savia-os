//! **EL CRUCE A WINDOWS SE SALTEA `tauri_build`, Y ESO NO DEBILITA EL CHEQUEO.**
//!
//! `nucleo:windows` existe por una sola garantia: **el nucleo no se ata a macOS**. La
//! comprueba compilando `lib.rs` —que no conoce Tauri en ningun lado— contra
//! `x86_64-pc-windows-msvc`. El binario `bandeja` no entra en esa garantia: es
//! justamente el archivo que SI conoce Tauri, y cruzarlo nunca fue el punto.
//!
//! Desde que Tauri es dependencia, `tauri_build::build()` compila un **recurso de
//! Windows** cuando el objetivo es Windows, y para eso invoca `llvm-rc`. Cruzando desde
//! una Mac ese programa no esta, asi que el guardian se caia con
//! `NotAttempted("llvm-rc")` — un fallo del script de build, no del codigo, y que no se
//! parece en nada a su causa. La alternativa era pedirle a cada quien que instale LLVM
//! para correr `pnpm lint`.
//!
//! **Lo que se pierde al saltear, dicho entero:** cruzando a Windows no se generan las
//! variables que `tauri::generate_context!` necesita, asi que **el binario `bandeja` no
//! compila para Windows en esta maquina**. Por eso `nucleo:windows` chequea `--lib` y no
//! `--all-targets`. El dia que haya un CI de Windows de verdad, ahi el binario se
//! compila entero y nativo, que es donde corresponde comprobarlo.
fn main() {
    let objetivo = std::env::var("TARGET").unwrap_or_default();
    if objetivo.contains("windows") && !cfg!(target_os = "windows") {
        println!("cargo:warning=cruce a Windows: se saltea tauri_build (ver build.rs)");
        return;
    }
    tauri_build::build();
}
