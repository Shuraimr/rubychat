package dev.rubyyard.rubychat

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.NoiseSuppressor
import androidx.core.content.ContextCompat

/**
 * Sound of native calls (Rust: src-tauri/src/matrix/yerel_arama/ses.rs through android_jni.rs). Rust owns the threads and the mixing;
 * this only opens the device: [yaz] blocks until the AudioTrack took 10 ms (the device sets the pace, like `pacat` on Linux) and [oku]
 * blocks until the AudioRecord has 10 ms. Closing from another thread wakes a waiting call. Communication mode, audio focus, routing and
 * the foreground service stay in SesKoprusu / AramaServisi (the UI turns them on at call start).
 * Yerel aramaların sesi (Rust: src-tauri/src/matrix/yerel_arama/ses.rs, android_jni.rs üzerinden). İş parçacıkları ve karıştırma Rust'ta;
 * bu yalnızca cihazı açar: [yaz] AudioTrack 10 ms'yi alana dek bekler (tempoyu cihaz belirler, Linux'taki `pacat` gibi), [oku]
 * AudioRecord'da 10 ms olana dek bekler. Başka iş parçacığından kapatmak bekleyen çağrıyı uyandırır. İletişim modu, ses odağı,
 * yönlendirme ve ön plan servisi SesKoprusu / AramaServisi'nde kalır (arayüz arama başında açar).
 */
object AramaSesi {
  private const val HIZ = 48_000

  @Volatile private var calar: AudioTrack? = null
  @Volatile private var kayit: AudioRecord? = null
  private var yanki: AcousticEchoCanceler? = null
  private var gurultu: NoiseSuppressor? = null

  @JvmStatic
  @Synchronized
  fun calAc(ctx: Context): Boolean {
    calKapat()
    return try {
      val bicim = AudioFormat.Builder().setSampleRate(HIZ).setChannelMask(AudioFormat.CHANNEL_OUT_STEREO).setEncoding(AudioFormat.ENCODING_PCM_16BIT).build()
      val en = AudioTrack.getMinBufferSize(HIZ, AudioFormat.CHANNEL_OUT_STEREO, AudioFormat.ENCODING_PCM_16BIT)
      // Small buffer: every extra block is delay in the call. · Küçük tampon: fazladan her blok aramada gecikmedir.
      val t = AudioTrack.Builder()
        .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
        .setAudioFormat(bicim)
        .setBufferSizeInBytes(maxOf(en, HIZ / 100 * 4 * 4))
        .setTransferMode(AudioTrack.MODE_STREAM)
        .build()
      t.play()
      calar = t
      true
    } catch (e: Exception) {
      false
    }
  }

  @JvmStatic
  fun yaz(veri: ShortArray, n: Int): Int {
    val t = calar ?: return -1
    return try {
      t.write(veri, 0, n, AudioTrack.WRITE_BLOCKING)
    } catch (e: Exception) {
      -1
    }
  }

  @JvmStatic
  @Synchronized
  fun calKapat() {
    val t = calar ?: return
    calar = null
    try {
      t.pause()
      t.flush()
      t.stop()
    } catch (_: Exception) {
    }
    sonraBirak { t.release() }
  }

  @JvmStatic
  @Synchronized
  fun kayitAc(ctx: Context): Boolean {
    kayitKapat()
    if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return false
    return try {
      val en = AudioRecord.getMinBufferSize(HIZ, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
      @Suppress("MissingPermission")
      val r = AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION, HIZ, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(en, HIZ / 100 * 2 * 4))
      if (r.state != AudioRecord.STATE_INITIALIZED) {
        r.release()
        return false
      }
      // The phone's own echo canceller / noise suppressor when it has them (WebRTC's runs in Rust as well).
      // Telefonun kendi yankı giderici / gürültü bastırıcısı varsa (WebRTC'ninki Rust'ta da çalışır).
      if (AcousticEchoCanceler.isAvailable()) yanki = AcousticEchoCanceler.create(r.audioSessionId)?.also { it.enabled = true }
      if (NoiseSuppressor.isAvailable()) gurultu = NoiseSuppressor.create(r.audioSessionId)?.also { it.enabled = true }
      r.startRecording()
      kayit = r
      true
    } catch (e: Exception) {
      false
    }
  }

  @JvmStatic
  fun oku(veri: ShortArray, n: Int): Int {
    val r = kayit ?: return -1
    return try {
      var okunan = 0
      while (okunan < n) {
        val k = r.read(veri, okunan, n - okunan)
        if (k <= 0) return if (okunan > 0) okunan else -1
        okunan += k
      }
      okunan
    } catch (e: Exception) {
      -1
    }
  }

  @JvmStatic
  @Synchronized
  fun kayitKapat() {
    val r = kayit ?: return
    kayit = null
    try {
      r.stop()
    } catch (_: Exception) {
    }
    val (y, g) = yanki to gurultu
    yanki = null
    gurultu = null
    sonraBirak {
      y?.release()
      g?.release()
      r.release()
    }
  }

  // stop() wakes the waiting read/write on the Rust thread; releasing at the same moment could free what it still touches.
  // stop() Rust iş parçacığındaki bekleyen okuma/yazmayı uyandırır; aynı anda bırakmak onun hâlâ dokunduğunu serbest bırakabilirdi.
  private fun sonraBirak(birak: () -> Unit) {
    Thread {
      try {
        Thread.sleep(300)
        birak()
      } catch (_: Exception) {
      }
    }.start()
  }
}
