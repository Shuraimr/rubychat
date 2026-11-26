//! Everything that talks to Matrix. Each file is one concern; `komutlar.rs` only calls into these.
//! Matrix ile konuşan her şey. Her dosya tek bir konu; `komutlar.rs` yalnızca bunları çağırır.
pub mod alan_yonetimi;
pub mod alanlar;
pub mod arama;
pub mod cihaz_giris;
pub mod dizin;
pub mod ec;
pub mod esitleme;
pub mod eylemler;
pub mod hesaplar;
pub mod kuyruk;
pub mod medya;
pub mod istekler;
pub mod kesif;
pub mod odalar;
pub mod onizleme;
pub mod onyukle;
pub mod oturum;
pub mod paketler;
pub mod profil;
pub mod sifreleme;
pub mod uyeler;
pub mod yerel_arama;
pub mod zaman;
