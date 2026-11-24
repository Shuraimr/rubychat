package dev.rubyyard.rubychat

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Keeps the app process (and so the Matrix sync) alive in the background, so messages are notified while another app is open or the screen
 * is off. rubychat has no push server (FCM), therefore a foreground service with a silent, minimised notification is the way to do it.
 * It starts with the app, not at boot: the sync lives in the app's own process, so swiping the app away from recents ends it.
 * Uygulama sürecini (dolayısıyla Matrix eşitlemesini) arka planda canlı tutar; başka uygulama açıkken ya da ekran kapalıyken mesajlar
 * bildirilir. rubychat'in anlık bildirim sunucusu (FCM) yok; bunun yolu sessiz, küçültülmüş bildirimli bir ön plan servisidir.
 * Açılışta değil uygulamayla başlar: eşitleme uygulamanın kendi sürecinde yaşar; son uygulamalardan kaydırıp atmak onu bitirir.
 */
class BaglantiServisi : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (Build.VERSION.SDK_INT >= 26) {
      val nm = getSystemService(NotificationManager::class.java)
      if (nm.getNotificationChannel(KANAL) == null) {
        nm.createNotificationChannel(NotificationChannel(KANAL, Dil.sec(this, "Arka plan bağlantısı", "Background connection"), NotificationManager.IMPORTANCE_MIN).apply { setShowBadge(false) })
      }
    }
    val ac = PendingIntent.getActivity(
      this, 1, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val bildirim = NotificationCompat.Builder(this, KANAL)
      .setSmallIcon(R.drawable.ic_bildirim)
      .setContentTitle(Dil.sec(this, "Yeni mesajlar dinleniyor", "Listening for new messages"))
      .setPriority(NotificationCompat.PRIORITY_MIN)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setOngoing(true)
      .setSilent(true)
      .setContentIntent(ac)
      .build()
    try {
      if (Build.VERSION.SDK_INT >= 34) startForeground(KIMLIK, bildirim, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
      else startForeground(KIMLIK, bildirim)
    } catch (_: Exception) {
      stopSelf()
    }
    return START_NOT_STICKY
  }

  // The activity (and the sync with it) is gone: do not leave an empty notification behind. · Etkinlik (ve eşitleme) gitti: geride boş bildirim bırakma.
  override fun onTaskRemoved(rootIntent: Intent?) {
    stopSelf()
    super.onTaskRemoved(rootIntent)
  }

  companion object {
    private const val KANAL = "baglanti"
    private const val KIMLIK = 7002
  }
}
