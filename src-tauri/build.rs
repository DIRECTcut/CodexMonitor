#[cfg(feature = "app")]
fn run_tauri_build() {
    tauri_build::build();
}

#[cfg(not(feature = "app"))]
fn run_tauri_build() {}

fn main() {
    run_tauri_build();

    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("ios") {
        println!("cargo:rustc-link-lib=z");
        println!("cargo:rustc-link-lib=iconv");
    }
}
