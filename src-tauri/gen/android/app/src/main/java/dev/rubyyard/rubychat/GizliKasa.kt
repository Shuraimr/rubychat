package dev.rubyyard.rubychat

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Secret storage for the Rust side (called with JNI from src-tauri/src/gizli_depo.rs).
 * An AES-256-GCM key lives in the Android Keystore (it cannot be exported); the secrets are encrypted with it and only the
 * ciphertext is written to the app's private files folder, so the session tokens never sit on disk in plain text.
 * Rust tarafı için gizli bilgi deposu (src-tauri/src/gizli_depo.rs'den JNI ile çağrılır).
 * AES-256-GCM anahtarı Android Keystore'da durur (dışarı alınamaz); gizli bilgiler onunla şifrelenir ve yalnızca şifreli
 * metin uygulamanın özel dosya klasörüne yazılır; yani oturum belirteçleri diskte düz metin olarak durmaz.
 *
 * Static (`@JvmStatic`) methods: JNI finds them by name and signature, so do not rename without changing gizli_depo.rs.
 * Static (`@JvmStatic`) metotlar: JNI bunları ad ve imzayla bulur; gizli_depo.rs'i değiştirmeden yeniden adlandırma.
 */
object GizliKasa {
  private const val ANAHTAR_AD = "rubychat_gizli_anahtar"
  private const val SAGLAYICI = "AndroidKeyStore"

  private fun anahtar(): SecretKey {
    val ks = KeyStore.getInstance(SAGLAYICI).apply { load(null) }
    (ks.getKey(ANAHTAR_AD, null) as? SecretKey)?.let { return it }
    val uretici = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, SAGLAYICI)
    uretici.init(
      KeyGenParameterSpec.Builder(ANAHTAR_AD, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build(),
    )
    return uretici.generateKey()
  }

  /** One file per secret name; names come from our own Rust code, still made file-safe. · Gizli ad başına bir dosya. */
  private fun dosya(ctx: Context, ad: String): File {
    val guvenli = ad.replace(Regex("[^A-Za-z0-9_-]"), "_")
    return File(File(ctx.filesDir, "gizli").apply { mkdirs() }, "$guvenli.bin")
  }

  @JvmStatic
  fun yaz(ctx: Context, ad: String, deger: String) {
    val sifre = Cipher.getInstance("AES/GCM/NoPadding")
    sifre.init(Cipher.ENCRYPT_MODE, anahtar()) // Keystore picks a fresh random IV · Keystore yeni rastgele IV seçer
    val sifreli = sifre.doFinal(deger.toByteArray(Charsets.UTF_8))
    // File = Base64(IV) "\n" Base64(ciphertext+tag) · Dosya = Base64(IV) "\n" Base64(şifreli metin+etiket)
    val icerik = Base64.encodeToString(sifre.iv, Base64.NO_WRAP) + "\n" + Base64.encodeToString(sifreli, Base64.NO_WRAP)
    // Write to a temp file then rename so a crash cannot leave a half-written secret.
    // Geçici dosyaya yazıp yeniden adlandır; çökme yarım yazılmış gizli bırakmasın.
    val hedef = dosya(ctx, ad)
    val gecici = File(hedef.parentFile, hedef.name + ".tmp")
    gecici.writeText(icerik)
    if (!gecici.renameTo(hedef)) {
      hedef.delete()
      check(gecici.renameTo(hedef)) { "gizli dosya yazılamadı" }
    }
  }

  /** null = nothing stored, or it cannot be decrypted any more (key lost, e.g. after a backup restore). */
  /** null = saklı bir şey yok ya da artık çözülemiyor (anahtar kayıp, ör. yedekten geri yüklemeden sonra). */
  @JvmStatic
  fun oku(ctx: Context, ad: String): String? {
    val f = dosya(ctx, ad)
    if (!f.exists()) return null
    return try {
      val (iv, sifreli) = f.readText().split("\n", limit = 2)
      val sifre = Cipher.getInstance("AES/GCM/NoPadding")
      sifre.init(Cipher.DECRYPT_MODE, anahtar(), GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)))
      String(sifre.doFinal(Base64.decode(sifreli, Base64.NO_WRAP)), Charsets.UTF_8)
    } catch (e: Exception) {
      null
    }
  }

  @JvmStatic
  fun sil(ctx: Context, ad: String) {
    dosya(ctx, ad).delete()
  }
}
