package dev.rubyyard.rubychat

import android.content.Context
import java.util.Locale

/**
 * App language for native texts. The web UI stores its choice here ("tr" / "en"); without a choice the phone's language decides.
 * Yerel metinler için uygulama dili. Web arayüzü seçimini buraya yazar ("tr" / "en"); seçim yoksa telefonun dili belirler.
 */
object Dil {
  private const val DEPO = "rubychat"
  private const val ANAHTAR = "dil"

  /** True when texts should be English. · Metinler İngilizce olmalı mı. */
  fun en(ctx: Context): Boolean =
    when (ctx.getSharedPreferences(DEPO, Context.MODE_PRIVATE).getString(ANAHTAR, null)) {
      "en" -> true
      "tr" -> false
      else -> !Locale.getDefault().language.equals("tr", ignoreCase = true)
    }

  /** Pick the Turkish or English text. · Türkçe ya da İngilizce metni seç. */
  fun sec(ctx: Context, tr: String, en: String): String = if (en(ctx)) en else tr

  /** Remember the choice ("tr", "en" or null = follow the system). · Seçimi sakla ("tr", "en" ya da null = sistemi izle). */
  fun yaz(ctx: Context, dil: String?) {
    ctx.getSharedPreferences(DEPO, Context.MODE_PRIVATE).edit().apply { if (dil == "tr" || dil == "en") putString(ANAHTAR, dil) else remove(ANAHTAR) }.apply()
  }
}
