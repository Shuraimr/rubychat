//! Everything that talks to Matrix. Each file is one concern; `komutlar.rs` only calls into these.
//! Matrix ile konuşan her şey. Her dosya tek bir konu; `komutlar.rs` yalnızca bunları çağırır.
pub mod arama;
pub mod esitleme;
pub mod medya;
pub mod odalar;
pub mod oturum;
pub mod sifreleme;
pub mod zaman;
