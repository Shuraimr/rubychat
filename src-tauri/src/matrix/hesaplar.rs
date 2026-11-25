//! Several signed-in accounts, one of them in use. Every account has a data folder of its own: the first one the app's data folder
//! itself (as before there were several), the others `hesaplar/<id>/`. `hesaplar.json` says which accounts exist; it holds no secrets.
//! Birden çok girişli hesap, biri kullanımda. Her hesabın kendi veri klasörü var: ilkininki uygulamanın veri klasörünün kendisi (tek
//! hesap varken olduğu gibi), ötekilerinki `hesaplar/<id>/`. `hesaplar.json` hangi hesapların olduğunu söyler; gizli bilgi içermez.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::{hata::Sonuc, tipler::Ben};

const DOSYA: &str = "hesaplar.json";
pub const KLASOR: &str = "hesaplar";

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Hesap {
    /// Empty = the first account (data folder itself) · Boş = ilk hesap (veri klasörünün kendisi)
    pub id: String,
    pub kullanici_id: String,
    pub sunucu: String,
    #[serde(default)]
    pub ad: Option<String>,
    #[serde(default)]
    pub avatar_mxc: Option<String>,
}

#[derive(Serialize, Deserialize, Default, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Hesaplar {
    pub aktif: String,
    pub liste: Vec<Hesap>,
}

impl Hesaplar {
    pub fn oku(kok: &Path) -> Hesaplar {
        std::fs::read(kok.join(DOSYA)).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default()
    }

    /// Through a temporary file: a half-written list would lose the way to the other accounts. · Geçici dosya üzerinden: yarım yazılan liste öteki hesapların yolunu kaybettirirdi.
    pub fn yaz(&self, kok: &Path) -> Sonuc<()> {
        std::fs::create_dir_all(kok)?;
        let gecici = kok.join(format!("{DOSYA}.yeni"));
        std::fs::write(&gecici, serde_json::to_vec_pretty(self)?)?;
        std::fs::rename(gecici, kok.join(DOSYA))?;
        Ok(())
    }

    pub fn klasor(&self, kok: &Path) -> PathBuf {
        klasor(kok, &self.aktif)
    }

    /// Records the account in use; keeps the name and picture it already had. · Kullanımdaki hesabı yazar; önceki adı ve resmi korunur.
    pub fn kaydet(&mut self, ben: &Ben) {
        let aktif = self.aktif.clone();
        match self.liste.iter_mut().find(|h| h.id == aktif) {
            Some(h) => {
                h.kullanici_id = ben.kullanici_id.clone();
                h.sunucu = ben.sunucu.clone();
                if ben.gorunen_ad.is_some() {
                    h.ad = ben.gorunen_ad.clone();
                }
                if ben.avatar_mxc.is_some() {
                    h.avatar_mxc = ben.avatar_mxc.clone();
                }
            }
            None => self.liste.push(Hesap {
                id: aktif,
                kullanici_id: ben.kullanici_id.clone(),
                sunucu: ben.sunucu.clone(),
                ad: ben.gorunen_ad.clone(),
                avatar_mxc: ben.avatar_mxc.clone(),
            }),
        }
    }

    /// Forgets the account in use and turns to another one, if any. · Kullanımdaki hesabı unutur, varsa başkasına döner.
    pub fn aktifi_sil(&mut self) {
        let aktif = std::mem::take(&mut self.aktif);
        self.liste.retain(|h| h.id != aktif);
        if let Some(h) = self.liste.first() {
            self.aktif = h.id.clone();
        }
    }

    /// Turns to a place no account uses. · Hiçbir hesabın kullanmadığı bir yere döner.
    pub fn yeni_yer(&mut self) {
        self.aktif = if self.liste.iter().any(|h| h.id.is_empty()) { format!("{:016x}", rand::random::<u64>()) } else { String::new() };
    }
}

pub fn klasor(kok: &Path, id: &str) -> PathBuf {
    if id.is_empty() {
        kok.to_owned()
    } else {
        kok.join(KLASOR).join(id)
    }
}

/// Secrets key of the account living in `veri`. · `veri` klasöründeki hesabın gizli bilgi anahtarı.
pub fn gizli_anahtar(veri: &Path, taban: &str) -> String {
    let alt = veri.parent().and_then(|p| p.file_name()).is_some_and(|a| a == KLASOR);
    match veri.file_name().and_then(|a| a.to_str()) {
        Some(id) if alt => format!("{taban}.{id}"),
        _ => taban.to_owned(),
    }
}

#[cfg(test)]
mod testler {
    use super::*;

    fn ben(id: &str) -> Ben {
        Ben { kullanici_id: id.into(), cihaz_id: String::new(), gorunen_ad: None, avatar_mxc: None, sunucu: "s".into(), gizli_depo: "dosya".into() }
    }

    #[test]
    fn hesaplar_birbirine_karismaz() {
        let kok = Path::new("/v");
        let mut h = Hesaplar::default();
        h.kaydet(&ben("@a:s"));
        assert_eq!(h.klasor(kok), kok);
        assert_eq!(gizli_anahtar(&h.klasor(kok), "oturum"), "oturum");
        h.yeni_yer();
        let ikinci = h.klasor(kok);
        assert!(ikinci.starts_with("/v/hesaplar"));
        assert!(gizli_anahtar(&ikinci, "oturum").starts_with("oturum."));
        h.kaydet(&ben("@b:s"));
        h.kaydet(&ben("@b:s"));
        assert_eq!(h.liste.len(), 2);
        // Logging out of one returns to the other. · Birinden çıkınca ötekine dönülür.
        h.aktifi_sil();
        assert_eq!(h.liste.len(), 1);
        assert_eq!(h.klasor(kok), kok);
        // The first account's place is reused once it is free. · İlk hesabın yeri boşalınca yeniden kullanılır.
        h.aktifi_sil();
        h.yeni_yer();
        assert_eq!(h.klasor(kok), kok);
    }
}
