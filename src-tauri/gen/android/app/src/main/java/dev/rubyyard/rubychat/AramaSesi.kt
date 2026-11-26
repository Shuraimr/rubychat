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
import java.util.concurrent.atomic.AtomicInteger

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

  /**
   * One opened device with an id (generation) and a use counter. The device is released only when it is closed AND no write/read is
   * running any more: releasing under a running call could crash the native layer, and a fixed sleep cannot guarantee that.
   * Kimliği (kuşağı) ve kullanım sayacı olan açılmış bir cihaz. Cihaz yalnızca kapatıldığında VE çalışan yazma/okuma kalmadığında
   * bırakılır: çalışan çağrının altında bırakmak yerel katmanı çökertebilir, sabit bir uyku bunu garanti edemez.
   */
  private class Parca<T>(val id: Int, val nesne: T, private val birak: () -> Unit) {
    private var kullanim = 0
    private var kapali = false
    private var birakildi = false

    /** Starts a call; false when already closed. · Bir çağrı başlatır; zaten kapalıysa false. */
    @Synchronized
    fun gir(): Boolean {
      if (kapali) return false
      kullanim++
      return true
    }

    /** Ends a call; releases if it was the last one after closing. · Çağrıyı bitirir; kapanmışsa ve sonuncuysa bırakır. */
    @Synchronized
    fun cik() {
      kullanim--
      birakGerekirse()
    }

    @Synchronized
    fun kapat() {
      kapali = true
      birakGerekirse()
    }

    private fun birakGerekirse() {
      if (kapali && kullanim <= 0 && !birakildi) {
        birakildi = true
        try {
          birak()
        } catch (_: Exception) {
        }
      }
    }
  }

  private val kimlik = AtomicInteger(0)
  @Volatile private var calar: Parca<AudioTrack>? = null
  @Volatile private var kayit: Parca<AudioRecord>? = null

  /** Opens the player; returns its id (> 0) or 0 when it could not be opened. · Çaları açar; kimliğini (> 0) ya da açılamadıysa 0 döndürür. */
  @JvmStatic
  @Synchronized
  fun calAc(ctx: Context): Int {
    calKapat(calar?.id ?: 0)
    var t: AudioTrack? = null
    return try {
      val bicim = AudioFormat.Builder().setSampleRate(HIZ).setChannelMask(AudioFormat.CHANNEL_OUT_STEREO).setEncoding(AudioFormat.ENCODING_PCM_16BIT).build()
      val en = AudioTrack.getMinBufferSize(HIZ, AudioFormat.CHANNEL_OUT_STEREO, AudioFormat.ENCODING_PCM_16BIT)
      // Small buffer: every extra block is delay in the call. · Küçük tampon: fazladan her blok aramada gecikmedir.
      val yeni = AudioTrack.Builder()
        .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
        .setAudioFormat(bicim)
        .setBufferSizeInBytes(maxOf(en, HIZ / 100 * 4 * 4))
        .setTransferMode(AudioTrack.MODE_STREAM)
        .build()
      t = yeni
      if (yeni.state != AudioTrack.STATE_INITIALIZED) {
        yeni.release()
        return 0
      }
      yeni.play()
      val id = kimlik.incrementAndGet()
      calar = Parca(id, yeni) { yeni.release() }
      id
    } catch (e: Exception) {
      try {
        t?.release()
      } catch (_: Exception) {
      }
      0
    }
  }

  /** Writes to the player with this id; -1 when it is not the current one. · Bu kimlikli çalara yazar; güncel değilse -1. */
  @JvmStatic
  fun yaz(id: Int, veri: ShortArray, n: Int): Int {
    val p = calar
    if (p == null || p.id != id || !p.gir()) return -1
    return try {
      p.nesne.write(veri, 0, n, AudioTrack.WRITE_BLOCKING)
    } catch (e: Exception) {
      -1
    } finally {
      p.cik()
    }
  }

  /** Closes only the player with this id (a stale thread cannot close a newer one). · Yalnızca bu kimlikli çaları kapatır (eski iş parçacığı yeniyi kapatamaz). */
  @JvmStatic
  fun calKapat(id: Int) {
    val p = synchronized(this) {
      val x = calar ?: return
      if (x.id != id) return
      calar = null
      x
    }
    // stop() wakes a write that waits; the release itself waits for that write to leave.
    // stop() bekleyen yazmayı uyandırır; bırakma işlemi o yazmanın çıkmasını bekler.
    try {
      p.nesne.pause()
      p.nesne.flush()
      p.nesne.stop()
    } catch (_: Exception) {
    }
    p.kapat()
  }

  /** Opens the microphone; returns its id (> 0) or 0 (no permission / could not open). · Mikrofonu açar; kimliğini (> 0) ya da 0 (izin yok / açılamadı) döndürür. */
  @JvmStatic
  @Synchronized
  fun kayitAc(ctx: Context): Int {
    kayitKapat(kayit?.id ?: 0)
    if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return 0
    var r: AudioRecord? = null
    var y: AcousticEchoCanceler? = null
    var g: NoiseSuppressor? = null
    return try {
      val en = AudioRecord.getMinBufferSize(HIZ, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
      @Suppress("MissingPermission")
      val yeni = AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION, HIZ, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(en, HIZ / 100 * 2 * 4))
      r = yeni
      if (yeni.state != AudioRecord.STATE_INITIALIZED) {
        yeni.release()
        return 0
      }
      // The phone's own echo canceller / noise suppressor when it has them (WebRTC's runs in Rust as well).
      // Telefonun kendi yankı giderici / gürültü bastırıcısı varsa (WebRTC'ninki Rust'ta da çalışır).
      if (AcousticEchoCanceler.isAvailable()) y = AcousticEchoCanceler.create(yeni.audioSessionId)?.also { it.enabled = true }
      if (NoiseSuppressor.isAvailable()) g = NoiseSuppressor.create(yeni.audioSessionId)?.also { it.enabled = true }
      yeni.startRecording()
      val ya = y
      val gu = g
      val id = kimlik.incrementAndGet()
      kayit = Parca(id, yeni) {
        ya?.release()
        gu?.release()
        yeni.release()
      }
      id
    } catch (e: Exception) {
      // Every half-opened piece is released on the error path. · Hata yolunda yarım açılan her parça bırakılır.
      try {
        y?.release()
      } catch (_: Exception) {
      }
      try {
        g?.release()
      } catch (_: Exception) {
      }
      try {
        r?.release()
      } catch (_: Exception) {
      }
      0
    }
  }

  /** Reads from the microphone with this id; -1 when it is not the current one. · Bu kimlikli mikrofondan okur; güncel değilse -1. */
  @JvmStatic
  fun oku(id: Int, veri: ShortArray, n: Int): Int {
    val p = kayit
    if (p == null || p.id != id || !p.gir()) return -1
    return try {
      var okunan = 0
      while (okunan < n) {
        val k = p.nesne.read(veri, okunan, n - okunan)
        if (k <= 0) return if (okunan > 0) okunan else -1
        okunan += k
      }
      okunan
    } catch (e: Exception) {
      -1
    } finally {
      p.cik()
    }
  }

  /** Closes only the microphone with this id. · Yalnızca bu kimlikli mikrofonu kapatır. */
  @JvmStatic
  fun kayitKapat(id: Int) {
    val p = synchronized(this) {
      val x = kayit ?: return
      if (x.id != id) return
      kayit = null
      x
    }
    try {
      p.nesne.stop()
    } catch (_: Exception) {
    }
    p.kapat()
  }
}
