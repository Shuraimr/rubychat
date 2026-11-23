//! Instant message search: a local full-text index (tantivy) of every decrypted text message we have seen.
//! Anlık mesaj araması: gördüğümüz her çözülmüş metin mesajının yerel tam metin dizini (tantivy).
//!
//! Why a local index: Matrix server-side search cannot see inside end-to-end encrypted rooms, and scanning thousands of messages
//! in the webview on every keystroke is slow. Messages enter the index two ways:
//!   1. LIVE  – an event handler on the client indexes each message the sync delivers (already decrypted by the SDK).
//!   2. BACKFILL – a slow background task walks each room backwards through `/messages` and stores its progress on disk,
//!      so it resumes after a restart.
//! Sunucu tarafı arama uçtan uca şifreli odaların içini göremez; binlerce mesajı her tuşta webview'de taramak da yavaştır.
//! Mesajlar dizine iki yoldan girer: (1) CANLI – istemci olay işleyicisi eşitlemenin getirdiği (SDK'nın zaten çözdüğü) her
//! mesajı dizine ekler; (2) DOLDURMA – yavaş bir arka plan görevi her odayı `/messages` ile geriye yürür ve ilerlemesini diske
//! yazar; yeniden başlatınca kaldığı yerden sürer.
//!
//! Threading: tantivy's `IndexWriter` is blocking, so it lives on ONE dedicated std thread fed by a channel; commits happen
//! there (200 pending docs or 2 s). Searching runs on `spawn_blocking` (see `komutlar::mesaj_ara`).
//! İş parçacığı: tantivy `IndexWriter` bloklayıcıdır; bu yüzden bir kanalla beslenen TEK özel std iş parçacığında yaşar,
//! commit orada olur (200 bekleyen belge ya da 2 sn). Arama `spawn_blocking` üzerinde çalışır (bkz. `komutlar::mesaj_ara`).
//!
//! Folding: "Işık", "ışık" and "isik" must all find each other, so both the indexed text and the query go through the same
//! analyzer "tr": SimpleTokenizer → lowercase → Turkish letter folding → ASCII folding.
//! Katlama: "Işık", "ışık" ve "isik" birbirini bulmalı; bu yüzden hem dizine giren metin hem sorgu aynı "tr" çözümleyicisinden
//! geçer: SimpleTokenizer → küçük harf → Türkçe harf katlama → ASCII katlama.

use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        mpsc::{self, RecvTimeoutError},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};

use matrix_sdk::{
    room::MessagesOptions,
    ruma::{
        events::{room::message::OriginalSyncRoomMessageEvent, room::redaction::OriginalSyncRoomRedactionEvent},
        serde::Raw,
        UserId,
    },
    Client, Room,
};
use serde::{Deserialize, Serialize};
use serde_json::Value as Json;
use tantivy::{
    collector::TopDocs,
    directory::MmapDirectory,
    query::{BooleanQuery, Occur, Query, RegexQuery, TermQuery},
    schema::{Field, IndexRecordOption, Schema, TextFieldIndexing, TextOptions, STORED, STRING, FAST, INDEXED},
    tokenizer::{AsciiFoldingFilter, LowerCaser, RemoveLongFilter, SimpleTokenizer, TextAnalyzer, Token, TokenFilter, TokenStream, Tokenizer},
    DocAddress, Index, IndexReader, IndexWriter, Order, ReloadPolicy, TantivyDocument, Term,
};
#[allow(unused_imports)]
use tantivy::schema::{Document, Value};
use tokio::task::JoinHandle;
use tracing::{info, warn};

use crate::{
    hata::{Hata, Sonuc},
    matrix::oturum::DIZIN_KLASORU,
    tipler::{MesajAramaSonucu, MesajParcasi},
};

/// Writer heap: the minimum tantivy accepts (15 MB), ONE indexing thread. The phone has little RAM.
/// Yazıcı belleği: tantivy'nin kabul ettiği en az (15 MB), TEK dizinleme iş parçacığı. Telefonda bellek az.
const YAZICI_BELLEK: usize = 15_000_000;
/// Commit when this many operations are pending or this long has passed since the first pending one.
/// Bu kadar işlem bekleyince ya da ilk bekleyenden bu kadar süre geçince commit et.
const COMMIT_ADEDI: usize = 200;
const COMMIT_SURESI: Duration = Duration::from_secs(2);
/// Backfill stops a room after this many events (a cap for now, so a huge room cannot fill the phone). Tune later / make a setting.
/// Doldurma bir odada bu kadar olaydan sonra durur (şimdilik üst sınır; dev oda telefonu doldurmasın). Sonra ayarlanır / ayar olur.
const ODA_BASINA_SINIR: u32 = 20_000;
const SAYFA_BOYU: u32 = 100;
const SAYFA_ARASI: Duration = Duration::from_millis(300);
/// Backfill waits this long after start so it never competes with the first sync and the UI.
/// Doldurma açılıştan sonra bu kadar bekler; ilk eşitleme ve arayüzle yarışmasın.
const DOLDURMA_GECIKMESI: Duration = Duration::from_secs(10);
const ILERLEME_DOSYASI: &str = "ilerleme.json";
const ANALIZCI_ADI: &str = "tr";

// ---------------------------------------------------------------------------------------------------------------------
// Turkish folding analyzer · Türkçe katlamalı çözümleyici
// ---------------------------------------------------------------------------------------------------------------------

/// Token filter: Turkish letters → plain Latin (ı→i, ş→s, ğ→g, ü→u, ö→o, ç→c, â→a, î→i, û→u) and drops the combining dot
/// that lowercasing "İ" leaves behind ("i̇"). Runs after `LowerCaser`; `AsciiFoldingFilter` then handles the rest (é, ß...).
/// Token süzgeci: Türkçe harfler → düz Latin ve "İ" küçültülünce kalan birleştirici noktayı ("i̇") atar. `LowerCaser`dan sonra
/// çalışır; geri kalanı (é, ß...) `AsciiFoldingFilter` halleder.
#[derive(Clone)]
struct TrKatla;

#[derive(Clone)]
struct TrKatlaSarmal<T> {
    tokenizer: T,
}

struct TrKatlaAkis<S> {
    tail: S,
}

impl TokenFilter for TrKatla {
    type Tokenizer<T: Tokenizer> = TrKatlaSarmal<T>;
    fn transform<T: Tokenizer>(self, tokenizer: T) -> Self::Tokenizer<T> {
        TrKatlaSarmal { tokenizer }
    }
}

impl<T: Tokenizer> Tokenizer for TrKatlaSarmal<T> {
    type TokenStream<'a> = TrKatlaAkis<T::TokenStream<'a>>;
    fn token_stream<'a>(&'a mut self, text: &'a str) -> Self::TokenStream<'a> {
        TrKatlaAkis { tail: self.tokenizer.token_stream(text) }
    }
}

fn harf_katla(c: char) -> Option<char> {
    Some(match c {
        'ı' | 'İ' | 'î' | 'Î' => 'i',
        'ş' | 'Ş' => 's',
        'ğ' | 'Ğ' => 'g',
        'ü' | 'Ü' | 'û' | 'Û' => 'u',
        'ö' | 'Ö' => 'o',
        'ç' | 'Ç' => 'c',
        'â' | 'Â' => 'a',
        _ => return None,
    })
}

impl<S: TokenStream> TokenStream for TrKatlaAkis<S> {
    fn advance(&mut self) -> bool {
        if !self.tail.advance() {
            return false;
        }
        let t = &mut self.tail.token_mut().text;
        if !t.is_ascii() {
            let katli: String = t.chars().filter(|&c| c != '\u{307}').map(|c| harf_katla(c).unwrap_or(c)).collect();
            *t = katli;
        }
        true
    }
    fn token(&self) -> &Token {
        self.tail.token()
    }
    fn token_mut(&mut self) -> &mut Token {
        self.tail.token_mut()
    }
}

fn cozumleyici() -> TextAnalyzer {
    TextAnalyzer::builder(SimpleTokenizer::default())
        // Very long "words" (URLs, base64) only bloat the term dictionary. · Çok uzun "sözcükler" (URL, base64) terim sözlüğünü şişirir.
        .filter(RemoveLongFilter::limit(64))
        .filter(LowerCaser)
        .filter(TrKatla)
        .filter(AsciiFoldingFilter)
        .build()
}

/// (folded token, start byte, end byte) of every token; offsets point into the ORIGINAL text (filters do not move them).
/// Her tokenin (katlanmış metin, başlangıç bayt, bitiş bayt) değeri; konumlar ORİJİNAL metni gösterir (süzgeçler kaydırmaz).
fn belirtecler(c: &mut TextAnalyzer, metin: &str) -> Vec<(String, usize, usize)> {
    let mut akis = c.token_stream(metin);
    let mut v = Vec::new();
    while akis.advance() {
        let t = akis.token();
        v.push((t.text.clone(), t.offset_from, t.offset_to));
    }
    v
}

// ---------------------------------------------------------------------------------------------------------------------
// Schema and index · Şema ve dizin
// ---------------------------------------------------------------------------------------------------------------------

#[derive(Clone, Copy)]
struct Alanlar {
    olay_id: Field,
    oda_id: Field,
    gonderen: Field,
    gonderen_ad: Field,
    zaman: Field,
    govde: Field,
}

fn sema_kur() -> Schema {
    let mut s = Schema::builder();
    s.add_text_field("olay_id", STRING | STORED);
    s.add_text_field("oda_id", STRING | STORED);
    s.add_text_field("gonderen", STORED);
    s.add_text_field("gonderen_ad", STORED);
    s.add_i64_field("zaman", INDEXED | STORED | FAST);
    // Only document ids are indexed (no positions): we never run phrase queries, and the index stays smaller.
    // Yalnızca belge kimlikleri dizinlenir (konum yok): ifade sorgusu yapmıyoruz, dizin küçük kalır.
    s.add_text_field(
        "govde",
        TextOptions::default()
            .set_indexing_options(TextFieldIndexing::default().set_tokenizer(ANALIZCI_ADI).set_index_option(IndexRecordOption::Basic))
            .set_stored(),
    );
    s.build()
}

fn alanlari_al(index: &Index) -> Option<Alanlar> {
    let s = index.schema();
    Some(Alanlar {
        olay_id: s.get_field("olay_id").ok()?,
        oda_id: s.get_field("oda_id").ok()?,
        gonderen: s.get_field("gonderen").ok()?,
        gonderen_ad: s.get_field("gonderen_ad").ok()?,
        zaman: s.get_field("zaman").ok()?,
        govde: s.get_field("govde").ok()?,
    })
}

fn dep<E: std::fmt::Display>(e: E) -> Hata {
    Hata::Depolama(format!("arama dizini: {e}"))
}

/// Opens the index, creating it if needed. A broken or old-schema index is wiped and rebuilt (it is only a cache of the
/// message history, which the backfill refills).
/// Dizini açar, gerekirse oluşturur. Bozuk ya da eski şemalı dizin silinip yeniden kurulur (zaten mesaj geçmişinin önbelleği;
/// doldurma yeniden dolduracaktır).
fn dizini_ac(yol: &Path) -> Sonuc<(Index, Alanlar)> {
    std::fs::create_dir_all(yol)?;
    let dene = || -> tantivy::Result<Index> {
        let index = Index::open_or_create(MmapDirectory::open(yol)?, sema_kur())?;
        index.tokenizers().register(ANALIZCI_ADI, cozumleyici());
        Ok(index)
    };
    let index = match dene() {
        Ok(i) => i,
        Err(e) => {
            warn!("arama dizini açılamadı, sıfırlanıyor: {e}");
            let _ = std::fs::remove_dir_all(yol);
            std::fs::create_dir_all(yol)?;
            dene().map_err(dep)?
        }
    };
    let alanlar = alanlari_al(&index).ok_or_else(|| dep("şema alanları bulunamadı"))?;
    Ok((index, alanlar))
}

// ---------------------------------------------------------------------------------------------------------------------
// Writer thread · Yazıcı iş parçacığı
// ---------------------------------------------------------------------------------------------------------------------

/// One message as stored in the index. · Dizinde saklanan bir mesaj.
#[derive(Debug, Clone)]
pub struct Belge {
    pub olay_id: String,
    pub oda_id: String,
    pub gonderen: String,
    pub gonderen_ad: Option<String>,
    pub zaman: i64,
    pub govde: String,
}

/// Backfill progress of one room (persisted). `token` = where the next older page starts; `bitti` = nothing older to fetch.
/// Bir odanın doldurma ilerlemesi (diske yazılır). `token` = bir sonraki eski sayfanın başladığı yer; `bitti` = daha eski bir şey yok.
#[derive(Serialize, Deserialize, Clone, Default, Debug)]
struct OdaIlerlemesi {
    token: Option<String>,
    bitti: bool,
    sayi: u32,
}

type IlerlemeHaritasi = HashMap<String, OdaIlerlemesi>;

enum Komut {
    Ekle(Belge),
    /// An edit: replace the body of an already indexed message (ignored when the original is not indexed).
    /// Düzenleme: dizindeki mesajın gövdesini değiştir (orijinal dizinde yoksa yok sayılır).
    Duzenle { olay_id: String, govde: String },
    Sil(String),
    Ilerleme(String, OdaIlerlemesi),
    /// Stop without committing (logout: the directory is about to be deleted). · Commit etmeden dur (çıkış: klasör silinecek).
    Kapat,
}

fn ilerleme_oku(yol: &Path) -> IlerlemeHaritasi {
    std::fs::read(yol.join(ILERLEME_DOSYASI)).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default()
}

fn ilerleme_yaz(yol: &Path, h: &IlerlemeHaritasi) {
    match serde_json::to_vec(h) {
        Ok(b) => {
            if let Err(e) = std::fs::write(yol.join(ILERLEME_DOSYASI), b) {
                warn!("arama ilerlemesi yazılamadı: {e}");
            }
        }
        Err(e) => warn!("arama ilerlemesi serileştirilemedi: {e}"),
    }
}

fn belge_yap(a: &Alanlar, b: &Belge) -> TantivyDocument {
    let mut d = TantivyDocument::default();
    d.add_text(a.olay_id, &b.olay_id);
    d.add_text(a.oda_id, &b.oda_id);
    d.add_text(a.gonderen, &b.gonderen);
    if let Some(ad) = &b.gonderen_ad {
        d.add_text(a.gonderen_ad, ad);
    }
    d.add_i64(a.zaman, b.zaman);
    d.add_text(a.govde, &b.govde);
    d
}

/// Reads a stored document back as a `Belge` (used to apply an edit while keeping time, room and sender).
/// Saklı belgeyi `Belge` olarak geri okur (düzenlemeyi zaman, oda ve gönderen korunarak uygulamak için).
fn belge_oku(a: &Alanlar, d: &TantivyDocument) -> Option<Belge> {
    let metin = |f: Field| d.get_first(f).and_then(|v| v.as_str()).map(str::to_owned);
    Some(Belge {
        olay_id: metin(a.olay_id)?,
        oda_id: metin(a.oda_id)?,
        gonderen: metin(a.gonderen).unwrap_or_default(),
        gonderen_ad: metin(a.gonderen_ad),
        zaman: d.get_first(a.zaman).and_then(|v| v.as_i64())?,
        govde: metin(a.govde).unwrap_or_default(),
    })
}

fn yazici_dongusu(
    mut yazici: IndexWriter,
    okuyucu: IndexReader,
    a: Alanlar,
    yol: PathBuf,
    rx: mpsc::Receiver<Komut>,
    belge_sayisi: Arc<AtomicU64>,
) {
    let mut ilerleme = ilerleme_oku(&yol);
    let mut ilerleme_kirli = false;
    let mut bekleyen = 0usize;
    let mut ilk_bekleyen: Option<Instant> = None;

    // Commit, then make searches see it, update the counter. · Commit et, aramalar görsün, sayacı güncelle.
    let commit = |yazici: &mut IndexWriter, bekleyen: &mut usize, ilk: &mut Option<Instant>| {
        if let Err(e) = yazici.commit() {
            warn!("arama dizini commit hatası: {e}");
        }
        let _ = okuyucu.reload();
        belge_sayisi.store(okuyucu.searcher().num_docs(), Ordering::Relaxed);
        *bekleyen = 0;
        *ilk = None;
    };

    loop {
        match rx.recv_timeout(Duration::from_millis(500)) {
            Ok(Komut::Ekle(b)) => {
                // Delete-then-add makes indexing the same event twice harmless (restart, live + backfill overlap).
                // Sil-sonra-ekle, aynı olayı iki kez dizinlemeyi zararsız yapar (yeniden başlatma, canlı + doldurma çakışması).
                yazici.delete_term(Term::from_field_text(a.olay_id, &b.olay_id));
                if let Err(e) = yazici.add_document(belge_yap(&a, &b)) {
                    warn!("belge eklenemedi: {e}");
                }
                bekleyen += 1;
                ilk_bekleyen.get_or_insert_with(Instant::now);
            }
            Ok(Komut::Duzenle { olay_id, govde }) => {
                // The original may still be uncommitted: commit so the lookup can see it. · Orijinal henüz commit edilmemiş olabilir: arama görsün diye commit et.
                if bekleyen > 0 {
                    commit(&mut yazici, &mut bekleyen, &mut ilk_bekleyen);
                }
                let searcher = okuyucu.searcher();
                let q = TermQuery::new(Term::from_field_text(a.olay_id, &olay_id), IndexRecordOption::Basic);
                let bulunan = searcher.search(&q, &TopDocs::with_limit(1).order_by_score()).ok().and_then(|v| v.into_iter().next());
                if let Some((_, adres)) = bulunan {
                    if let Some(mut eski) = searcher.doc::<TantivyDocument>(adres).ok().and_then(|d| belge_oku(&a, &d)) {
                        eski.govde = govde;
                        yazici.delete_term(Term::from_field_text(a.olay_id, &olay_id));
                        let _ = yazici.add_document(belge_yap(&a, &eski));
                        bekleyen += 1;
                        ilk_bekleyen.get_or_insert_with(Instant::now);
                    }
                }
            }
            Ok(Komut::Sil(id)) => {
                yazici.delete_term(Term::from_field_text(a.olay_id, &id));
                bekleyen += 1;
                ilk_bekleyen.get_or_insert_with(Instant::now);
            }
            Ok(Komut::Ilerleme(oda, k)) => {
                ilerleme.insert(oda, k);
                ilerleme_kirli = true;
            }
            Ok(Komut::Kapat) => return,
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => {
                if bekleyen > 0 {
                    commit(&mut yazici, &mut bekleyen, &mut ilk_bekleyen);
                }
                if ilerleme_kirli {
                    ilerleme_yaz(&yol, &ilerleme);
                }
                return;
            }
        }
        if bekleyen >= COMMIT_ADEDI || ilk_bekleyen.is_some_and(|t| t.elapsed() >= COMMIT_SURESI) {
            commit(&mut yazici, &mut bekleyen, &mut ilk_bekleyen);
        }
        // Progress is written only when nothing is uncommitted: a crash must never leave "page done" without its messages indexed.
        // İlerleme yalnızca commit edilmemiş bir şey yokken yazılır: çökme "sayfa bitti" bilgisini mesajları dizinlenmeden bırakmasın.
        if ilerleme_kirli && bekleyen == 0 {
            ilerleme_yaz(&yol, &ilerleme);
            ilerleme_kirli = false;
        }
    }
}

// ---------------------------------------------------------------------------------------------------------------------
// Public handle · Genel tutamaç
// ---------------------------------------------------------------------------------------------------------------------

pub struct Dizin {
    index: Index,
    okuyucu: IndexReader,
    a: Alanlar,
    gonder: mpsc::Sender<Komut>,
    iplik: Mutex<Option<std::thread::JoinHandle<()>>>,
    belge_sayisi: Arc<AtomicU64>,
    dolduruluyor: Arc<AtomicBool>,
}

impl Dizin {
    pub fn belge_sayisi(&self) -> u64 {
        self.belge_sayisi.load(Ordering::Relaxed)
    }

    pub fn dolduruluyor(&self) -> bool {
        self.dolduruluyor.load(Ordering::Relaxed)
    }

    fn komut(&self, k: Komut) {
        // The writer thread only ends at logout; a failed send then is fine to ignore. · Yazıcı iş parçacığı yalnızca çıkışta biter; o zaman başarısız gönderim yok sayılabilir.
        let _ = self.gonder.send(k);
    }

    /// Logout: stop the writer WITHOUT committing and wait until it released the index files, so the caller can delete the folder.
    /// Çıkış: yazıcıyı commit ETMEDEN durdur ve dizin dosyalarını bırakmasını bekle; çağıran klasörü silebilsin.
    pub async fn durdur(self: Arc<Self>) {
        self.komut(Komut::Kapat);
        let iplik = self.iplik.lock().ok().and_then(|mut i| i.take());
        if let Some(i) = iplik {
            let _ = tokio::task::spawn_blocking(move || i.join()).await;
        }
    }

    /// Search. Every folded token must match; the LAST one is a prefix while the user is still typing (the query does not end
    /// in a space), so results appear as you type. Newest first.
    /// Arama. Her katlanmış token eşleşmeli; kullanıcı hâlâ yazıyorsa (sorgu boşlukla bitmiyorsa) SON token önek sayılır; sonuçlar
    /// yazdıkça gelir. En yeni önce.
    pub fn ara(&self, sorgu: &str, oda_id: Option<&str>, sinir: usize) -> Sonuc<Vec<MesajAramaSonucu>> {
        let mut c = self.index.tokenizers().get(ANALIZCI_ADI).ok_or_else(|| dep("çözümleyici kayıtlı değil"))?;
        let mut kelimeler: Vec<String> = belirtecler(&mut c, sorgu).into_iter().map(|(t, _, _)| t).collect();
        if kelimeler.is_empty() {
            return Ok(Vec::new());
        }
        // Cap the work a pasted paragraph can cause; the newest words are the ones being typed. · Yapıştırılan paragrafın yaratacağı işi sınırla; yazılmakta olan en yeni sözcüklerdir.
        if kelimeler.len() > 8 {
            kelimeler.drain(..kelimeler.len() - 8);
        }
        let onek = sorgu.chars().last().is_some_and(|c| !c.is_whitespace());

        let mut parcalar: Vec<(Occur, Box<dyn Query>)> = Vec::new();
        for (i, k) in kelimeler.iter().enumerate() {
            let son = i + 1 == kelimeler.len();
            let q: Box<dyn Query> = if son && onek {
                Box::new(RegexQuery::from_pattern(&format!("{}.*", regex_kacis(k)), self.a.govde).map_err(dep)?)
            } else {
                Box::new(TermQuery::new(Term::from_field_text(self.a.govde, k), IndexRecordOption::Basic))
            };
            parcalar.push((Occur::Must, q));
        }
        if let Some(oda) = oda_id {
            parcalar.push((Occur::Must, Box::new(TermQuery::new(Term::from_field_text(self.a.oda_id, oda), IndexRecordOption::Basic))));
        }
        let sorgu_nesnesi = BooleanQuery::new(parcalar);

        let searcher = self.okuyucu.searcher();
        let sonuclar: Vec<(Option<i64>, DocAddress)> = searcher
            .search(&sorgu_nesnesi, &TopDocs::with_limit(sinir.clamp(1, 200)).order_by_fast_field::<i64>("zaman", Order::Desc))
            .map_err(dep)?;

        let mut cikti = Vec::with_capacity(sonuclar.len());
        for (_, adres) in sonuclar {
            let Ok(d) = searcher.doc::<TantivyDocument>(adres) else { continue };
            let Some(b) = belge_oku(&self.a, &d) else { continue };
            let parcalar = parcalar_yap(&b.govde, &mut c, &kelimeler, onek);
            cikti.push(MesajAramaSonucu {
                olay_id: b.olay_id,
                oda_id: b.oda_id,
                gonderen: b.gonderen,
                gonderen_ad: b.gonderen_ad,
                zaman: b.zaman,
                parcalar,
            });
        }
        Ok(cikti)
    }
}

/// Escapes regex metacharacters (folded tokens are alphanumeric, so this is only a safety net).
/// Düzenli ifade özel karakterlerini kaçırır (katlanmış tokenlar harf/rakamdır; bu yalnızca güvenlik ağı).
fn regex_kacis(s: &str) -> String {
    let mut o = String::with_capacity(s.len());
    for c in s.chars() {
        if "\\.+*?()|[]{}^$#&-~".contains(c) {
            o.push('\\');
        }
        o.push(c);
    }
    o
}

/// Builds the result snippet: a window of ~200 chars around the first match, split into plain / highlighted pieces.
/// Highlights are computed here (not with tantivy's SnippetGenerator) because it cannot highlight the prefix (regex) term.
/// Sonuç özetini kurar: ilk eşleşmenin çevresinde ~200 karakterlik pencere, düz / vurgulu parçalara bölünmüş.
/// Vurgu burada hesaplanır (tantivy'nin SnippetGenerator'ı ile değil): o, önek (regex) terimini vurgulayamaz.
fn parcalar_yap(govde: &str, c: &mut TextAnalyzer, sorgu: &[String], onek: bool) -> Vec<MesajParcasi> {
    // Same byte length as the original, so token offsets stay valid. · Orijinalle aynı bayt uzunluğu; token konumları geçerli kalır.
    let temiz = govde.replace(['\n', '\r', '\t'], " ");
    let mut araliklar: Vec<(usize, usize)> = Vec::new();
    for (t, bas, son) in belirtecler(c, &temiz) {
        let eslesti = sorgu.iter().enumerate().any(|(i, k)| {
            if onek && i + 1 == sorgu.len() {
                t.starts_with(k.as_str())
            } else {
                t == *k
            }
        });
        if eslesti && temiz.is_char_boundary(bas) && temiz.is_char_boundary(son) {
            araliklar.push((bas, son));
        }
    }

    const ONCE: usize = 40;
    const TOPLAM: usize = 200;
    let ilk = araliklar.first().map(|r| r.0).unwrap_or(0);
    let bas = temiz[..ilk].char_indices().rev().nth(ONCE - 1).map(|(i, _)| i).unwrap_or(0);
    let son = temiz[bas..].char_indices().nth(TOPLAM).map(|(i, _)| bas + i).unwrap_or(temiz.len());

    let mut cikti = Vec::new();
    if bas > 0 {
        cikti.push(MesajParcasi { metin: "…".into(), vurgu: false });
    }
    let mut imlec = bas;
    for (a, b) in araliklar.into_iter().filter(|r| r.0 >= bas && r.1 <= son) {
        if a > imlec {
            cikti.push(MesajParcasi { metin: temiz[imlec..a].to_owned(), vurgu: false });
        }
        cikti.push(MesajParcasi { metin: temiz[a..b].to_owned(), vurgu: true });
        imlec = b;
    }
    if imlec < son {
        cikti.push(MesajParcasi { metin: temiz[imlec..son].to_owned(), vurgu: false });
    }
    if son < temiz.len() {
        cikti.push(MesajParcasi { metin: "…".into(), vurgu: false });
    }
    cikti
}

// ---------------------------------------------------------------------------------------------------------------------
// Turning Matrix events into documents · Matrix olaylarını belgeye çevirme
// ---------------------------------------------------------------------------------------------------------------------

enum Cikarim {
    Ekle(Belge),
    Duzenle { olay_id: String, govde: String },
    Yok,
}

/// Removes the "> quoted line" reply fallback some clients still send, so quoted text does not match as if it was written here.
/// Bazı istemcilerin hâlâ yolladığı "> alıntı satırı" yanıt yedeğini siler; alıntılanan metin burada yazılmış gibi eşleşmesin.
fn alintiyi_at(s: &str) -> &str {
    let mut kalan = s;
    while kalan.starts_with('>') {
        match kalan.split_once('\n') {
            Some((_, geri)) => kalan = geri,
            None => return "",
        }
    }
    kalan.trim_start_matches('\n')
}

/// Searchable text of a message content: body of text-ish kinds, caption / file name of image, video and file messages.
/// Bir mesaj içeriğinin aranabilir metni: metin türlerinde gövde, resim / video / dosyada açıklama ya da dosya adı.
fn govde_al(icerik: &Json, yanit: bool) -> Option<String> {
    let tur = icerik.get("msgtype")?.as_str()?;
    if !matches!(tur, "m.text" | "m.notice" | "m.emote" | "m.image" | "m.video" | "m.file") {
        return None;
    }
    let mut govde = icerik.get("body")?.as_str()?.to_owned();
    if yanit {
        govde = alintiyi_at(&govde).to_owned();
    }
    // New-style media: `body` is the caption and `filename` the real name; index both. · Yeni biçim medya: `body` açıklama, `filename` gerçek ad; ikisi de dizinlenir.
    if let Some(ad) = icerik.get("filename").and_then(|f| f.as_str()) {
        if ad != govde {
            govde = format!("{govde} {ad}");
        }
    }
    let govde = govde.trim().to_owned();
    (!govde.is_empty()).then_some(govde)
}

/// `olay` is the event JSON (`content`, `event_id`, `sender`, `origin_server_ts`, `unsigned`). `duzenleme_izinli` is false while
/// backfilling: there an edit event is skipped, because the ORIGINAL arrives with the latest edit bundled in `unsigned`.
/// `olay` olay JSON'u (`content`, `event_id`, `sender`, `origin_server_ts`, `unsigned`). `duzenleme_izinli` doldurmada false:
/// orada düzenleme olayı atlanır, çünkü ORİJİNAL, son düzenlemesi `unsigned` içinde birleştirilmiş olarak gelir.
fn mesaj_cikar(olay: &Json, oda_id: &str, gonderen_ad: Option<String>, duzenleme_izinli: bool) -> Cikarim {
    let Some(icerik) = olay.get("content") else { return Cikarim::Yok };
    let iliski = icerik.get("m.relates_to");
    if iliski.and_then(|r| r.get("rel_type")).and_then(|r| r.as_str()) == Some("m.replace") {
        if !duzenleme_izinli {
            return Cikarim::Yok;
        }
        let hedef = iliski.and_then(|r| r.get("event_id")).and_then(|e| e.as_str());
        let govde = icerik.get("m.new_content").and_then(|n| govde_al(n, false));
        return match (hedef, govde) {
            (Some(h), Some(g)) => Cikarim::Duzenle { olay_id: h.to_owned(), govde: g },
            _ => Cikarim::Yok,
        };
    }
    let yanit = iliski.and_then(|r| r.get("m.in_reply_to")).is_some();
    let mut govde = govde_al(icerik, yanit);
    // Bundled latest edit (present on events fetched through /messages). · Birleştirilmiş son düzenleme (/messages ile gelen olaylarda bulunur).
    if let Some(yeni) = olay.pointer("/unsigned/m.relations/m.replace/content/m.new_content") {
        if let Some(g) = govde_al(yeni, yanit) {
            govde = Some(g);
        }
    }
    let (Some(govde), Some(olay_id), Some(gonderen), Some(zaman)) = (
        govde,
        olay.get("event_id").and_then(|e| e.as_str()),
        olay.get("sender").and_then(|s| s.as_str()),
        olay.get("origin_server_ts").and_then(|t| t.as_i64()),
    ) else {
        return Cikarim::Yok;
    };
    Cikarim::Ekle(Belge { olay_id: olay_id.to_owned(), oda_id: oda_id.to_owned(), gonderen: gonderen.to_owned(), gonderen_ad, zaman, govde })
}

async fn gorunen_ad(oda: &Room, kullanici: &str) -> Option<String> {
    let id = UserId::parse(kullanici).ok()?;
    let uye = oda.get_member_no_sync(&id).await.ok().flatten()?;
    uye.display_name().map(str::to_owned)
}

// ---------------------------------------------------------------------------------------------------------------------
// Start-up: index, live handlers, backfill · Başlatma: dizin, canlı işleyiciler, doldurma
// ---------------------------------------------------------------------------------------------------------------------

/// Opens the index, starts the writer thread, hooks the live event handlers and starts the backfill.
/// Returns the handle (kept in `AppState`) and the background tasks to abort on logout.
/// Dizini açar, yazıcı iş parçacığını başlatır, canlı olay işleyicilerini bağlar ve doldurmayı başlatır.
/// Tutamacı (`AppState`te saklanır) ve çıkışta durdurulacak arka plan görevlerini döndürür.
pub async fn baslat(client: &Client, veri: &Path) -> Sonuc<(Arc<Dizin>, Vec<JoinHandle<()>>)> {
    let yol = veri.join(DIZIN_KLASORU);
    let yol2 = yol.clone();
    let (index, a) = tokio::task::spawn_blocking(move || dizini_ac(&yol2)).await.map_err(dep)??;
    let yazici: IndexWriter = index.writer_with_num_threads(1, YAZICI_BELLEK).map_err(dep)?;
    // Searches are made visible by an explicit `reload()` after each commit. · Aramalar her commit'ten sonra açık `reload()` ile görünür olur.
    let okuyucu: IndexReader = index.reader_builder().reload_policy(ReloadPolicy::Manual).try_into().map_err(dep)?;
    let belge_sayisi = Arc::new(AtomicU64::new(okuyucu.searcher().num_docs()));
    let (tx, rx) = mpsc::channel();

    let iplik = {
        let (okuyucu, yol, sayac) = (okuyucu.clone(), yol.clone(), belge_sayisi.clone());
        std::thread::Builder::new()
            .name("arama-dizini".into())
            .spawn(move || yazici_dongusu(yazici, okuyucu, a, yol, rx, sayac))
            .map_err(|e| dep(e))?
    };
    let dizin = Arc::new(Dizin {
        index,
        okuyucu,
        a,
        gonder: tx,
        iplik: Mutex::new(Some(iplik)),
        belge_sayisi,
        dolduruluyor: Arc::new(AtomicBool::new(false)),
    });

    // LIVE: new messages (and edits) from sync. The SDK has already decrypted them. · CANLI: eşitlemeden gelen yeni mesajlar (ve düzenlemeler). SDK bunları zaten çözdü.
    let d = dizin.clone();
    // Raw<…>: ruma's event types are not Serialize, and we read the JSON anyway. · Raw<…>: ruma olay türleri Serialize değil; zaten JSON okuyoruz.
    client.add_event_handler(move |ev: Raw<OriginalSyncRoomMessageEvent>, oda: Room| {
        let d = d.clone();
        async move {
            let Ok(json) = serde_json::from_str::<Json>(ev.json().get()) else { return };
            let gonderen = json.get("sender").and_then(|s| s.as_str()).unwrap_or_default().to_owned();
            let ad = gorunen_ad(&oda, &gonderen).await;
            match mesaj_cikar(&json, oda.room_id().as_str(), ad, true) {
                Cikarim::Ekle(b) => d.komut(Komut::Ekle(b)),
                Cikarim::Duzenle { olay_id, govde } => d.komut(Komut::Duzenle { olay_id, govde }),
                Cikarim::Yok => {}
            }
        }
    });
    // Redactions (deleted messages) leave the index. `redacts` is top-level in old room versions and inside `content` in v11+.
    // Silinen mesajlar dizinden çıkar. `redacts` eski oda sürümlerinde üst düzeyde, v11+'da `content` içindedir.
    let d = dizin.clone();
    client.add_event_handler(move |ev: Raw<OriginalSyncRoomRedactionEvent>| {
        let d = d.clone();
        async move {
            let Ok(json) = serde_json::from_str::<Json>(ev.json().get()) else { return };
            let hedef = json.get("redacts").or_else(|| json.pointer("/content/redacts")).and_then(|r| r.as_str());
            if let Some(h) = hedef {
                d.komut(Komut::Sil(h.to_owned()));
            }
        }
    });

    let dolgu = tokio::spawn(dolgu_gorevi(client.clone(), dizin.clone(), yol));
    info!("mesaj arama dizini hazır ({} belge)", dizin.belge_sayisi());
    Ok((dizin, vec![dolgu]))
}

/// Backfill: walks every joined room backwards, newest-active room first, a page at a time, slowly. Resumable.
/// Doldurma: katıldığımız her odayı geriye yürür, en son etkin oda önce, sayfa sayfa, yavaşça. Kaldığı yerden sürer.
async fn dolgu_gorevi(client: Client, dizin: Arc<Dizin>, yol: PathBuf) {
    tokio::time::sleep(DOLDURMA_GECIKMESI).await;
    let mut kayit = ilerleme_oku(&yol);
    let mut odalar = client.joined_rooms();
    odalar.sort_by_key(|o| std::cmp::Reverse(o.latest_event_timestamp().map(|t| u64::from(t.0)).unwrap_or(0)));
    dizin.dolduruluyor.store(true, Ordering::Relaxed);

    for oda in odalar {
        let oda_id = oda.room_id().to_string();
        let mut k = kayit.remove(&oda_id).unwrap_or_default();
        if k.bitti {
            continue;
        }
        let mut adlar: HashMap<String, Option<String>> = HashMap::new();
        let mut ardisik_hata = 0;
        loop {
            if k.sayi >= ODA_BASINA_SINIR {
                k.bitti = true;
                dizin.komut(Komut::Ilerleme(oda_id.clone(), k.clone()));
                break;
            }
            let mut secenek = MessagesOptions::backward();
            secenek.limit = SAYFA_BOYU.into();
            secenek.from = k.token.clone();
            let sayfa = match oda.messages(secenek).await {
                Ok(s) => s,
                Err(e) => {
                    // Offline or rate limited: wait and retry, then give this room up until the next start.
                    // Çevrimdışı ya da hız sınırı: bekle, yeniden dene; sonra bu odayı sonraki açılışa bırak.
                    ardisik_hata += 1;
                    warn!("oda geçmişi alınamadı ({oda_id}): {e}");
                    if ardisik_hata >= 3 {
                        break;
                    }
                    tokio::time::sleep(Duration::from_secs(30)).await;
                    continue;
                }
            };
            ardisik_hata = 0;
            for olay in &sayfa.chunk {
                let Ok(json) = serde_json::from_str::<Json>(olay.raw().json().get()) else { continue };
                if json.get("type").and_then(|t| t.as_str()) != Some("m.room.message") {
                    continue;
                }
                let gonderen = json.get("sender").and_then(|s| s.as_str()).unwrap_or_default().to_owned();
                if !adlar.contains_key(&gonderen) {
                    let ad = gorunen_ad(&oda, &gonderen).await;
                    adlar.insert(gonderen.clone(), ad);
                }
                if let Cikarim::Ekle(b) = mesaj_cikar(&json, &oda_id, adlar.get(&gonderen).cloned().flatten(), false) {
                    dizin.komut(Komut::Ekle(b));
                }
            }
            k.sayi += sayfa.chunk.len() as u32;
            k.token = sayfa.end.clone();
            k.bitti = sayfa.end.is_none() || sayfa.chunk.is_empty();
            dizin.komut(Komut::Ilerleme(oda_id.clone(), k.clone()));
            if k.bitti {
                break;
            }
            tokio::time::sleep(SAYFA_ARASI).await;
        }
    }
    dizin.dolduruluyor.store(false, Ordering::Relaxed);
    info!("mesaj arama dizini dolduruldu");
}
