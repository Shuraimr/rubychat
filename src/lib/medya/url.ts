// URLs of the Rust `medya` scheme for message media: `medya://localhost/m/<id>` (Android/Windows: `http://medya.localhost/m/<id>`).
// The id comes from `ZamanOgesi.medya.kaynakId` / `kucukId`; Rust decrypts encrypted media on the fly.
// Mesaj medyası için Rust `medya` şemasının adresleri: `medya://localhost/m/<id>` (Android/Windows: `http://medya.localhost/m/<id>`).
// Kimlik `ZamanOgesi.medya.kaynakId` / `kucukId`den gelir; Rust şifreli medyayı anında çözer.
const OZEL_SUNUM = /android|windows/i.test(navigator.userAgent);
const KOK = OZEL_SUNUM ? "http://medya.localhost" : "medya://localhost";

export const medyaUrl = (id: string): string => `${KOK}/m/${id}`;
