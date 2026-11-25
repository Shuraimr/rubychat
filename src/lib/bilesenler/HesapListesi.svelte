<!--
  The other signed-in accounts as rows (one tap switches) and "Hesap ekle". The one in use is the profile card above, so it is not repeated.
  Girişli öteki hesaplar satır satır (tek dokunuş geçer) ve "Hesap ekle". Kullanımdaki hesap üstteki profil kartıdır; tekrar edilmez.
-->
<script lang="ts">
  import { hesaplariAl, type HesapKaydi } from "../api/komutlar";
  import { ec } from "../arama-ec/ec.svelte";
  import { arama } from "../durum/arama.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { t } from "../i18n";
  import Avatar from "./Avatar.svelte";
  import Ikon from "./Ikon.svelte";

  let digerleri = $state<HesapKaydi[]>([]);
  let gidilen = $state<string | null>(null);

  $effect(() => {
    void hesaplariAl()
      .then((h) => (digerleri = h.liste.filter((x) => x.id !== h.aktif)))
      .catch(() => {});
  });

  async function gec(id: string | null) {
    if (arama.etkin || ec.asama !== "bos") return bildirim.goster(t("hesaplar.aramaVar"), 4000, { tur: "hata" });
    gidilen = id ?? "+";
    try {
      await oturum.hesapDegistir(id);
    } catch {
      gidilen = null;
      bildirim.goster(t("hata.diger"), 4000, { tur: "hata" });
    }
  }
</script>

<div class="ay-kart">
  {#each digerleri as h (h.id)}
    <button class="ay-satir dugme" data-dalga onclick={() => gec(h.id)} disabled={oturum.mesgul}>
      <Avatar harf={(h.ad ?? h.kullaniciId).replace(/^@/, "").charAt(0).toUpperCase()} boyut={40} mxc={h.avatarMxc} />
      <span class="ay-metin"><strong>{h.ad ?? h.kullaniciId}</strong><span>{gidilen === h.id ? t("hesaplar.degisiyor") : h.kullaniciId}</span></span>
    </button>
  {/each}
  <button class="ay-satir dugme" data-dalga onclick={() => gec(null)} disabled={oturum.mesgul}>
    <span class="ay-simge" style:--r="var(--tas-zumrut)"><Ikon ad="kisi" boyut={20} /></span>
    <span class="ay-metin"><strong>{t("hesaplar.ekle")}</strong></span>
  </button>
</div>

<style>
  .ay-metin > * { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
