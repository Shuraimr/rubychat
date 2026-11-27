<!--
  "Yeni sohbet" sheet. Type a name, a username or a full Matrix id: the server's user directory is searched as you type
  (`kullanici_ara`), a full id (or "name" → @name:my-server) is offered as the first row, and with an empty field the people you
  already talk to are listed. A tap opens the encrypted DM (the existing one when there is one). Backend: `dm_ac`.
  "Yeni sohbet" sayfası. Ad, kullanıcı adı ya da tam Matrix kimliği yaz: yazdıkça sunucunun kullanıcı dizini aranır
  (`kullanici_ara`), tam kimlik (ya da "ad" → @ad:benim-sunucum) ilk satırda önerilir; alan boşken zaten konuştuğun kişiler listelenir.
  Dokununca şifreli DM açılır (varsa mevcut olan). Arka uç: `dm_ac`.
-->
<script lang="ts">
  import { dmAc, kullaniciAra } from "../api/komutlar";
  import type { BulunanKisi } from "../api/tipler";
  import { bildirim } from "../durum/bildirim.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { t, type Anahtar } from "../i18n";
  import AltSayfa from "./AltSayfa.svelte";
  import Avatar from "./Avatar.svelte";
  import Ikon from "./Ikon.svelte";
  import { duzen } from "../durum/duzen.svelte";

  // `kisayol`: on wide screens there is no dock "Yeni" menu, so the sheet carries group and space creation. Discover lives on the side rail;
  // only the compact layout (room strip instead of the rail) keeps it here, so it is never in two places and never missing.
  // `kisayol`: geniş ekranda dock'taki "Yeni" menüsü yok; sayfa grup ve alan oluşturmayı taşır. Keşfet yan raydadır; yalnızca kompakt
  // düzen (ray yerine oda şeridi) onu burada tutar: hiçbir zaman iki yerde olmaz, hiçbir zaman da kaybolmaz.
  let { onkapat: ustKapat, kisayol }: { onkapat: () => void; kisayol?: (s: "kesfet" | "grup" | "alan") => void } = $props();
  const kisayollar = $derived(
    (duzen.kompakt ? [["kesfet", "pusula"], ["grup", "sohbet"], ["alan", "izgara"]] : [["grup", "sohbet"], ["alan", "izgara"]]) as ["kesfet" | "grup" | "alan", "pusula" | "sohbet" | "izgara"][],
  );
  let sorgu = $state("");
  let sonuclar = $state<BulunanKisi[]>([]);
  let araniyor = $state(false);
  let mesgul = $state<string | null>(null);
  // Set when the sheet closes (by us or by back / scrim): a late answer must not pull the person into a room afterwards.
  // Sayfa kapanınca (bizden ya da geri / perdeden) kurulur: geç gelen yanıt kişiyi sonradan bir odaya çekmemeli.
  let kapandi = false;
  const onkapat = () => {
    kapandi = true;
    ustKapat();
  };

  const benimSunucum = $derived(oturum.ben?.kullaniciId.split(":").slice(1).join(":") ?? "");
  // A typed id, or a bare username on my own server. · Yazılan kimlik ya da kendi sunucumda düz kullanıcı adı.
  const dogrudan = $derived.by(() => {
    const s = sorgu.trim();
    let aday: string | null = null;
    if (/^@[^:\s]+:[^\s]+$/.test(s)) aday = s;
    else if (/^@?[a-z0-9._=\-/+]+$/i.test(s) && benimSunucum) aday = `@${s.replace(/^@/, "").toLowerCase()}:${benimSunucum}`;
    // Never offer a chat with yourself. · Kendinle sohbet asla önerilmez.
    if (aday && aday.toLowerCase() === oturum.ben?.kullaniciId.toLowerCase()) return null;
    return aday;
  });
  const sonKisiler = $derived(odalar.liste.filter((o) => o.dm && !o.davet).slice(0, 8));
  const listede = $derived(new Set(sonuclar.map((k) => k.kullaniciId.toLowerCase())));

  let tur = 0;
  $effect(() => {
    const s = sorgu.trim();
    if (s.length < 2) {
      // Invalidates a search still on the network, or its late answer would refill the cleared box. · Ağdaki aramayı geçersiz kılar; yoksa geç yanıtı temizlenen kutuyu yeniden doldururdu.
      ++tur;
      sonuclar = [];
      araniyor = false;
      return;
    }
    araniyor = true;
    const bu = ++tur;
    const zamanlayici = setTimeout(async () => {
      try {
        const r = await kullaniciAra(s);
        if (bu === tur) sonuclar = r.filter((k) => k.kullaniciId !== oturum.ben?.kullaniciId);
      } catch {
        if (bu === tur) sonuclar = [];
      } finally {
        if (bu === tur) araniyor = false;
      }
    }, 300);
    return () => clearTimeout(zamanlayici);
  });

  async function baslat(kimlik: string) {
    if (mesgul) return;
    mesgul = kimlik;
    try {
      const id = await dmAc(kimlik);
      if (kapandi) return;
      onkapat();
      gezinme.odaAc(id);
    } catch (err) {
      bildirim.goster(t(`hata.${(err as { tur: string }).tur}` as Anahtar), 4000, { tur: "hata" });
    } finally {
      mesgul = null;
    }
  }

  function odaAc(id: string) {
    onkapat();
    gezinme.odaAc(id);
  }

  function gonder(e: SubmitEvent) {
    e.preventDefault();
    const ilk = dogrudan ?? sonuclar[0]?.kullaniciId;
    if (ilk) void baslat(ilk);
  }
</script>

<AltSayfa baslik={t("yeniSohbet.baslik")} {onkapat}>
  <form class="form" onsubmit={gonder}>
    <label class="alan-kutu ara">
      <Ikon ad="ara" boyut={20} />
      <input bind:value={sorgu} placeholder={t("yeniSohbet.araYer")} aria-label={t("yeniSohbet.araYer")} autocapitalize="off" autocomplete="off" spellcheck="false" enterkeyhint="go" />
      {#if araniyor}<span class="yuklenme"></span>{/if}
    </label>

    {#if kisayol && !sorgu.trim()}
      <ul class="liste">
        {#each kisayollar as [id, ikon] (id)}
          <li><button class="satir" type="button" onclick={() => kisayol(id)}><span class="yer"><Ikon ad={ikon} boyut={22} /></span><span class="metin"><b>{t(`dock.${id}`)}</b></span></button></li>
        {/each}
      </ul>
    {/if}

    <ul class="liste">
      {#if dogrudan && !listede.has(dogrudan.toLowerCase())}
        <li>
          <button class="satir" type="button" disabled={!!mesgul} onclick={() => void baslat(dogrudan!)}>
            <span class="yer"><Ikon ad="kisi" boyut={22} /></span>
            <span class="metin"><b>{dogrudan}</b><small>{t("yeniSohbet.dogrudan")}</small></span>
            {#if mesgul === dogrudan}<span class="yuklenme"></span>{/if}
          </button>
        </li>
      {/if}
      {#each sonuclar as k (k.kullaniciId)}
        <li>
          <button class="satir" type="button" disabled={!!mesgul} onclick={() => void baslat(k.kullaniciId)}>
            <Avatar harf={(k.ad ?? k.kullaniciId.slice(1)).slice(0, 1).toUpperCase()} mxc={k.avatarMxc} boyut={40} />
            <span class="metin"><b>{k.ad ?? k.kullaniciId}</b>{#if k.ad}<small>{k.kullaniciId}</small>{/if}</span>
            {#if mesgul === k.kullaniciId}<span class="yuklenme"></span>{/if}
          </button>
        </li>
      {/each}
      {#if sorgu.trim().length >= 2 && !araniyor && sonuclar.length === 0 && !dogrudan}
        <li class="bos">{t("yeniSohbet.yok")}</li>
      {/if}
      {#if !sorgu.trim() && sonKisiler.length}
        <li class="baslik">{t("yeniSohbet.son")}</li>
        {#each sonKisiler as o (o.id)}
          <li>
            <button class="satir" type="button" onclick={() => odaAc(o.id)}>
              <Avatar harf={o.avatarHarf} mxc={o.avatarMxc} boyut={40} />
              <span class="metin"><b>{o.ad}</b></span>
            </button>
          </li>
        {/each}
      {/if}
    </ul>
    <p class="alt">{t("yeniSohbet.alt")}</p>
  </form>
</AltSayfa>

<style>
  .form { display: grid; gap: 12px; }
  .ara { display: flex; align-items: center; gap: 10px; padding: 0 14px; color: var(--yazi-2); }
  .ara input { flex: 1; min-width: 0; height: 48px; background: none; border: 0; outline: none; color: var(--yazi); font-size: 1rem; }
  .liste { list-style: none; margin: 0 -8px; padding: 0; display: grid; gap: 2px; }
  .satir { width: 100%; min-height: 56px; display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 16px; text-align: left; color: var(--yazi); }
  .satir:hover, .satir:focus-visible { background: var(--yuzey-2); }
  .yer { width: 40px; height: 40px; border-radius: 14px; display: grid; place-items: center; background: var(--yuzey-2); color: var(--vurgu); flex: none; }
  .metin { flex: 1; min-width: 0; display: grid; }
  .metin b, .metin small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .metin b { font-weight: 600; font-size: .9375rem; }
  .metin small { font-size: .8125rem; color: var(--yazi-2); }
  .baslik { padding: 12px 8px 4px; font-size: .8125rem; font-weight: 600; color: var(--yazi-2); }
  .bos { padding: 16px 8px; font-size: .875rem; color: var(--yazi-2); text-align: center; }
  .alt { font-size: .8125rem; color: var(--yazi-2); }
</style>
