package dev.rubyyard.rubychat

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

/**
 * Android half of the in-app updater (called via JNI from `src-tauri/src/android_jni.rs`):
 * streaming SHA-256 verification and launching the system package installer through `FileProvider`.
 * Uygulama içi güncelleyicinin Android yarısı (`src-tauri/src/android_jni.rs`'ten JNI ile çağrılır):
 * akışla SHA-256 doğrulama ve `FileProvider` üzerinden sistem paket yükleyicisini başlatma.
 */
object Guncelleyici {
  private const val HEX = "0123456789abcdef"

  /** Computes the lowercase hex SHA-256 of a file using a 64 KB buffer so large APKs never spike memory. */
  /** Büyük APK'lar belleği şişirmesin diye 64 KB tamponla dosyanın küçük harf onaltılık SHA-256 özetini hesaplar. */
  @JvmStatic
  fun sha256(yol: String): String {
    val md = MessageDigest.getInstance("SHA-256")
    val tampon = ByteArray(64 * 1024)
    FileInputStream(yol).use { giris ->
      while (true) {
        val n = giris.read(tampon)
        if (n <= 0) break
        md.update(tampon, 0, n)
      }
    }
    val ozet = md.digest()
    val sonuc = StringBuilder(ozet.size * 2)
    for (b in ozet) {
      val v = b.toInt() and 0xFF
      sonuc.append(HEX[v ushr 4])
      sonuc.append(HEX[v and 0x0F])
    }
    return sonuc.toString()
  }

  /** Whether Android allows rubychat to request APK installs (Android 8+ enforces this per app). */
  /** Android'in rubychat için APK kurulumu istemeye izin verip vermediği (Android 8+ bunu uygulama başına zorunlu kılar). */
  @JvmStatic
  fun izinVar(ctx: Context): Boolean =
    if (Build.VERSION.SDK_INT >= 26) ctx.packageManager.canRequestPackageInstalls() else true

  /** Opens Android's per-app "Install unknown apps" permission screen. */
  /** Android'in uygulama başına "Bilinmeyen uygulamaları yükle" izin ekranını açar. */
  @JvmStatic
  fun izinAc(ctx: Context) {
    if (Build.VERSION.SDK_INT < 26) return
    val niyet = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.packageName))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val baslatici: Context = MainActivity.aktif ?: ctx
    baslatici.startActivity(niyet)
  }

  /** Opens the system installer for an APK in the app cache; returns false when install permission is missing. */
  /** Uygulama önbelleğindeki APK için sistem yükleyicisini açar; kurulum izni yoksa false döndürür. */
  @JvmStatic
  fun kur(ctx: Context, yol: String): Boolean {
    if (!izinVar(ctx)) return false
    val uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".fileprovider", File(yol))
    val niyet = Intent(Intent.ACTION_VIEW)
      .setDataAndType(uri, "application/vnd.android.package-archive")
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
    val baslatici: Context = MainActivity.aktif ?: ctx
    baslatici.startActivity(niyet)
    return true
  }
}
