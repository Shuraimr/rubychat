package dev.rubyyard.rubychat

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioFocusRequest
import android.media.AudioManager
import androidx.core.content.ContextCompat
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.view.HapticFeedbackConstants
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import org.json.JSONArray
import org.json.JSONObject

/**
 * Bridge between the web UI and Android audio for calls (the WebRTC audio itself runs in the webview). Used by Element Call
 * (src/lib/arama-ec/ses.ts) and by the old 1:1 call (src/lib/arama/ses-yolu.ts).
 * Web arayüzü ile Android sesi arasındaki köprü (WebRTC sesi webview'de çalışır). Element Call (src/lib/arama-ec/ses.ts) ve
 * eski 1:1 arama (src/lib/arama/ses-yolu.ts) kullanır.
 */
class SesKoprusu(private val ctx: Context, private val cihazlarDegisti: () -> Unit) {
  private val am get() = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private var odak: AudioFocusRequest? = null
  private var izleniyor = false

  // Headset plugged / Bluetooth connected during a call: tell the UI so Element Call's output list stays current.
  // Arama sırasında kulaklık takıldı / Bluetooth bağlandı: Element Call'un çıkış listesi güncel kalsın diye arayüze haber ver.
  private val cihazIzleyici = object : AudioDeviceCallback() {
    override fun onAudioDevicesAdded(added: Array<out AudioDeviceInfo>?) = cihazlarDegisti()
    override fun onAudioDevicesRemoved(removed: Array<out AudioDeviceInfo>?) = cihazlarDegisti()
  }

  /**
   * true at call start, false at the end. Start = communication mode (echo cancellation + call routing) AND audio focus, so music pauses and
   * other apps do not steal the output. The mode must be set before the webview opens the microphone.
   * Arama başında true, sonunda false. Başlangıç = iletişim modu (yankı engelleme + arama yönlendirmesi) VE ses odağı; müzik duraklar,
   * başka uygulamalar çıkışı çalamaz. Mod, webview mikrofonu açmadan önce ayarlanmalıdır.
   */
  @JavascriptInterface
  fun aramaBasladi(basladi: Boolean) {
    if (basladi) {
      am.mode = AudioManager.MODE_IN_COMMUNICATION
      if (Build.VERSION.SDK_INT >= 26 && odak == null) {
        val istek = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
          .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
          .build()
        am.requestAudioFocus(istek)
        odak = istek
      }
      if (!izleniyor && Build.VERSION.SDK_INT >= 23) {
        am.registerAudioDeviceCallback(cihazIzleyici, Handler(Looper.getMainLooper()))
        izleniyor = true
      }
    } else {
      if (izleniyor && Build.VERSION.SDK_INT >= 23) {
        am.unregisterAudioDeviceCallback(cihazIzleyici)
        izleniyor = false
      }
      if (Build.VERSION.SDK_INT >= 26) odak?.let { am.abandonAudioFocusRequest(it) }
      odak = null
      hoparlor(false)
      am.mode = AudioManager.MODE_NORMAL
    }
  }

  /**
   * Starts / stops the microphone foreground service. Android 14 refuses a microphone service without RECORD_AUDIO, so the permission
   * is asked first; the service starts when it is granted (MainActivity.aramaIzniSonucu).
   * Mikrofon ön plan servisini başlatır / durdurur. Android 14, RECORD_AUDIO olmadan mikrofon servisini reddeder; bu yüzden önce izin
   * istenir, verilince servis başlar (MainActivity.aramaIzniSonucu).
   */
  @JavascriptInterface
  fun aramaServisi(baslat: Boolean, ad: String) {
    val etkinlik = MainActivity.aktif ?: return
    if (baslat) etkinlik.aramaServisiniBaslat(ad) else etkinlik.aramaServisiniDurdur()
  }

  private fun cikisAygitlari(): List<AudioDeviceInfo> {
    val turler = setOf(
      AudioDeviceInfo.TYPE_BUILTIN_EARPIECE, AudioDeviceInfo.TYPE_BUILTIN_SPEAKER, AudioDeviceInfo.TYPE_WIRED_HEADSET,
      AudioDeviceInfo.TYPE_WIRED_HEADPHONES, AudioDeviceInfo.TYPE_USB_HEADSET, AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
    ) + (if (Build.VERSION.SDK_INT >= 31) setOf(AudioDeviceInfo.TYPE_BLE_HEADSET) else emptySet())
    return am.getDevices(AudioManager.GET_DEVICES_OUTPUTS).filter { it.type in turler }
  }

  /** Output devices in Element Call's `window.controls.setAvailableAudioDevices` format (JSON array). · Çıkış aygıtları, Element Call'un `setAvailableAudioDevices` biçiminde (JSON dizisi). */
  @JavascriptInterface
  fun cihazlar(): String {
    val dizi = JSONArray()
    for (c in cikisAygitlari()) {
      val kulaklik = c.type != AudioDeviceInfo.TYPE_BUILTIN_EARPIECE && c.type != AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
      val ad = when (c.type) {
        AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> Dil.sec(MainActivity.aktif ?: return "[]", "Ahize", "Earpiece")
        AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> Dil.sec(MainActivity.aktif ?: return "[]", "Hoparlör", "Speaker")
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> c.productName?.toString()?.ifBlank { null } ?: "Bluetooth"
        else -> c.productName?.toString()?.ifBlank { null } ?: Dil.sec(MainActivity.aktif ?: return "[]", "Kulaklık", "Headset")
      }
      dizi.put(
        JSONObject().put("id", c.id.toString()).put("name", ad)
          .put("isEarpiece", c.type == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE)
          .put("isSpeaker", c.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER)
          .put("isExternalHeadset", kulaklik),
      )
    }
    return dizi.toString()
  }

  /** Route output to the device with this id (from [cihazlar]). · Çıkışı bu kimlikli aygıta yönlendir ([cihazlar]'dan). */
  @JavascriptInterface
  fun cihazSec(id: String) {
    val cihaz = cikisAygitlari().firstOrNull { it.id.toString() == id } ?: return
    if (Build.VERSION.SDK_INT >= 31) {
      am.setCommunicationDevice(cihaz)
    } else {
      @Suppress("DEPRECATION")
      when (cihaz.type) {
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> { am.startBluetoothSco(); am.isBluetoothScoOn = true; am.isSpeakerphoneOn = false }
        AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> { am.stopBluetoothSco(); am.isBluetoothScoOn = false; am.isSpeakerphoneOn = true }
        else -> { am.stopBluetoothSco(); am.isBluetoothScoOn = false; am.isSpeakerphoneOn = false }
      }
    }
  }

  /** Default output like Element X: headset / Bluetooth if there is one, else speaker for video, earpiece for voice. · Element X gibi varsayılan çıkış: varsa kulaklık / Bluetooth, yoksa görüntülüde hoparlör, seslide ahize. */
  @JavascriptInterface
  fun varsayilanCihaz(goruntulu: Boolean): String {
    val liste = cikisAygitlari()
    val harici = liste.firstOrNull { it.type != AudioDeviceInfo.TYPE_BUILTIN_EARPIECE && it.type != AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
    val tur = if (goruntulu) AudioDeviceInfo.TYPE_BUILTIN_SPEAKER else AudioDeviceInfo.TYPE_BUILTIN_EARPIECE
    return (harici ?: liste.firstOrNull { it.type == tur } ?: liste.firstOrNull())?.id?.toString() ?: ""
  }

  // Kept for the old 1:1 call (speaker toggle). · Eski 1:1 arama için korundu (hoparlör düğmesi).
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

/**
 * Haptics for the web UI. Uses the view's own haptic constants: they respect the system "touch feedback" setting and play the phone
 * maker's tuned effect. `FLAG_IGNORE_VIEW_SETTING` because a WebView turns haptics off for itself.
 * Web arayüzü için titreşim. Görünümün kendi dokunsal sabitlerini kullanır: sistemin "dokunma geri bildirimi" ayarına uyar ve üreticinin
 * ayarladığı etkiyi çalar. `FLAG_IGNORE_VIEW_SETTING`, WebView kendi titreşimini kapattığı için.
 */
class TitresimKoprusu(private val gorunum: android.view.View) {
  @JavascriptInterface
  fun calis(tur: String) {
    val sabit = when (tur) {
      "tik" -> HapticFeedbackConstants.CLOCK_TICK
      "agir" -> HapticFeedbackConstants.LONG_PRESS
      "tamam" -> if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.VIRTUAL_KEY
      "red" -> if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.REJECT else HapticFeedbackConstants.LONG_PRESS
      else -> if (Build.VERSION.SDK_INT >= 23) HapticFeedbackConstants.CONTEXT_CLICK else HapticFeedbackConstants.VIRTUAL_KEY
    }
    gorunum.post {
      @Suppress("DEPRECATION")
      gorunum.performHapticFeedback(sabit, HapticFeedbackConstants.FLAG_IGNORE_VIEW_SETTING)
    }
  }
}

/** Background connection switch + system font size for the web UI (Ayarlar › Bildirimler), see [BaglantiServisi]. · Web arayüzünün arka plan bağlantısı anahtarı, bkz. [BaglantiServisi]. */
class ArkaPlanKoprusu(private val ctx: Context) {
  @JavascriptInterface
  fun ayarla(acik: Boolean) {
    val n = Intent(ctx, BaglantiServisi::class.java)
    try {
      if (acik) ContextCompat.startForegroundService(ctx, n) else ctx.stopService(n)
    } catch (_: Exception) {
      // Not allowed right now (app not visible): the next launch tries again. · Şu an izin yok (uygulama görünür değil): sonraki açılış yeniden dener.
    }
  }

  /** Is the app exempt from battery optimisation (Doze cuts the network otherwise)? · Uygulama pil iyileştirmesinden muaf mı (değilse Doze ağı keser)? */
  @JavascriptInterface
  fun pilMuaf(): Boolean =
    Build.VERSION.SDK_INT < 23 || (ctx.getSystemService(Context.POWER_SERVICE) as PowerManager).isIgnoringBatteryOptimizations(ctx.packageName)

  @JavascriptInterface
  fun yaziOlcegi(): Float = ctx.resources.configuration.fontScale

  @JavascriptInterface
  fun pilAyari() {
    if (Build.VERSION.SDK_INT < 23) return
    try {
      ctx.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (_: Exception) {
    }
  }
}

/**
 * Opens web links for the UI (disAc.ts): "sekme" = Custom Tab of the default browser, "tarayici" = the browser app, else a package name.
 * A Custom Tab is a plain ACTION_VIEW with a (null) session extra, so no extra library is needed. Only http / https.
 * Web bağlantılarını açar (disAc.ts): "sekme" = varsayılan tarayıcının Custom Tab'ı, "tarayici" = tarayıcının kendisi, yoksa paket adı.
 * Custom Tab, (boş) oturum ekli düz bir ACTION_VIEW'dur; ek kitaplık gerekmez. Yalnızca http / https.
 */
class BaglantiKoprusu(private val etkinlik: MainActivity) {
  private fun web(url: String): Uri? = Uri.parse(url).takeIf { it.scheme?.lowercase() == "https" || it.scheme?.lowercase() == "http" }

  /** Neutral address: whoever opens it is a browser · Nötr adres: onu açan bir tarayıcıdır */
  private fun tarayiciNiyeti() = Intent(Intent.ACTION_VIEW, Uri.parse("https://example.invalid/")).addCategory(Intent.CATEGORY_BROWSABLE)
  private fun varsayilanTarayici(): String? =
    etkinlik.packageManager.resolveActivity(tarayiciNiyeti(), PackageManager.MATCH_DEFAULT_ONLY)?.activityInfo?.packageName?.takeIf { it != "android" }

  /** App language for the native texts; "" = follow the phone · Yerel metinlerin dili; "" = telefonu izle */
  @JavascriptInterface
  fun dil(dil: String) = Dil.yaz(etkinlik, dil.ifEmpty { null })

  @JavascriptInterface
  fun ac(url: String, yol: String, renk: String): Boolean {
    val adres = web(url) ?: return false
    val niyet = Intent(Intent.ACTION_VIEW, adres).addCategory(Intent.CATEGORY_BROWSABLE)
    when (yol) {
      "sekme" -> {
        val ek = Bundle()
        ek.putBinder("android.support.customtabs.extra.SESSION", null)
        niyet.putExtras(ek)
        niyet.putExtra("android.support.customtabs.extra.TITLE_VISIBILITY", 1)
        niyet.putExtra("androidx.browser.customtabs.extra.SHARE_STATE", 1)
        try {
          niyet.putExtra("android.support.customtabs.extra.TOOLBAR_COLOR", Color.parseColor(renk))
        } catch (_: Exception) {
        }
        varsayilanTarayici()?.let { niyet.setPackage(it) }
      }
      "tarayici" -> {
        niyet.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        varsayilanTarayici()?.let { niyet.setPackage(it) }
      }
      else -> niyet.setPackage(yol).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    return try {
      etkinlik.startActivity(niyet)
      true
    } catch (_: Exception) {
      false
    }
  }

  @JavascriptInterface
  fun uygulamalar(url: String): String {
    val dizi = JSONArray()
    val adres = web(url) ?: return "[]"
    val pm = etkinlik.packageManager
    val tarayicilar = pm.queryIntentActivities(tarayiciNiyeti(), PackageManager.MATCH_ALL).map { it.activityInfo.packageName }.toSet()
    val gorulen = mutableSetOf(etkinlik.packageName)
    for (r in pm.queryIntentActivities(Intent(Intent.ACTION_VIEW, adres).addCategory(Intent.CATEGORY_BROWSABLE), PackageManager.MATCH_ALL)) {
      val paket = r.activityInfo.packageName
      if (!gorulen.add(paket)) continue
      dizi.put(JSONObject().put("paket", paket).put("ad", r.activityInfo.applicationInfo.loadLabel(pm).toString()).put("tarayici", paket in tarayicilar))
    }
    return dizi.toString()
  }

  @JavascriptInterface
  fun paylas(url: String) {
    val niyet = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, url)
    try {
      etkinlik.startActivity(Intent.createChooser(niyet, null))
    } catch (_: Exception) {
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

  // Microphone permission asked at call start (before the foreground service: Android 14 requires it). The webview's own request for
  // the microphone then finds it already granted. Camera is asked by the webview when Element Call turns the camera on.
  // Arama başında istenen mikrofon izni (ön plan servisinden önce: Android 14 şart koşar). Webview'in kendi mikrofon isteği izni hazır bulur.
  // Kamerayı, Element Call kamerayı açınca webview ister.
  private var bekleyenAramaAdi = ""
  private val aramaIzni = registerForActivityResult(ActivityResultContracts.RequestPermission()) { verildi ->
    if (verildi) servisiBaslat(bekleyenAramaAdi)
  }

  fun aramaServisiniBaslat(ad: String) {
    bekleyenAramaAdi = ad
    runOnUiThread {
      if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) servisiBaslat(ad)
      else aramaIzni.launch(Manifest.permission.RECORD_AUDIO)
    }
  }

  private fun servisiBaslat(ad: String) {
    try {
      ContextCompat.startForegroundService(this, Intent(this, AramaServisi::class.java).putExtra(AramaServisi.EK_AD, ad))
    } catch (e: Exception) {
      // e.g. started while the app is in the background on Android 12+: the call still works, only without the guarantee.
      // örn. Android 12+'da uygulama arka plandayken başlatıldı: arama yine çalışır, yalnızca garanti olmadan.
    }
  }

  fun aramaServisiniDurdur() {
    runOnUiThread { stopService(Intent(this, AramaServisi::class.java)) }
  }

  /** "Kapat" on the ongoing-call notification → the web UI hangs up. · Süren arama bildirimindeki "Kapat" → web arayüzü kapatır. */
  fun aramaKapatIstegi() {
    web?.post { web?.evaluateJavascript("window.dispatchEvent(new CustomEvent('rubychat-arama-kapat'))", null) }
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
    // The page applies the system font size itself (yaziOlcegi): text zoom would scale letters but not boxes. · Sistem yazı boyutunu sayfa kendisi uygular (yaziOlcegi): yazı büyütme harfleri büyütür, kutuları büyütmez.
    webView.settings.textZoom = 100
    webView.addJavascriptInterface(TitresimKoprusu(webView), "RubyTitresim")
    webView.addJavascriptInterface(ArkaPlanKoprusu(this), "RubyArkaPlan")
    webView.addJavascriptInterface(BaglantiKoprusu(this), "RubyBaglanti")
    webView.addJavascriptInterface(
      SesKoprusu(this) { web?.post { web?.evaluateJavascript("window.dispatchEvent(new CustomEvent('rubychat-ses-cihazlari'))", null) } },
      "RubySes",
    )
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
