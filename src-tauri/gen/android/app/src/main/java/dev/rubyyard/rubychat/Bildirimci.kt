package dev.rubyyard.rubychat

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.app.RemoteInput
import androidx.core.graphics.drawable.IconCompat

/**
 * Native half of the notifications (called with JNI from src-tauri/src/android_jni.rs; decisions are made in src/bildirim.rs).
 * Two channels: "mesajlar" (high importance) and "aramalar" (call category, full-screen intent when allowed).
 * One MessagingStyle notification per room: it keeps the last few messages in memory and re-posts, so a burst of messages stacks
 * up in one card. Actions: inline reply (RemoteInput) and "Okundu"; both reach Rust through [YerelKoprusu].
 * Without push (FCM / UnifiedPush) this only runs while the app process is alive.
 * Bildirimlerin yerel yarısı (JNI ile src-tauri/src/android_jni.rs'den çağrılır; kararlar src/bildirim.rs'de verilir).
 * İki kanal: "mesajlar" (yüksek önem) ve "aramalar" (arama kategorisi, izin varsa tam ekran niyet).
 * Oda başına tek MessagingStyle bildirimi: son birkaç mesajı bellekte tutup yeniden yayınlar; mesaj yağmuru tek kartta birikir.
 * Eylemler: satır içi yanıt (RemoteInput) ve "Okundu"; ikisi de [YerelKoprusu] ile Rust'a ulaşır.
 * Anlık bildirim (FCM / UnifiedPush) olmadan yalnızca uygulama süreci canlıyken çalışır.
 */
object Bildirimci {
  private const val KANAL_MESAJ = "mesajlar"
  private const val KANAL_ARAMA = "aramalar"
  const val EK_ODA = "odaId"
  const val EK_OLAY = "olayId"
  const val EYLEM_YANIT = "dev.rubyyard.rubychat.YANIT"
  const val EYLEM_OKUNDU = "dev.rubyyard.rubychat.OKUNDU"
  const val YANIT_ANAHTARI = "yanit_metni"
  private const val ZEMIN = 0xFF1F2A4D.toInt() // --ton
  private const val YAZI = 0xFFD6DFFF.toInt() // --ton-ustu
  private const val VURGU = 0xFF9DB4FF.toInt() // --vurgu

  private class Mesaj(val gonderen: String?, val metin: String, val zaman: Long, val olayId: String)

  private val gecmis = HashMap<String, MutableList<Mesaj>>()
  private val odaAdlari = HashMap<String, String>()
  private val ana = Handler(Looper.getMainLooper())

  @Volatile private var onPlanda = false
  @Volatile private var bekleyenOda: String? = null
  @Volatile private var sayfaHazir = false
  @Volatile private var izinSonucu = 0 // 0 waiting, 1 granted, 2 denied · 0 bekliyor, 1 verildi, 2 reddedildi

  // ---- Lifecycle / state (MainActivity) · Yaşam döngüsü / durum (MainActivity) ----

  fun onPlandaYap(deger: Boolean) {
    onPlanda = deger
  }

  @JvmStatic
  fun onPlandaMi(): Boolean = onPlanda

  fun sayfaSifirla() {
    sayfaHazir = false
  }

  /** A notification was tapped (or the app was opened by one). Live if the page is ready, otherwise kept for [bekleyenOdaAl]. */
  /** Bir bildirime dokunuldu (ya da uygulama onunla açıldı). Sayfa hazırsa canlı iletilir, değilse [bekleyenOdaAl] için saklanır. */
  fun odaIstendi(oda: String, ilet: (String) -> Unit) {
    if (sayfaHazir) ilet(oda) else bekleyenOda = oda
  }

  /** Cold-start pull from the UI (through Rust): returns the pending room once and marks the page as ready for live events. */
  /** Arayüzün soğuk açılış sorgusu (Rust üzerinden): bekleyen odayı bir kez döndürür ve sayfayı canlı olaylara hazır işaretler. */
  @JvmStatic
  fun bekleyenOdaAl(): String {
    sayfaHazir = true
    val o = bekleyenOda ?: ""
    bekleyenOda = null
    return o
  }

  // ---- Permission · İzin ----

  @JvmStatic
  fun izinVar(ctx: Context): Boolean = NotificationManagerCompat.from(ctx).areNotificationsEnabled()

  @JvmStatic
  fun izinSonuc(): Int = izinSonucu

  fun izinSonucuYaz(verildi: Boolean) {
    izinSonucu = if (verildi) 1 else 2
  }

  /** Shows the system dialog (Android 13+). The answer arrives in [izinSonucuYaz]; Rust polls [izinSonuc]. */
  /** Sistem penceresini gösterir (Android 13+). Cevap [izinSonucuYaz]a gelir; Rust [izinSonuc]u sorgular. */
  @JvmStatic
  fun izinIste() {
    izinSonucu = 0
    ana.post {
      val etkinlik = MainActivity.aktif
      if (etkinlik == null) izinSonucu = 2 else etkinlik.bildirimIzniIste()
    }
  }

  @JvmStatic
  fun ayarlariAc(ctx: Context) {
    val niyet = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
      .putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    ctx.startActivity(niyet)
  }

  // ---- Posting · Yayınlama ----

  private fun kanallariKur(ctx: Context) {
    if (Build.VERSION.SDK_INT < 26) return
    val nm = ctx.getSystemService(NotificationManager::class.java)
    val mesajlar = NotificationChannel(KANAL_MESAJ, Dil.sec(ctx, "Mesajlar", "Messages"), NotificationManager.IMPORTANCE_HIGH).apply {
      description = Dil.sec(ctx, "Yeni mesaj bildirimleri", "New message notifications")
      enableVibration(true)
    }
    val aramalar = NotificationChannel(KANAL_ARAMA, Dil.sec(ctx, "Aramalar", "Calls"), NotificationManager.IMPORTANCE_HIGH).apply {
      description = Dil.sec(ctx, "Gelen sesli aramalar", "Incoming voice calls")
      enableVibration(true)
      lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
      setSound(
        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
      )
    }
    nm.createNotificationChannels(listOf(mesajlar, aramalar))
  }

  /** Round-cornered letter avatar in the app's own colours (the room avatar image is not sent to native code). */
  /** Uygulamanın kendi renklerinde yuvarlak köşeli harf avatarı (oda avatar resmi yerel koda gönderilmiyor). */
  private fun harfAvatar(ad: String): Bitmap {
    val b = Bitmap.createBitmap(96, 96, Bitmap.Config.ARGB_8888)
    val c = Canvas(b)
    val boya = Paint(Paint.ANTI_ALIAS_FLAG)
    boya.color = ZEMIN
    c.drawRoundRect(0f, 0f, 96f, 96f, 24f, 24f, boya)
    boya.color = YAZI
    boya.textSize = 48f
    boya.textAlign = Paint.Align.CENTER
    val harf = ad.trim().firstOrNull { it.isLetterOrDigit() }?.uppercaseChar()?.toString() ?: "?"
    c.drawText(harf, 48f, 48f - (boya.descent() + boya.ascent()) / 2f, boya)
    return b
  }

  private fun odayiAcNiyeti(ctx: Context, odaId: String): PendingIntent {
    val niyet = Intent(ctx, MainActivity::class.java)
      .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      .putExtra(EK_ODA, odaId)
    return PendingIntent.getActivity(ctx, odaId.hashCode(), niyet, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun eylemNiyeti(ctx: Context, eylem: String, odaId: String, olayId: String, degisken: Boolean): PendingIntent {
    val niyet = Intent(ctx, BildirimEylemi::class.java).setAction(eylem).putExtra(EK_ODA, odaId).putExtra(EK_OLAY, olayId)
    // RemoteInput needs a MUTABLE PendingIntent (Android 12+), the plain action does not.
    // RemoteInput DEĞİŞTİRİLEBİLİR PendingIntent ister (Android 12+), düz eylem istemez.
    val bayrak = PendingIntent.FLAG_UPDATE_CURRENT or (if (degisken) PendingIntent.FLAG_MUTABLE else PendingIntent.FLAG_IMMUTABLE)
    return PendingIntent.getBroadcast(ctx, odaId.hashCode() * 31 + eylem.hashCode(), niyet, bayrak)
  }

  @JvmStatic
  @SuppressLint("MissingPermission")
  fun goster(ctx: Context, odaId: String, odaAd: String, gonderen: String, metin: String, zaman: Long, arama: Boolean, olayId: String) {
    if (!izinVar(ctx)) return
    val uygulama = ctx.applicationContext
    kanallariKur(uygulama)
    if (arama) {
      aramaBildirimi(uygulama, odaId, gonderen, olayId)
    } else {
      synchronized(odaAdlari) { odaAdlari[odaId] = odaAd }
      mesajEkle(odaId, Mesaj(gonderen, metin, zaman, olayId))
      mesajBildirimi(uygulama, odaId, odaAd)
    }
  }

  private fun mesajEkle(odaId: String, m: Mesaj) {
    synchronized(gecmis) {
      val liste = gecmis.getOrPut(odaId) { ArrayList() }
      liste.add(m)
      while (liste.size > 8) liste.removeAt(0)
    }
  }

  @SuppressLint("MissingPermission")
  private fun mesajBildirimi(ctx: Context, odaId: String, odaAd: String) {
    val liste = synchronized(gecmis) { ArrayList(gecmis[odaId] ?: emptyList<Mesaj>()) }
    if (liste.isEmpty()) return
    val ben = Person.Builder().setName(Dil.sec(ctx, "Sen", "You")).build()
    val stil = NotificationCompat.MessagingStyle(ben)
    // DM: the sender is the room name. Group: show the room as the conversation title.
    // DM: gönderen oda adıdır. Grup: odayı konuşma başlığı olarak göster.
    val grup = liste.any { it.gonderen != null && it.gonderen != odaAd }
    if (grup) {
      // Explicit calls: these builder-style setters return the style, so Kotlin does not treat them as property setters.
      // Açık çağrılar: bu kurucu tarzı ayarlayıcılar stili döndürür; Kotlin bunları özellik ayarlayıcısı saymaz.
      stil.setConversationTitle(odaAd)
      stil.setGroupConversation(true)
    }
    for (m in liste) {
      val kisi = m.gonderen?.let { Person.Builder().setName(it).setIcon(IconCompat.createWithBitmap(harfAvatar(it))).build() }
      stil.addMessage(NotificationCompat.MessagingStyle.Message(m.metin, m.zaman, kisi))
    }
    val son = liste.last()
    val yanit = NotificationCompat.Action.Builder(R.drawable.ic_bildirim, Dil.sec(ctx, "Yanıtla", "Reply"), eylemNiyeti(ctx, EYLEM_YANIT, odaId, son.olayId, true))
      .addRemoteInput(RemoteInput.Builder(YANIT_ANAHTARI).setLabel(Dil.sec(ctx, "Yanıtla", "Reply")).build())
      .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY)
      .setShowsUserInterface(false)
      .build()
    val okundu = NotificationCompat.Action.Builder(R.drawable.ic_bildirim, Dil.sec(ctx, "Okundu", "Mark as read"), eylemNiyeti(ctx, EYLEM_OKUNDU, odaId, son.olayId, false))
      .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_MARK_AS_READ)
      .setShowsUserInterface(false)
      .build()
    val bildirim = NotificationCompat.Builder(ctx, KANAL_MESAJ)
      .setSmallIcon(R.drawable.ic_bildirim)
      .setColor(VURGU)
      .setStyle(stil)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setWhen(son.zaman)
      .setContentIntent(odayiAcNiyeti(ctx, odaId))
      .setAutoCancel(true)
      .addAction(yanit)
      .addAction(okundu)
      .build()
    try {
      NotificationManagerCompat.from(ctx).notify(odaId.hashCode(), bildirim)
    } catch (e: SecurityException) {
      // Permission revoked while running: nothing to show. · İzin çalışırken geri alındı: gösterilecek bir şey yok.
    }
  }

  @SuppressLint("MissingPermission")
  private fun aramaBildirimi(ctx: Context, odaId: String, arayan: String, olayId: String) {
    val ac = odayiAcNiyeti(ctx, odaId)
    val yapi = NotificationCompat.Builder(ctx, KANAL_ARAMA)
      .setSmallIcon(R.drawable.ic_bildirim)
      .setColor(VURGU)
      .setContentTitle(arayan)
      .setContentText(Dil.sec(ctx, "Gelen sesli arama", "Incoming voice call"))
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setContentIntent(ac)
      .setAutoCancel(true)
      .setTimeoutAfter(45_000)
    // Full-screen intent (wakes the screen): Android 14+ may deny it, then it is a normal heads-up.
    // Tam ekran niyet (ekranı uyandırır): Android 14+ reddedebilir, o zaman normal açılır bildirim olur.
    val nm = ctx.getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT < 34 || nm.canUseFullScreenIntent()) yapi.setFullScreenIntent(ac, true)
    try {
      NotificationManagerCompat.from(ctx).notify(odaId.hashCode() + 1, yapi.build())
    } catch (e: SecurityException) {
      // see above · yukarıya bak
    }
  }

  /** Removes the room's notifications and forgets its history (room opened in the app, or "Okundu"). */
  /** Odanın bildirimlerini kaldırır ve geçmişini unutur (oda uygulamada açıldı ya da "Okundu"). */
  @JvmStatic
  fun temizle(ctx: Context, odaId: String) {
    synchronized(gecmis) { gecmis.remove(odaId) }
    synchronized(odaAdlari) { odaAdlari.remove(odaId) }
    val nm = NotificationManagerCompat.from(ctx)
    nm.cancel(odaId.hashCode())
    nm.cancel(odaId.hashCode() + 1)
  }

  /** Removes every notification and forgets all history (logout, account switch: none may be answered as the next account). */
  /** Bütün bildirimleri kaldırır ve tüm geçmişi unutur (çıkış, hesap değişimi: hiçbiri sonraki hesap adına yanıtlanmamalı). */
  @JvmStatic
  fun hepsiniTemizle(ctx: Context) {
    synchronized(gecmis) { gecmis.clear() }
    synchronized(odaAdlari) { odaAdlari.clear() }
    NotificationManagerCompat.from(ctx).cancelAll()
  }

  /** After an inline reply: add our own line so the card shows it and the reply spinner stops. */
  /** Satır içi yanıttan sonra: kendi satırımızı ekle; kart onu göstersin ve yanıt dönen simgesi dursun. */
  fun yanitEklendi(ctx: Context, odaId: String, metin: String) {
    val odaAd = synchronized(odaAdlari) { odaAdlari[odaId] } ?: ""
    mesajEkle(odaId, Mesaj(null, metin, System.currentTimeMillis(), ""))
    kanallariKur(ctx)
    mesajBildirimi(ctx.applicationContext, odaId, odaAd)
  }

  fun uygulamayiAc(ctx: Context, odaId: String) {
    val niyet = Intent(ctx, MainActivity::class.java)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      .putExtra(EK_ODA, odaId)
    ctx.startActivity(niyet)
  }
}

/**
 * The two JNI entry points INTO Rust (implemented in src-tauri/src/bildirim.rs as Java_dev_rubyyard_rubychat_YerelKoprusu_*).
 * Both return false when no logged-in session lives in this process; the caller then opens the app instead.
 * Rust'a giren iki JNI noktası (src-tauri/src/bildirim.rs'de Java_dev_rubyyard_rubychat_YerelKoprusu_* olarak yazıldı).
 * İkisi de bu süreçte giriş yapmış oturum yoksa false döner; çağıran o zaman uygulamayı açar.
 */
object YerelKoprusu {
  @JvmStatic external fun yanit(odaId: String, metin: String): Boolean

  @JvmStatic external fun okundu(odaId: String, olayId: String): Boolean
}

/** Receives the notification actions ("Yanıtla" with its text, "Okundu"). Declared in AndroidManifest.xml. */
/** Bildirim eylemlerini ("Yanıtla" metniyle, "Okundu") alır. AndroidManifest.xml'de bildirilir. */
class BildirimEylemi : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val odaId = intent.getStringExtra(Bildirimci.EK_ODA) ?: return
    val olayId = intent.getStringExtra(Bildirimci.EK_OLAY) ?: ""
    when (intent.action) {
      Bildirimci.EYLEM_YANIT -> {
        val metin = RemoteInput.getResultsFromIntent(intent)?.getCharSequence(Bildirimci.YANIT_ANAHTARI)?.toString()?.trim()
        if (metin.isNullOrEmpty()) return
        val iletildi = try {
          YerelKoprusu.yanit(odaId, metin)
        } catch (e: UnsatisfiedLinkError) {
          false // the native library is not loaded in this process · yerel kitaplık bu süreçte yüklü değil
        }
        if (iletildi) {
          Bildirimci.yanitEklendi(context, odaId, metin)
        } else {
          Bildirimci.uygulamayiAc(context, odaId)
        }
      }
      Bildirimci.EYLEM_OKUNDU -> {
        try {
          YerelKoprusu.okundu(odaId, olayId)
        } catch (e: UnsatisfiedLinkError) {
          // Nothing to mark without a live session; just clear the card. · Canlı oturum yoksa işaretlenecek bir şey yok; kartı kaldır.
        }
        Bildirimci.temizle(context, odaId)
      }
    }
  }
}
