// Pauses the crystal background effects while the app is hidden (the CSS in styles/kristal.css reacts to html[data-gizli]).
// A looping animation behind a hidden window only burns battery, so we stop it; it resumes by itself when the app is shown again.
// Uygulama gizliyken kristal arka plan efektlerini durdurur (styles/kristal.css, html[data-gizli]'ye tepki verir). Gizli pencerenin
// arkasında dönen animasyon yalnızca pil yer; durdururuz, uygulama yeniden görününce kendiliğinden devam eder.
export function gorunurlukIzle(): () => void {
  const kok = document.documentElement;
  const guncelle = () => {
    if (document.hidden) kok.setAttribute("data-gizli", "");
    else kok.removeAttribute("data-gizli");
  };
  guncelle();
  document.addEventListener("visibilitychange", guncelle);
  return () => document.removeEventListener("visibilitychange", guncelle);
}
