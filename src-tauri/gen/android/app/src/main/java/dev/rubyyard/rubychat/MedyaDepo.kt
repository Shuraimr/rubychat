package dev.rubyyard.rubychat

import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream

/**
 * Saves a received photo / video / file to the phone ("Kaydet" in the viewer). Called with JNI from android_jni.rs.
 * Android 10+ uses MediaStore, which needs NO storage permission; photos go to Pictures/rubychat, videos to Movies/rubychat,
 * everything else to Download/rubychat. Returns "" on success, otherwise the error text.
 * Alınan fotoğraf / video / dosyayı telefona kaydeder (görüntüleyicideki "Kaydet"). JNI ile android_jni.rs'den çağrılır.
 * Android 10+ MediaStore kullanır; depolama izni GEREKMEZ. Fotoğraflar Pictures/rubychat'e, videolar Movies/rubychat'e,
 * geri kalan her şey Download/rubychat'e gider. Başarıda "", yoksa hata metni döner.
 */
object MedyaDepo {
  @JvmStatic
  fun kaydet(ctx: Context, yol: String, ad: String, mime: String): String {
    return try {
      val resim = mime.startsWith("image/")
      val video = mime.startsWith("video/")
      val klasor = when {
        resim -> Environment.DIRECTORY_PICTURES
        video -> Environment.DIRECTORY_MOVIES
        else -> Environment.DIRECTORY_DOWNLOADS
      }
      if (Build.VERSION.SDK_INT >= 29) {
        val degerler = ContentValues().apply {
          put(MediaStore.MediaColumns.DISPLAY_NAME, ad)
          put(MediaStore.MediaColumns.MIME_TYPE, mime)
          put(MediaStore.MediaColumns.RELATIVE_PATH, "$klasor/rubychat")
        }
        val koleksiyon = when {
          resim -> MediaStore.Images.Media.EXTERNAL_CONTENT_URI
          video -> MediaStore.Video.Media.EXTERNAL_CONTENT_URI
          else -> MediaStore.Downloads.EXTERNAL_CONTENT_URI
        }
        val uri = ctx.contentResolver.insert(koleksiyon, degerler) ?: return "kayıt oluşturulamadı"
        ctx.contentResolver.openOutputStream(uri)?.use { cikis ->
          FileInputStream(yol).use { giris -> giris.copyTo(cikis) }
        } ?: return "dosya açılamadı"
      } else {
        // Android 7-9: classic public folders (needs the WRITE_EXTERNAL_STORAGE grant, declared up to API 28).
        // Android 7-9: klasik genel klasörler (WRITE_EXTERNAL_STORAGE izni gerekir; API 28'e kadar bildirildi).
        val hedef = File(Environment.getExternalStoragePublicDirectory(klasor), "rubychat")
        hedef.mkdirs()
        FileInputStream(yol).use { giris -> FileOutputStream(File(hedef, ad)).use { giris.copyTo(it) } }
      }
      ""
    } catch (e: Exception) {
      e.message ?: e.javaClass.simpleName
    }
  }
}
