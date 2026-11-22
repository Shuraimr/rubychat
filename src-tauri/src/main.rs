// Prevents an extra console window on Windows in release; DO NOT REMOVE.
// Windows'ta yayın sürümünde fazladan konsol penceresini engeller; KALDIRMA.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    rubychat_lib::run()
}
