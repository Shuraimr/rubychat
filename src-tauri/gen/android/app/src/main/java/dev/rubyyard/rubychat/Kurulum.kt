package dev.rubyyard.rubychat

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.webkit.WebView
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewCompat
import org.json.JSONArray
import org.json.JSONObject

/**
 * Android half of the setup diagnostics report (`kurulum_raporu.rs`): gathers OS, WebView and permission checks
 * as JSON, and opens the matching Android settings screens for fix actions.
 * Kurulum tanı raporunun Android yarısı (`kurulum_raporu.rs`): işletim sistemi, WebView ve izin denetimlerini
 * JSON olarak toplar ve düzeltme eylemleri için ilgili Android ayar ekranlarını açar.
 */
object Kurulum {
  private fun satir(kimlik: String, grup: String, durum: String, deger: String? = null, eylem: String? = null): JSONObject =
    JSONObject().apply {
      put("kimlik", kimlik)
      put("grup", grup)
      put("durum", durum)
      if (deger != null) put("deger", deger)
      if (eylem != null) put("eylem", eylem)
    }

  private fun webviewSurumu(ctx: Context): String? = try {
    if (Build.VERSION.SDK_INT >= 26) {
      WebView.getCurrentWebViewPackage()?.versionName
    } else {
      WebViewCompat.getCurrentWebViewPackage(ctx)?.versionName
    }
  } catch (_: Exception) {
    null
  }

  /** Returns a JSON array matching Rust's `Vec<RaporSatiri>`. · Rust'ın `Vec<RaporSatiri>` yapısıyla eşleşen JSON dizisi döndürür. */
  @JvmStatic
  fun rapor(ctx: Context): String {
    val dizi = JSONArray()

    // Android OS version · Android sürümü
    val androidDurum = if (Build.VERSION.SDK_INT < 29) "uyari" else "tamam"
    dizi.put(satir("android", "sistem", androidDurum, "Android ${Build.VERSION.RELEASE}"))

    // System WebView major version (< 120 lacks modern CSS/JS features the UI relies on).
    // Sistem WebView ana sürümü (< 120, arayüzün dayandığı güncel CSS/JS özelliklerinden yoksundur).
    val wvTam = webviewSurumu(ctx)
    val wvAna = wvTam?.substringBefore('.')?.toIntOrNull()
    val wvDurum = if (wvAna == null || wvAna < 120) "uyari" else "tamam"
    dizi.put(satir("webview", "sistem", wvDurum, wvAna?.toString() ?: wvTam))

    // Notifications · Bildirimler
    val bildirimVar = NotificationManagerCompat.from(ctx).areNotificationsEnabled()
    dizi.put(
      satir(
        "bildirim_izni",
        "izinler",
        if (bildirimVar) "tamam" else "eksik",
        eylem = if (bildirimVar) null else "bildirim_izni",
      ),
    )

    // Microphone & camera: "uyari" rather than "eksik" because calls prompt for them when needed.
    // Mikrofon ve kamera: arama sırasında istenecekleri için "eksik" değil "uyari".
    val mikrofonVar = ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    dizi.put(
      satir(
        "mikrofon",
        "izinler",
        if (mikrofonVar) "tamam" else "uyari",
        eylem = if (mikrofonVar) null else "mikrofon",
      ),
    )

    val kameraVar = ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
    dizi.put(
      satir(
        "kamera",
        "izinler",
        if (kameraVar) "tamam" else "uyari",
        eylem = if (kameraVar) null else "kamera",
      ),
    )

    // Battery optimisation exemption (without it Doze suspends background sync).
    // Pil iyileştirmesi muafiyeti (olmazsa Doze arka plan eşitlemesini durdurur).
    val pm = ctx.getSystemService(Context.POWER_SERVICE) as? PowerManager
    val pilMuaf = Build.VERSION.SDK_INT < 23 || (pm?.isIgnoringBatteryOptimizations(ctx.packageName) ?: true)
    dizi.put(
      satir(
        "pil",
        "izinler",
        if (pilMuaf) "tamam" else "uyari",
        eylem = if (pilMuaf) null else "pil_muaf",
      ),
    )

    // Unknown-sources install permission for in-app APK updates · Uygulama içi APK güncellemeleri için yükleme izni
    val yuklemeVar = Guncelleyici.izinVar(ctx)
    dizi.put(
      satir(
        "yukleme_izni",
        "izinler",
        if (yuklemeVar) "tamam" else "uyari",
        eylem = if (yuklemeVar) null else "yukleme_izni",
      ),
    )

    return dizi.toString()
  }

  private fun uygulamaAyarlariniAc(ctx: Context) {
    val niyet = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.packageName))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val baslatici: Context = MainActivity.aktif ?: ctx
    baslatici.startActivity(niyet)
  }

  /** Opens the system screen for a setup-report fix action. Returns false for unknown actions. */
  /** Kurulum raporu düzeltme eylemi için sistem ekranını açar. Bilinmeyen eylemler için false döndürür. */
  @JvmStatic
  fun duzelt(ctx: Context, eylem: String): Boolean {
    val baslatici: Context = MainActivity.aktif ?: ctx
    return when (eylem) {
      "pil_muaf" -> {
        if (Build.VERSION.SDK_INT >= 23) {
          // Matches MainActivity's ArkaPlanKoprusu.pilAyari(): REQUEST_IGNORE_BATTERY_OPTIMIZATIONS is not in the manifest.
          // MainActivity'deki ArkaPlanKoprusu.pilAyari() ile aynı: manifestte REQUEST_IGNORE_BATTERY_OPTIMIZATIONS izni yok.
          try {
            baslatici.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
          } catch (_: Exception) {
            uygulamaAyarlariniAc(ctx)
          }
        }
        true
      }
      "mikrofon", "kamera" -> {
        uygulamaAyarlariniAc(ctx)
        true
      }
      "yukleme_izni" -> {
        Guncelleyici.izinAc(ctx)
        true
      }
      else -> false
    }
  }
}
