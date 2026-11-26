// Measures the total height of fixed bottom bars ([data-alt-cubuk]) and writes it to --alt-yer,
// so toasts sit above them and nothing overlaps. Same idea as rubyyard.
// Ekranın altına sabitlenen çubukların ([data-alt-cubuk]) toplam yüksekliğini ölçüp --alt-yer'e yazar;
// böylece bildirimler onların üstünde durur ve hiçbir şey üst üste binmez. rubyyard'daki fikrin aynısı.
export function altYeriOlc(): () => void {
  const kok = document.documentElement;
  const gozlemci = new ResizeObserver(guncelle);
  const izlenen = new Set<Element>();

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
    kok.style.setProperty("--alt-yer", `${Math.max(0, Math.round(window.innerHeight - ust))}px`);
  }

  function tara() {
    const simdiki = new Set(document.querySelectorAll("[data-alt-cubuk]"));
    for (const e of izlenen) if (!simdiki.has(e)) { gozlemci.unobserve(e); izlenen.delete(e); }
    for (const e of simdiki) if (!izlenen.has(e)) { gozlemci.observe(e); izlenen.add(e); }
    guncelle();
  }

  const degisim = new MutationObserver(tara);
  degisim.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-alt-cubuk", "inert"] });
  window.addEventListener("resize", guncelle);
  tara();
  return () => {
    gozlemci.disconnect();
    degisim.disconnect();
    window.removeEventListener("resize", guncelle);
  };
}
