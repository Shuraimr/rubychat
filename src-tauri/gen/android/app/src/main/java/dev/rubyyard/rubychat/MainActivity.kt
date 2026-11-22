package dev.rubyyard.rubychat

import android.Manifest
import android.content.Context
import android.content.Intent
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import org.json.JSONObject

/**
 * Tiny bridge so the web UI can pick speaker / earpiece during a call (WebRTC audio itself runs in the webview).
 * Web arayüzü arama sırasında hoparlör / kulaklık seçebilsin diye küçük köprü (WebRTC sesi webview'de çalışır).
 */
class SesKoprusu(private val ctx: Context) {
  private val am get() = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager

  /** true at call start (communication mode: echo cancel + earpiece routing), false at the end. */
  @JavascriptInterface
  fun aramaBasladi(basladi: Boolean) {
    am.mode = if (basladi) AudioManager.MODE_IN_COMMUNICATION else AudioManager.MODE_NORMAL
    if (!basladi) hoparlor(false)
  }

  @JavascriptInterface
  fun hoparlor(ac: Boolean) {
    if (Build.VERSION.SDK_INT >= 31) {
      if (ac) {
        val cihaz = am.availableCommunicationDevices.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
        if (cihaz != null) am.setCommunicationDevice(cihaz)
      } else {
        am.clearCommunicationDevice()
      }
    } else {
      @Suppress("DEPRECATION")
      am.isSpeakerphoneOn = ac
    }
  }
}

class MainActivity : TauriActivity() {
  private var web: WebView? = null

  // Notification permission dialog (Android 13+). Registered here, at construction, because it must exist before STARTED.
  // Bildirim izni penceresi (Android 13+). Burada, kurulurken kaydedilir; STARTED olmadan önce var olmalı.
  private val bildirimIzni = registerForActivityResult(ActivityResultContracts.RequestPermission()) { verildi ->
    Bildirimci.izinSonucuYaz(verildi)
  }

  fun bildirimIzniIste() {
    if (Build.VERSION.SDK_INT >= 33) bildirimIzni.launch(Manifest.permission.POST_NOTIFICATIONS) else Bildirimci.izinSonucuYaz(true)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    aktif = this
    Bildirimci.sayfaSifirla()
    niyetIsle(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    niyetIsle(intent)
  }

  // "Started" = visible to the user: the Rust side shows system notifications only when this is false.
  // "Başladı" = kullanıcıya görünür: Rust tarafı sistem bildirimini yalnızca bu false iken gösterir.
  override fun onStart() {
    super.onStart()
    Bildirimci.onPlandaYap(true)
  }

  override fun onStop() {
    super.onStop()
    Bildirimci.onPlandaYap(false)
  }

  override fun onDestroy() {
    super.onDestroy()
    if (aktif === this) aktif = null
  }

  /**
   * Back on the root screen (the web page has no history left): send the app to the background like other chat apps instead of
   * finishing the activity. Finishing made Tauri exit the process while Rust threads still ran ("destroyed mutex" crash), and the
   * sync + notifications died with it.
   * Kök ekranda geri (sayfada geçmiş kalmadı): etkinliği bitirmek yerine uygulamayı diğer sohbet uygulamaları gibi arka plana al.
   * Bitirmek, Rust iş parçacıkları hâlâ çalışırken Tauri'nin süreci kapatmasına yol açıyordu ("destroyed mutex" çökmesi) ve
   * eşitleme + bildirimler de onunla ölüyordu.
   */
  @Deprecated("Called by Tauri's back callback when the WebView cannot go back")
  override fun onBackPressed() {
    moveTaskToBack(true)
  }

  override fun onWebViewCreate(webView: WebView) {
    web = webView
    webView.addJavascriptInterface(SesKoprusu(this), "RubySes")
  }

  /**
   * A tapped notification carries the room id. If the page is already running we tell it with a window event
   * (`rubychat-oda-ac`, detail = room id); on a cold start the id waits until the UI asks for it (Rust `bildirim_bekleyen_oda`).
   * Dokunulan bildirim oda kimliğini taşır. Sayfa zaten çalışıyorsa pencere olayıyla (`rubychat-oda-ac`, detail = oda kimliği)
   * haber veririz; soğuk açılışta kimlik, arayüz isteyene (Rust `bildirim_bekleyen_oda`) kadar bekler.
   */
  private fun niyetIsle(niyet: Intent?) {
    val oda = niyet?.getStringExtra(Bildirimci.EK_ODA) ?: return
    niyet?.removeExtra(Bildirimci.EK_ODA)
    Bildirimci.odaIstendi(oda) { id ->
      web?.post {
        web?.evaluateJavascript("window.dispatchEvent(new CustomEvent('rubychat-oda-ac',{detail:" + JSONObject.quote(id) + "}))", null)
      }
    }
  }

  companion object {
    @Volatile var aktif: MainActivity? = null
  }
}
