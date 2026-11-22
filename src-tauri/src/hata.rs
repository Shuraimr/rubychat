//! One error type for the whole backend. It is serialized to the UI as `{ "tur": "...", "mesaj": "..." }`
//! so the Svelte side can pick a Turkish message from `tur` and still show `mesaj` (technical detail) when useful.
//! Bütün arka uç için tek hata türü. Arayüze `{ "tur": "...", "mesaj": "..." }` olarak gider;
//! Svelte tarafı `tur`a göre Türkçe metin seçer, gerekirse `mesaj`ı (teknik ayrıntı) da gösterir.

use serde::{ser::SerializeStruct, Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum Hata {
    #[error("ağ hatası: {0}")]
    Ag(String),
    #[error("giriş reddedildi: {0}")]
    Giris(String),
    #[error("sunucu bulunamadı: {0}")]
    SunucuBulunamadi(String),
    #[error("kayıtlı oturum yok")]
    OturumYok,
    #[error("oda bulunamadı")]
    OdaBulunamadi,
    #[error("depolama hatası: {0}")]
    Depolama(String),
    #[error("matrix hatası: {0}")]
    Matrix(String),
    #[error("şifreleme hatası: {0}")]
    Sifreleme(String),
    #[error("{0}")]
    Diger(String),
}

impl Hata {
    /// The stable machine-readable kind (matches `Hata["tur"]` in tipler.ts).
    /// Makine tarafından okunan kararlı tür (tipler.ts'teki `Hata["tur"]` ile aynı).
    fn tur(&self) -> &'static str {
        match self {
            Hata::Ag(_) => "ag",
            Hata::Giris(_) => "giris",
            Hata::SunucuBulunamadi(_) => "sunucu_bulunamadi",
            Hata::OturumYok => "oturum_yok",
            Hata::OdaBulunamadi => "oda_bulunamadi",
            Hata::Depolama(_) => "depolama",
            Hata::Matrix(_) => "matrix",
            Hata::Sifreleme(_) => "sifreleme",
            Hata::Diger(_) => "diger",
        }
    }
}

impl Serialize for Hata {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let mut st = s.serialize_struct("Hata", 2)?;
        st.serialize_field("tur", self.tur())?;
        st.serialize_field("mesaj", &self.to_string())?;
        st.end()
    }
}

pub type Sonuc<T> = Result<T, Hata>;

impl From<matrix_sdk::Error> for Hata {
    fn from(e: matrix_sdk::Error) -> Self {
        use matrix_sdk::ruma::api::error::ErrorKind;
        match e.client_api_error_kind() {
            Some(ErrorKind::Forbidden) | Some(ErrorKind::UnknownToken { .. }) => Hata::Giris(e.to_string()),
            _ => Hata::Matrix(e.to_string()),
        }
    }
}

impl From<matrix_sdk::HttpError> for Hata {
    fn from(e: matrix_sdk::HttpError) -> Self {
        use matrix_sdk::ruma::api::error::ErrorKind;
        match e.client_api_error_kind() {
            Some(ErrorKind::Forbidden) | Some(ErrorKind::UnknownToken { .. }) => Hata::Giris(e.to_string()),
            Some(_) => Hata::Matrix(e.to_string()),
            None => Hata::Ag(e.to_string()),
        }
    }
}

impl From<matrix_sdk::ClientBuildError> for Hata {
    fn from(e: matrix_sdk::ClientBuildError) -> Self {
        match e {
            matrix_sdk::ClientBuildError::Http(_) | matrix_sdk::ClientBuildError::AutoDiscovery(_) => {
                // Debug (not Display) keeps the whole cause chain (DNS / TLS / HTTP status). · Display değil Debug: tüm sebep zinciri (DNS / TLS / HTTP durumu) kalır.
                Hata::SunucuBulunamadi(format!("{e:?}"))
            }
            other => Hata::Diger(other.to_string()),
        }
    }
}

impl From<matrix_sdk_ui::timeline::Error> for Hata {
    fn from(e: matrix_sdk_ui::timeline::Error) -> Self {
        Hata::Matrix(e.to_string())
    }
}

impl From<matrix_sdk_ui::sync_service::Error> for Hata {
    fn from(e: matrix_sdk_ui::sync_service::Error) -> Self {
        Hata::Matrix(e.to_string())
    }
}

impl From<std::io::Error> for Hata {
    fn from(e: std::io::Error) -> Self {
        Hata::Depolama(e.to_string())
    }
}

impl From<serde_json::Error> for Hata {
    fn from(e: serde_json::Error) -> Self {
        Hata::Depolama(e.to_string())
    }
}

impl From<matrix_sdk::IdParseError> for Hata {
    fn from(e: matrix_sdk::IdParseError) -> Self {
        Hata::Diger(e.to_string())
    }
}

impl From<tauri::Error> for Hata {
    fn from(e: tauri::Error) -> Self {
        Hata::Depolama(e.to_string())
    }
}
