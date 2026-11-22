package dev.rubyyard.rubychat

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.Effect
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.Presentation
import androidx.media3.transformer.AudioEncoderSettings
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.VideoEncoderSettings
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Video compression for the Rust side (called with JNI from src-tauri/src/android_jni.rs, run from src/matrix/medya.rs).
 * Re-encodes to H.264 + AAC with androidx Media3 Transformer (hardware MediaCodec, no extra native package): optional height limit,
 * target bitrate, trim (ClippingConfiguration) and mute. Result text: "ok;<w>;<h>;<sureMs>" or "hata;<message>".
 *
 * Media3 Transformer must be built and started on a thread with a Looper, so the work is posted to the main looper and the calling
 * (Rust, non-main) thread waits on a latch. Never call [calistir] from the main thread: it would deadlock.
 * Rust tarafı için video sıkıştırma (JNI ile src-tauri/src/android_jni.rs'den çağrılır, src/matrix/medya.rs yürütür).
 * androidx Media3 Transformer ile H.264 + AAC'ye yeniden kodlar (donanım MediaCodec, ek yerel paket yok): isteğe bağlı yükseklik sınırı,
 * hedef bit hızı, kesme (ClippingConfiguration) ve sessize alma. Sonuç metni: "ok;<w>;<h>;<sureMs>" ya da "hata;<mesaj>".
 *
 * Media3 Transformer, Looper'ı olan bir iş parçacığında kurulup başlatılmalı; bu yüzden iş ana looper'a gönderilir ve çağıran
 * (Rust, ana olmayan) iş parçacığı bir mandalda bekler. [calistir]i asla ana iş parçacığından çağırma: kilitlenir.
 *
 * Static (`@JvmStatic`): JNI finds these by name + signature; keep in sync with android_jni.rs.
 * Static (`@JvmStatic`): JNI bunları ad + imzayla bulur; android_jni.rs ile uyumlu tut.
 */
@OptIn(UnstableApi::class)
object VideoSikistir {
  private val ana = Handler(Looper.getMainLooper())

  @Volatile private var yuzde = 0
  @Volatile private var aktif: Transformer? = null
  @Volatile private var bekle: CountDownLatch? = null
  @Volatile private var sonuc: String? = null

  @JvmStatic
  fun ilerleme(): Int = yuzde

  /** Cancels a running transcode. Transformer.cancel() does not call the listener, so we release the waiting thread ourselves. */
  /** Süren dönüşümü iptal eder. Transformer.cancel() dinleyiciyi çağırmaz; bekleyen iş parçacığını kendimiz serbest bırakırız. */
  @JvmStatic
  fun iptal() {
    ana.post {
      aktif?.cancel()
      aktif = null
      sonuc = "hata;iptal edildi"
      bekle?.countDown()
    }
  }

  @JvmStatic
  fun calistir(
    ctx: Context,
    girdi: String,
    cikti: String,
    hedefYukseklik: Int,
    bitrate: Int,
    baslaMs: Long,
    bitisMs: Long,
    sessiz: Boolean,
  ): String {
    val kilit = CountDownLatch(1)
    bekle = kilit
    sonuc = null
    yuzde = 0
    val uygulama = ctx.applicationContext

    ana.post {
      try {
        File(cikti).delete()
        val boyut = kaynakBoyutu(girdi)

        val klip = MediaItem.ClippingConfiguration.Builder().setStartPositionMs(baslaMs)
        if (bitisMs > 0) klip.setEndPositionMs(bitisMs)
        val oge = MediaItem.Builder()
          .setUri(Uri.fromFile(File(girdi)))
          .setClippingConfiguration(klip.build())
          .build()

        // Shrink by the SHORT edge (720p = 720 px short side) and never enlarge. Presentation works on the upright frame,
        // so portrait phone videos (rotation metadata) are handled by using the displayed size.
        // KISA kenara göre küçült (720p = kısa kenar 720 px) ve asla büyütme. Presentation dik kareyle çalışır; bu yüzden
        // dikey telefon videoları (dönüş üstverisi) görüntülenen boyut kullanılarak ele alınır.
        val efektler = ArrayList<Effect>()
        if (hedefYukseklik > 0 && boyut != null) {
          val kisa = minOf(boyut.first, boyut.second)
          if (kisa > hedefYukseklik) {
            val oran = hedefYukseklik.toDouble() / kisa
            efektler.add(
              Presentation.createForWidthAndHeight(
                cift((boyut.first * oran).toInt()),
                cift((boyut.second * oran).toInt()),
                Presentation.LAYOUT_SCALE_TO_FIT,
              ),
            )
          }
        }

        val duzenlenen = EditedMediaItem.Builder(oge)
          .setRemoveAudio(sessiz)
          .setEffects(Effects(emptyList<AudioProcessor>(), efektler))
          .build()

        val kodlayici = DefaultEncoderFactory.Builder(uygulama)
          .setRequestedVideoEncoderSettings(VideoEncoderSettings.Builder().setBitrate(if (bitrate > 0) bitrate else 2_500_000).build())
          .setRequestedAudioEncoderSettings(AudioEncoderSettings.Builder().setBitrate(96_000).build())
          .build()

        val donusturucu = Transformer.Builder(uygulama)
          .setVideoMimeType(MimeTypes.VIDEO_H264)
          .setAudioMimeType(MimeTypes.AUDIO_AAC)
          .setEncoderFactory(kodlayici)
          .addListener(
            object : Transformer.Listener {
              override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                aktif = null
                yuzde = 100
                sonuc = olc(cikti)
                kilit.countDown()
              }

              override fun onError(composition: Composition, exportResult: ExportResult, exportException: ExportException) {
                aktif = null
                sonuc = "hata;" + (exportException.errorCodeName ?: "bilinmeyen")
                kilit.countDown()
              }
            },
          )
          .build()
        aktif = donusturucu
        donusturucu.start(duzenlenen, cikti)
        izle(donusturucu)
      } catch (e: Exception) {
        sonuc = "hata;" + (e.message ?: e.javaClass.simpleName)
        kilit.countDown()
      }
    }

    // Generous limit: a long clip on a slow phone can take minutes. · Cömert sınır: yavaş telefonda uzun klip dakikalar sürebilir.
    val bitti = kilit.await(40, TimeUnit.MINUTES)
    return if (bitti) (sonuc ?: "hata;sonuç yok") else "hata;zaman aşımı"
  }

  /** Polls Transformer's progress on the main thread (the only thread allowed to ask). · Transformer ilerlemesini ana iş parçacığında sorgular (sormaya izinli tek iş parçacığı). */
  private fun izle(t: Transformer) {
    val tutucu = ProgressHolder()
    if (t.getProgress(tutucu) == Transformer.PROGRESS_STATE_AVAILABLE) yuzde = tutucu.progress
    ana.postDelayed({ if (aktif === t) izle(t) }, 300)
  }

  private fun cift(n: Int): Int = if (n % 2 == 0) maxOf(n, 2) else maxOf(n - 1, 2)

  /** Displayed (rotation-corrected) width and height of a video file, or null if unreadable. · Video dosyasının görüntülenen (dönüşü düzeltilmiş) genişlik ve yüksekliği; okunamazsa null. */
  private fun kaynakBoyutu(yol: String): Pair<Int, Int>? {
    val r = MediaMetadataRetriever()
    try {
      r.setDataSource(yol)
      val g = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: return null
      val y = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: return null
      val d = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
      return if (d == 90 || d == 270) Pair(y, g) else Pair(g, y)
    } catch (e: Exception) {
      return null
    } finally {
      r.release()
    }
  }

  private fun olc(yol: String): String {
    val b = kaynakBoyutu(yol) ?: return "hata;çıktı okunamadı"
    val r = MediaMetadataRetriever()
    var sure = 0L
    try {
      r.setDataSource(yol)
      sure = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
    } catch (e: Exception) {
      // The duration is optional. · Süre isteğe bağlı.
    } finally {
      r.release()
    }
    return "ok;${b.first};${b.second};$sure"
  }
}
