<!--
  Composer bar (design section 6): "+" opens the attach sheet, a text box that grows up to 6 lines (then scrolls), an emoji button inside it,
  and the send arrow ONLY while there is text (no microphone: voice messages do not exist yet). Enter sends, Shift+Enter inserts a newline.
  The unsent text is remembered per room as a draft ("Taslak:" in the chat list). While offline a yellow line says messages are queued.
  Yazma çubuğu (tasarım bölüm 6): "+" ek sayfasını açar, 6 satıra kadar büyüyen (sonra kayan) metin kutusu, içinde emoji düğmesi
  ve gönder oku YALNIZCA yazı varken (mikrofon yok: sesli mesaj henüz yok). Enter gönderir, Shift+Enter yeni satır ekler.
  Gönderilmemiş yazı oda başına taslak olarak hatırlanır (sohbet listesinde "Taslak:"). Çevrimdışıyken sarı bir satır mesajların sıraya alındığını söyler.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import MedyaAkisi from "../medya/MedyaAkisi.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { tercihler } from "../durum/tercihler.svelte";
  import { t } from "../i18n";
  import EkSayfasi, { type EkKaynagi } from "./EkSayfasi.svelte";
  import EmojiSayfasi from "./EmojiSayfasi.svelte";
  import Ikon from "./Ikon.svelte";

  let { odaId, sifreli, gonder }: { odaId: string; sifreli: boolean; gonder: (metin: string) => void } = $props();

  // The component is re-created per room ({#key}), so reading the room id once is intended. · Bileşen her odada yeniden kurulur ({#key}); oda kimliğini bir kez okumak bilerek yapılır.
  let deger = $state(untrack(() => odalar.taslaklar[odaId]) ?? "");
  let kutu: HTMLTextAreaElement | undefined = $state();
  let odakta = $state(false);
  let ekAcik = $state(false);
  let emojiAcik = $state(false);
  let medyaKaynak = $state<EkKaynagi | null>(null);
  let medyaKatmani = 0;

  const cevrimdisi = $derived(odalar.esitleme.durum === "cevrimdisi");
  const yazili = $derived(deger.trim().length > 0);

  /** Grow with the content up to 6 lines (6 x 20px + padding) · İçerikle birlikte 6 satıra (6 x 20px + dolgu) kadar büyür */
  function boyutla() {
    if (!kutu) return;
    kutu.style.height = "auto";
    kutu.style.height = `${Math.min(kutu.scrollHeight, 142)}px`;
  }
  $effect(() => {
    deger;
    boyutla();
  });

  // The draft can change from outside (user card › Bahset): mirror it into the open composer. · Taslak dışarıdan değişebilir (kullanıcı kartı › Bahset): açık yazma alanına yansıt.
  $effect(() => {
    const tas = odalar.taslaklar[odaId] ?? "";
    if (tas !== untrack(() => deger)) deger = tas;
  });

  function degisti() {
    odalar.taslakYaz(odaId, deger);
  }

  function yolla() {
    const metin = deger.trim();
    if (!metin) return;
    gonder(metin);
    deger = "";
    odalar.taslakYaz(odaId, "");
  }

  function tus(e: KeyboardEvent) {
    // isComposing: do not send while an IME (e.g. mobile keyboard) is still composing a word
    // isComposing: telefon klavyesi gibi bir giriş yöntemi hâlâ kelime oluşturuyorken gönderme
    // With "Enter ile gönder" off, Enter inserts a newline and only the arrow sends. · "Enter ile gönder" kapalıyken Enter satır ekler, yalnızca ok gönderir.
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && tercihler.d.enterGonder) {
      e.preventDefault();
      yolla();
    }
  }

  function emojiEkle(emoji: string) {
    const bas = kutu?.selectionStart ?? deger.length;
    const son = kutu?.selectionEnd ?? deger.length;
    deger = deger.slice(0, bas) + emoji + deger.slice(son);
    degisti();
  }

  // The media flow registers its OWN back-button layer (medya/katman.ts → gezinme stack); registering here too would need two presses.
  // Medya akışı KENDİ geri tuşu katmanını kaydeder (medya/katman.ts → gezinme yığını); burada da kaydetmek iki basış gerektirirdi.
  function medyaAc(k: EkKaynagi) {
    ekAcik = false;
    medyaKaynak = k;
  }
  function medyaKapat() {
    medyaKaynak = null;
  }
</script>

<div class="yazma" data-alt-cubuk>
  {#if cevrimdisi}
    <div class="cevrimdisi" role="status"><Ikon ad="saat" boyut={14} />{t("yazma.cevrimdisi")}</div>
  {/if}
  <div class="satir">
    <button class="simge-dugme" type="button" aria-label={t("oda.ekle")} onclick={() => (ekAcik = true)}><Ikon ad="artik" /></button>
    <div class="kutu" class:odakta>
      <textarea
        bind:this={kutu}
        bind:value={deger}
        oninput={degisti}
        onkeydown={tus}
        onfocus={() => (odakta = true)}
        onblur={() => (odakta = false)}
        rows="1"
        placeholder={sifreli ? t("oda.yaziSifreli") : t("oda.yazi")}
        aria-label={sifreli ? t("oda.yaziSifreli") : t("oda.yazi")}
      ></textarea>
      <button class="simge-dugme emoji" type="button" aria-label={t("emoji.baslik")} onclick={() => (emojiAcik = true)}><Ikon ad="emoji" boyut={22} /></button>
    </div>
    {#if yazili}
      <button class="simge-dugme vurgulu gonder" type="button" aria-label={t("oda.gonder")} onclick={yolla}><Ikon ad="yukari" /></button>
    {/if}
  </div>
</div>

{#if ekAcik}<EkSayfasi sec={medyaAc} onkapat={() => (ekAcik = false)} />{/if}
{#if emojiAcik}<EmojiSayfasi ekle={emojiEkle} onkapat={() => (emojiAcik = false)} />{/if}
{#if medyaKaynak}
  <div class="medya-kap"><MedyaAkisi {odaId} kaynak={medyaKaynak} onkapat={medyaKapat} /></div>
{/if}

<style>
  .yazma { flex: none; background: var(--yuzey-1); border-top: 1px solid var(--kenar-ince); padding-bottom: env(safe-area-inset-bottom); }
  .cevrimdisi { display: flex; align-items: center; gap: 6px; min-height: 28px; padding: 4px 16px 0; font-size: .75rem; font-weight: 500; color: var(--bekliyor); }
  .satir { display: flex; align-items: flex-end; gap: 4px; padding: 8px 8px 8px 4px; }
  .satir > .simge-dugme { margin-bottom: 0; }
  .kutu {
    flex: 1; min-width: 0; display: flex; align-items: flex-end; border-radius: 12px; background: var(--yuzey-2); border: 1px solid var(--kenar);
    transition: border-color var(--sure-hizli) var(--egri-cikis);
  }
  .kutu.odakta { border-color: var(--vurgu); box-shadow: 0 0 0 1px var(--vurgu); }
  textarea {
    flex: 1; min-width: 0; min-height: 42px; max-height: 142px; resize: none; background: none; border: 0; outline: none;
    padding: 10px 0 10px 14px; line-height: 20px; font-size: 1rem; color: var(--yazi);
  }
  textarea::placeholder { color: var(--yazi-2); }
  .emoji { color: var(--yazi-2); width: 44px; height: 42px; }
  .gonder { margin-left: 4px; }
  /* Full-screen media flow sits above everything in the room (toasts are higher) · Tam ekran medya akışı odadaki her şeyin üstünde durur (bildirimler daha üstte) */
  .medya-kap { position: fixed; inset: 0; z-index: 35; background: var(--zemin); }
</style>
