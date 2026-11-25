// A tiny Markdown → Matrix HTML converter for the composer. Neither matrix-sdk nor ruma has the `markdown` feature switched on here
// (it would pull in a new crate), so the conversion lives in the UI: the message `body` stays the text the user typed (plain fallback,
// exactly what Element does) and `formatted_body` carries the HTML (`org.matrix.custom.html`).
// Supported: **bold**, *italic* / _italic_, ~~strike~~, `code`, ```code block```, [text](https://link), ||spoiler||, "> quote" lines,
// and custom emoji `:shortcode:` that the user picked from a pack. Everything the user typed is HTML-escaped FIRST, so the output
// can only contain the tags generated here; receivers still sanitize (see temizle.ts).
// Yazma alanı için küçük bir Markdown → Matrix HTML çevirici. Burada ne matrix-sdk'da ne ruma'da `markdown` özelliği açık (yeni bir
// crate getirir); bu yüzden çeviri arayüzde yapılır: mesajın `body`si kullanıcının yazdığı metin kalır (düz yedek, Element'in yaptığı
// gibi), `formatted_body` HTML'i (`org.matrix.custom.html`) taşır.
// Desteklenen: **kalın**, *italik* / _italik_, ~~üstü çizili~~, `kod`, ```kod bloğu```, [metin](https://bağlantı), ||spoiler||,
// "> alıntı" satırları ve kullanıcının paketten seçtiği `:kisakod:` özel emojileri. Kullanıcının yazdığı her şey ÖNCE HTML'e
// kaçırılır; çıktı yalnızca burada üretilen etiketleri içerebilir. Alıcılar yine de temizler (bkz. temizle.ts).

export interface BicimSonucu {
  /** The text as typed (plain fallback) · Yazıldığı gibi metin (düz yedek) */
  metin: string;
  /** HTML body, or null when nothing in the text needs formatting (then a plain message is sent) · HTML gövde; metinde biçimlenecek bir şey yoksa null (o zaman düz mesaj gider) */
  html: string | null;
}

const kacir = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** Only these schemes become links; anything else (javascript:, data:) stays plain text · Yalnızca bu şemalar bağlantı olur; gerisi (javascript:, data:) düz metin kalır */
const GUVENLI_BAGLANTI = /^(https?:\/\/|mailto:)[^\s<>"]+$/i;

/** `ozelEmoji`: shortcode (without colons) → mxc:// URI of the emoji the user inserted from a pack · `ozelEmoji`: kısa kod (iki noktasız) → kullanıcının paketten eklediği emojinin mxc:// adresi */
function satirIci(kaynak: string, ozelEmoji: Record<string, string>): string {
  // 1) Inline code first, so nothing inside it is touched. · Önce satır içi kod; içindekine dokunulmaz.
  const kodlar: string[] = [];
  let s = kaynak.replace(/`([^`\n]+)`/g, (_, k: string) => {
    kodlar.push(`<code>${kacir(k)}</code>`);
    return `\u0000${kodlar.length - 1}\u0000`;
  });
  s = kacir(s);
  // 2) Links. The URL is already escaped (&amp;), which is right inside an attribute. · Bağlantılar. Adres zaten kaçırıldı (&amp;), öznitelik içinde doğrusu bu.
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (tam, metin: string, url: string) => {
    const gercek = url.replaceAll("&amp;", "&");
    return GUVENLI_BAGLANTI.test(gercek) ? `<a href="${url}">${metin}</a>` : tam;
  });
  // 3) Spoiler, bold, strike, italic. · Spoiler, kalın, üstü çizili, italik.
  s = s.replace(/\|\|([^|\n]+)\|\|/g, '<span data-mx-spoiler>$1</span>');
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
  s = s.replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?!\*)/g, "$1<em>$2</em>");
  // `_italic_` only at word edges, so snake_case_names are left alone. · `_italik_` yalnızca sözcük kenarında; snake_case_adlara dokunulmaz.
  s = s.replace(/(^|[^\w])_([^_\s][^_\n]*?)_(?![\w])/g, "$1<em>$2</em>");
  // 4) Custom emoji from packs (inline image, 32px high, as Element sends them). · Paketlerden özel emojiler (satır içi resim, 32px yüksek; Element'in yolladığı gibi).
  s = s.replace(/:([A-Za-z0-9_+-]{1,64}):/g, (tam, kod: string) => {
    const mxc = ozelEmoji[kod];
    return mxc && mxc.startsWith("mxc://") ? `<img data-mx-emoticon src="${kacir(mxc)}" alt=":${kod}:" title=":${kod}:" height="32" />` : tam;
  });
  // 5) Put the code back. · Kodu geri koy.
  return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => kodlar[Number(i)] ?? "");
}

/** Blocks: ``` fences, "> " quote runs and normal lines (joined with <br>). `korunan` = mention spans kept verbatim outside code blocks. · Bloklar: ``` çitleri, "> " alıntı dizileri ve normal satırlar (<br> ile birleştirilir). `korunan` = kod bloğu dışında aynen korunan bahsetme aralıkları. */
export function markdownCevir(
  metin: string,
  ozelEmoji: Record<string, string> = {},
  korunan: { bas: number; son: number }[] = [],
): BicimSonucu {
  const korunanHtml: string[] = [];
  let kaynak = metin;
  if (korunan.length > 0) {
    // Protect mention display names outside code fences so characters like `*` or `_` in a name are not formatted as Markdown.
    // Kod çitleri dışındaki bahsetme adlarını koru ki addaki `*` veya `_` gibi karakterler Markdown olarak biçimlenmesin.
    const sirali = [...korunan].filter((a) => a.bas >= 0 && a.son > a.bas && a.son <= metin.length).sort((a, b) => a.bas - b.bas);
    const citler: [number, number][] = [];
    let citPos = 0;
    while (true) {
      const ac = metin.indexOf("```", citPos);
      if (ac < 0) break;
      const kapa = metin.indexOf("```", ac + 3);
      if (kapa < 0) break;
      citler.push([ac, kapa + 3]);
      citPos = kapa + 3;
    }
    const citIcinde = (bas: number, son: number) => citler.some(([a, b]) => bas < b && son > a);
    let parca = "";
    let son = 0;
    for (const a of sirali) {
      if (a.bas < son || citIcinde(a.bas, a.son)) continue;
      parca += metin.slice(son, a.bas);
      const id = korunanHtml.length;
      korunanHtml.push(kacir(metin.slice(a.bas, a.son)));
      parca += `\u0001${id}\u0001`;
      son = a.son;
    }
    parca += metin.slice(son);
    kaynak = parca;
  }

  const parcalar: string[] = [];
  // Split on fences; odd segments are code blocks. An unclosed fence is plain text. · Çitlere göre böl; tek sıradakiler kod bloğu. Kapanmamış çit düz metindir.
  const bolumler = kaynak.split("```");
  // An unclosed fence is plain text: glue the last two parts back together. · Kapanmamış çit düz metindir: son iki parçayı geri birleştir.
  if (bolumler.length % 2 === 0) {
    const son = bolumler.pop() ?? "";
    bolumler[bolumler.length - 1] += "```" + son;
  }
  bolumler.forEach((b, i) => {
    if (i % 2 === 1) {
      // The first line may be a language name ("js"): dropped, like Element. · İlk satır dil adı olabilir ("js"): Element gibi atılır.
      const ic = b.replace(/^[A-Za-z0-9+#-]*\n/, "").replace(/\n$/, "");
      parcalar.push(`<pre><code>${kacir(ic)}</code></pre>`);
      return;
    }
    const satirlar = b.split("\n");
    let alinti: string[] = [];
    const bosalt = (): string => {
      if (!alinti.length) return "";
      const h = `<blockquote>${alinti.map((l) => satirIci(l, ozelEmoji)).join("<br>")}</blockquote>`;
      alinti = [];
      return h;
    };
    let cikti = "";
    satirlar.forEach((satir, n) => {
      const q = satir.match(/^>\s?(.*)$/);
      if (q) {
        alinti.push(q[1]);
        return;
      }
      cikti += bosalt();
      // The newline that ended a quote is not repeated as <br>. · Alıntıyı bitiren satır sonu <br> olarak tekrarlanmaz.
      const oncekiAlintiydi = n > 0 && /^>/.test(satirlar[n - 1]);
      if (n > 0 && !oncekiAlintiydi) cikti += "<br>";
      cikti += satirIci(satir, ozelEmoji);
    });
    cikti += bosalt();
    // A block next to a code fence: trim the <br> that only separated them. · Kod çitinin yanındaki blok: yalnızca onları ayıran <br>'ı kırp.
    parcalar.push(cikti.replace(/^(<br>)+|(<br>)+$/g, ""));
  });
  let html = parcalar.filter((p) => p !== "").join("");
  if (korunanHtml.length > 0) {
    html = html.replace(/\u0001(\d+)\u0001/g, (tam, i: string) => korunanHtml[Number(i)] ?? tam);
  }
  // Nothing but escaped text and <br> = plain message. · Kaçırılmış metin ve <br>'dan başka bir şey yoksa = düz mesaj.
  const bicimli = /<(?!br>)/.test(html);
  return { metin, html: bicimli ? html : null };
}
