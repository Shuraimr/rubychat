// Measures the total height of fixed bottom bars ([data-alt-cubuk]) and writes it to --alt-yer,
// so toasts sit above them and nothing overlaps. Same idea as rubyyard.
// Ekranın altına sabitlenen çubukların ([data-alt-cubuk]) toplam yüksekliğini ölçüp --alt-yer'e yazar;
// böylece bildirimler onların üstünde durur ve hiçbir şey üst üste binmez. rubyyard'daki fikrin aynısı.
export function altYeriOlc(): () => void {
  const kok = document.documentElement;
  const gozlemci = new ResizeObserver(guncelle);
  const izlenen = new Set<Element>();
  let son = "";

  // The space is measured up to the highest VISIBLE bar's top, not as a sum: a sheet that opens over the dock covers it, and
  // summing both pushed toasts off the top of the screen. Hidden bars (a minimised call, a layer under `inert`) do not count.
  // Yer, toplam olarak değil GÖRÜNEN en yüksek çubuğun üstüne kadar ölçülür: dock'un üstüne açılan sayfa onu örter, ikisini
  // toplamak bildirimleri ekranın üstünden dışarı itiyordu. Gizli çubuklar (küçültülmüş arama, `inert` altındaki katman) sayılmaz.
  function guncelle() {
    let ust = window.innerHeight;
    document.querySelectorAll("[data-alt-cubuk]").forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.height <= 0 || e.closest("[inert]") || getComputedStyle(e).visibility === "hidden") return;
      ust = Math.min(ust, r.top);
    });
    const deger = `${Math.max(0, Math.round(window.innerHeight - ust))}px`;
    if (deger !== son) kok.style.setProperty("--alt-yer", (son = deger));
  }

  function tara() {
    const simdiki = new Set(document.querySelectorAll("[data-alt-cubuk]"));
    for (const e of izlenen) if (!simdiki.has(e)) { gozlemci.unobserve(e); izlenen.delete(e); }
    for (const e of simdiki) if (!izlenen.has(e)) { gozlemci.observe(e); izlenen.add(e); }
    guncelle();
  }

  // Only mutations that can add, remove or hide a bar matter; everything else (every message, every ripple span) used to run two
  // document-wide queries plus a forced layout. The work that remains is batched into one animation frame.
  // Yalnızca çubuk ekleyebilen, kaldırabilen ya da gizleyebilen değişiklikler önemli; geri kalanı (her mesaj, her dalga span'i)
  // eskiden iki belge çapında sorgu ve zorunlu yerleşim çalıştırıyordu. Kalan iş tek bir animasyon karesinde toplanır.
  let kare = 0;
  const planla = () => {
    if (!kare) kare = requestAnimationFrame(() => ((kare = 0), tara()));
  };
  const ilgili = (d: Node) => d instanceof Element && (d.hasAttribute("data-alt-cubuk") || d.querySelector("[data-alt-cubuk]") !== null);
  const degisim = new MutationObserver((kayitlar) => {
    for (const k of kayitlar) {
      if (k.type === "attributes" || [...k.addedNodes].some(ilgili) || [...k.removedNodes].some(ilgili)) return planla();
    }
  });
  degisim.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-alt-cubuk", "inert"] });
  window.addEventListener("resize", guncelle);
  tara();
  return () => {
    cancelAnimationFrame(kare);
    gozlemci.disconnect();
    degisim.disconnect();
    window.removeEventListener("resize", guncelle);
  };
}
