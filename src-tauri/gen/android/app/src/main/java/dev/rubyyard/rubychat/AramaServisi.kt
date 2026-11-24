package dev.rubyyard.rubychat

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat

/**
 * Foreground service (type "microphone") that lives while a call runs.
 * Why: since Android 14 the system stops microphone capture of an app that is in the background or has its screen off unless a
 * microphone foreground service is running. The ongoing notification "Arama sürüyor" also carries a hang-up action. A partial wake lock
 * keeps the CPU awake so the WebRTC connection does not stall with the screen off.
 * Bir arama sürerken yaşayan ön plan servisi (tür "microphone").
 * Neden: Android 14'ten beri sistem, arka planda ya da ekranı kapalı uygulamanın mikrofon yakalamasını, çalışan bir mikrofon ön plan
 * servisi yoksa durdurur. Kalıcı "Arama sürüyor" bildirimi ayrıca kapatma eylemi taşır. Kısmi wake lock, ekran kapalıyken WebRTC
 * bağlantısı takılmasın diye işlemciyi uyanık tutar.
 * Started only after RECORD_AUDIO is granted (Android 14 throws otherwise): see [SesKoprusu.aramaServisi].
 * Yalnızca RECORD_AUDIO verildikten sonra başlatılır (Android 14 yoksa hata atar): bkz. [SesKoprusu.aramaServisi].
 */
class AramaServisi : Service() {
  private var kilit: PowerManager.WakeLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val ad = intent?.getStringExtra(EK_AD) ?: ""
    kanalKur()
    val kapat = PendingIntent.getBroadcast(
      this, 0, Intent(this, AramaKapatAlici::class.java).setAction(EYLEM_KAPAT),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val ac = PendingIntent.getActivity(
      this, 0, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val bildirim: Notification = NotificationCompat.Builder(this, KANAL)
      .setSmallIcon(R.drawable.ic_bildirim)
      .setContentTitle(Dil.sec(this, "Arama sürüyor", "Call in progress"))
      .setContentText(ad)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(ac)
      .addAction(0, Dil.sec(this, "Kapat", "End"), kapat)
      .build()
    if (Build.VERSION.SDK_INT >= 29) startForeground(KIMLIK, bildirim, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
    else startForeground(KIMLIK, bildirim)
    if (kilit == null) {
      kilit = (getSystemService(Context.POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "rubychat:arama").apply { acquire(4 * 60 * 60 * 1000L) }
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    kilit?.let { if (it.isHeld) it.release() }
    kilit = null
    super.onDestroy()
  }

  private fun kanalKur() {
    if (Build.VERSION.SDK_INT < 26) return
    val nm = getSystemService(NotificationManager::class.java)
    if (nm.getNotificationChannel(KANAL) == null) {
      nm.createNotificationChannel(NotificationChannel(KANAL, Dil.sec(this, "Süren arama", "Ongoing call"), NotificationManager.IMPORTANCE_LOW))
    }
  }

  companion object {
    private const val KANAL = "arama_surer"
    private const val KIMLIK = 7001
    const val EK_AD = "ad"
    const val EYLEM_KAPAT = "dev.rubyyard.rubychat.ARAMA_KAPAT"
  }
}

/** "Kapat" on the ongoing-call notification: tells the web UI to hang up (the call itself lives in the webview). · Süren arama bildirimindeki "Kapat": web arayüzüne kapatmasını söyler (arama webview'de yaşar). */
class AramaKapatAlici : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    MainActivity.aktif?.aramaKapatIstegi()
  }
}
