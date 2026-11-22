// Measures the total height of fixed bottom bars ([data-alt-cubuk]) and writes it to --alt-yer,
// so toasts sit above them and nothing overlaps. Same idea as rubyyard.
// Ekranın altına sabitlenen çubukların ([data-alt-cubuk]) toplam yüksekliğini ölçüp --alt-yer'e yazar;
// böylece bildirimler onların üstünde durur ve hiçbir şey üst üste binmez. rubyyard'daki fikrin aynısı.
export function altYeriOlc(): () => void {
  const kok = document.documentElement;
  const gozlemci = new ResizeObserver(guncelle);
  const izlenen = new Set<Element>();

  function guncelle() {
    let toplam = 0;
    document.querySelectorAll("[data-alt-cubuk]").forEach((e) => (toplam += e.getBoundingClientRect().height));
    kok.style.setProperty("--alt-yer", `${Math.round(toplam)}px`);
  }

  function tara() {
    const simdiki = new Set(document.querySelectorAll("[data-alt-cubuk]"));
    for (const e of izlenen) if (!simdiki.has(e)) { gozlemci.unobserve(e); izlenen.delete(e); }
    for (const e of simdiki) if (!izlenen.has(e)) { gozlemci.observe(e); izlenen.add(e); }
    guncelle();
  }

  const degisim = new MutationObserver(tara);
  degisim.observe(document.body, { childList: true, subtree: true });
  tara();
  return () => {
    gozlemci.disconnect();
    degisim.disconnect();
  };
}
