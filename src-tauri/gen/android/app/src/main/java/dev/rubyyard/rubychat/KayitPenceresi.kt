package dev.rubyyard.rubychat

import android.annotation.SuppressLint
import android.app.Dialog
import android.graphics.Color
import android.net.Uri
import android.util.TypedValue
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/**
 * In-app sign-up page (src-tauri/src/kayit_penceresi.rs explains why): a full-screen dialog with the server's account page in a
 * WebView, so the person never leaves the app. The first jump to `/login` on the same host becomes `/register`. The UI closes it when
 * the login is approved ([kapat]); closing it by hand tells the UI (`rubychat-kayit-kapandi`).
 * Uygulama içi kayıt sayfası (nedeni src-tauri/src/kayit_penceresi.rs'de): sunucunun hesap sayfası WebView'da, tam ekran bir pencerede;
 * kişi uygulamadan hiç çıkmaz. Aynı sunucuda `/login`'e ilk sıçrayış `/register` olur. Giriş onaylanınca arayüz kapatır ([kapat]);
 * elle kapatılınca arayüze haber verilir (`rubychat-kayit-kapandi`).
 */
object KayitPenceresi {
  /**
   * One open dialog with its own "the UI closed it" flag: Dialog.dismiss() calls the listener later (main looper), so a flag shared
   * by all dialogs would let an old dialog's listener fire a false "closed" event for the new one.
   * Açık bir pencere ve ona özel "arayüz kapattı" bayrağı: Dialog.dismiss() dinleyiciyi sonra (ana looper) çağırır; tüm pencerelerin
   * paylaştığı bir bayrak eski pencerenin dinleyicisinin yeni pencere için sahte "kapandı" olayı yollamasına yol açardı.
   */
  private class Acik(val dialog: Dialog) {
    var arayuzKapatti = false
  }
  private var aktif: Acik? = null

  /** `/login?…` on the same host → `/register?…` · Aynı sunucuda `/login?…` → `/register?…` */
  private fun kaydaCevir(adres: Uri, ana: String): Uri? =
    if (adres.host == ana && adres.path?.trimEnd('/') == "/login") adres.buildUpon().path("/register").build() else null

  @SuppressLint("SetJavaScriptEnabled")
  /** False when the address is not a usable https one (nothing opens; the UI shows the error). · Adres kullanılabilir bir https değilse false (hiçbir şey açılmaz; arayüz hatayı gösterir). */
  fun ac(etkinlik: MainActivity, url: String, baslik: String, zemin: String, yazi: String): Boolean {
    val adres = Uri.parse(url)
    if (adres.scheme != "https") return false
    val ana = adres.host ?: return false
    etkinlik.runOnUiThread {
      // The old dialog is closed by us: its own listener must stay silent. · Eski pencereyi biz kapatırız: kendi dinleyicisi sessiz kalmalı.
      aktif?.let {
        it.arayuzKapatti = true
        it.dialog.dismiss()
      }
      aktif = null
      val zeminRenk = runCatching { Color.parseColor(zemin) }.getOrDefault(Color.BLACK)
      val yaziRenk = runCatching { Color.parseColor(yazi) }.getOrDefault(Color.WHITE)
      val dp = { d: Int -> TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, d.toFloat(), etkinlik.resources.displayMetrics).toInt() }

      val web = WebView(etkinlik)
      web.settings.javaScriptEnabled = true
      web.settings.domStorageEnabled = true
      CookieManager.getInstance().setAcceptCookie(true)
      var cevrildi = false
      web.webViewClient = object : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, istek: WebResourceRequest): Boolean {
          val u = istek.url
          // Only https stays here; anything else (mailto:, intent:) is not followed. · Burada yalnızca https kalır; gerisi izlenmez.
          if (u.scheme != "https") return true
          if (!cevrildi) {
            kaydaCevir(u, ana)?.let {
              cevrildi = true
              view.loadUrl(it.toString())
              return true
            }
          }
          return false
        }
      }

      val kapatDugmesi = ImageButton(etkinlik).apply {
        setImageResource(android.R.drawable.ic_menu_close_clear_cancel)
        setColorFilter(yaziRenk)
        setBackgroundColor(Color.TRANSPARENT)
        contentDescription = Dil.sec(etkinlik, "Kapat", "Close")
        layoutParams = LinearLayout.LayoutParams(dp(48), dp(48))
      }
      val baslikYazi = TextView(etkinlik).apply {
        text = baslik
        setTextColor(yaziRenk)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
        gravity = Gravity.CENTER_VERTICAL
        layoutParams = LinearLayout.LayoutParams(0, dp(48), 1f)
      }
      val ust = LinearLayout(etkinlik).apply {
        orientation = LinearLayout.HORIZONTAL
        setPadding(dp(4), dp(4), dp(16), dp(4))
        addView(kapatDugmesi)
        addView(baslikYazi)
      }
      val kok = LinearLayout(etkinlik).apply {
        orientation = LinearLayout.VERTICAL
        setBackgroundColor(zeminRenk)
        addView(ust, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        addView(web, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
      }
      // Edge to edge: keep the bar below the status bar and the page above the keyboard / gesture bar.
      // Kenardan kenara: çubuk durum çubuğunun altında, sayfa klavyenin / hareket çubuğunun üstünde kalsın.
      ViewCompat.setOnApplyWindowInsetsListener(kok) { v, i ->
        val s = i.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
        v.setPadding(s.left, s.top, s.right, s.bottom)
        WindowInsetsCompat.CONSUMED
      }

      val d = Dialog(etkinlik, android.R.style.Theme_DeviceDefault_NoActionBar)
      d.setContentView(kok, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
      d.window?.let { w ->
        w.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        w.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        androidx.core.view.WindowCompat.setDecorFitsSystemWindows(w, false)
        w.statusBarColor = Color.TRANSPARENT
        w.navigationBarColor = Color.TRANSPARENT
      }
      // Back goes back inside the page first. · Geri önce sayfanın içinde geri gider.
      d.setOnKeyListener { _, kod, olay ->
        if (kod == android.view.KeyEvent.KEYCODE_BACK && olay.action == android.view.KeyEvent.ACTION_UP && web.canGoBack()) {
          web.goBack(); true
        } else false
      }
      kapatDugmesi.setOnClickListener { d.dismiss() }
      val bu = Acik(d)
      d.setOnDismissListener {
        // Detach before destroy (the WebView docs ask for it). · Yok etmeden önce ayır (WebView belgeleri bunu ister).
        kok.removeView(web)
        web.destroy()
        if (aktif === bu) aktif = null
        if (!bu.arayuzKapatti) etkinlik.olayGonder("rubychat-kayit-kapandi")
      }
      aktif = bu
      d.show()
      web.loadUrl(url)
    }
    return true
  }

  fun kapat(etkinlik: MainActivity) {
    etkinlik.runOnUiThread {
      aktif?.let {
        it.arayuzKapatti = true
        it.dialog.dismiss()
      }
      aktif = null
    }
  }
}
