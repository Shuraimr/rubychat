// Bridge that lives INSIDE the bundled Element Call page (injected by src-tauri/src/matrix/ec.rs). The app shell sits in a different origin
// (iframe), so it cannot touch `window.controls`; instead it posts small messages and this script applies them.
// Paketlenmiş Element Call sayfasının İÇİNDE yaşayan köprü (src-tauri/src/matrix/ec.rs enjekte eder). Uygulama kabuğu başka bir kaynakta
// (iframe) olduğundan `window.controls`a dokunamaz; küçük mesajlar yollar, bu betik uygular.
//   parent → EC : { rubychatKopru: "ses-listesi", cihazlar: [...] } | { rubychatKopru: "ses-sec", id } | { rubychatKopru: "ses-ac", acik }
//   EC → parent : { rubychatKopru: "ses-secildi", id } | { rubychatKopru: "ses-basladi", id } | { rubychatKopru: "geri" }
(function () {
  "use strict";
  var ust = window.parent;
  if (!ust || ust === window) return;
  // EC creates `window.controls` itself; wait for it, then hook the callbacks (cheap poll, stops once found).
  // EC `window.controls`u kendisi kurar; bekle, sonra geri çağrıları bağla (ucuz yoklama, bulununca durur).
  var deneme = 0;
  var zamanlayici = setInterval(function () {
    var c = window.controls;
    if (!c && ++deneme < 200) return;
    clearInterval(zamanlayici);
    if (!c) return;
    c.onAudioDeviceSelect = function (id) { ust.postMessage({ rubychatKopru: "ses-secildi", id: id }, "*"); };
    c.onAudioPlaybackStarted = function (id) { ust.postMessage({ rubychatKopru: "ses-basladi", id: id }, "*"); };
    c.onBackButtonPressed = function () { ust.postMessage({ rubychatKopru: "geri" }, "*"); };
  }, 100);

  window.addEventListener("message", function (e) {
    if (e.source !== ust || !e.data || !e.data.rubychatKopru) return;
    var c = window.controls;
    if (!c) return;
    try {
      if (e.data.rubychatKopru === "ses-listesi") c.setAvailableAudioDevices(e.data.cihazlar);
      else if (e.data.rubychatKopru === "ses-sec") c.setAudioDevice(e.data.id);
      else if (e.data.rubychatKopru === "ses-ac") c.setAudioEnabled(!!e.data.acik);
    } catch (err) { console.warn("kopru", err); }
  });
})();
