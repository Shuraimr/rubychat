//! Everything that talks to Matrix. Each file is one concern; `komutlar.rs` only calls into these.
//! Matrix ile konuşan her şey. Her dosya tek bir konu; `komutlar.rs` yalnızca bunları çağırır.
pub mod alanlar;
pub mod arama;
pub mod dizin;
pub mod ec;
pub mod esitleme;
pub mod eylemler;
pub mod medya;
pub mod istekler;
pub mod odalar;
pub mod onyukle;
pub mod oturum;
pub mod paketler;
pub mod profil;
pub mod sifreleme;
pub mod uyeler;
pub mod zaman;
