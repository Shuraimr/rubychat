<!--
  The user card (design 22/07), mounted ONCE in App.svelte and opened from anywhere with `kullaniciKartiAc(kullaniciId, odaId?)`:
  avatar, display name, copyable mxid, Mesaj (open / create the DM) · Bahset (adds @name to the room's draft). With a room context and
  power there, a moderation section appears: power level picker (Yönetici 100 / Moderatör 50 / Üye 0 / Özel…), Sessize al, Odadan çıkar,
  Yasakla. Buttons the user may not use are HIDDEN, not disabled. Verification state and shared rooms are not shown: the backend has no command for them yet.
  Kullanıcı kartı (tasarım 22/07), App.svelte'te BİR kez bağlanır ve her yerden `kullaniciKartiAc(kullaniciId, odaId?)` ile açılır:
  avatar, görünen ad, kopyalanabilir mxid, Mesaj (DM'i aç / kur) · Bahset (odanın taslağına @ad ekler). Oda bağlamı ve orada yetkim varsa bir
  yönetim bölümü çıkar: yetki seçici (Yönetici 100 / Moderatör 50 / Üye 0 / Özel…), Sessize al, Odadan çıkar, Yasakla.
  Kullanıcının kullanamayacağı düğmeler devre dışı değil GİZLİ. Doğrulama durumu ve ortak odalar gösterilmez: arka uçta henüz komut yok.
-->
<script lang="ts">
  import { dmAc } from "../api/komutlar";
  import { arama } from "../durum/arama.svelte";
  import { bildirim } from "../durum/bildirim.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { kullaniciKarti } from "../durum/kullaniciKarti.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { rolAdi, uyeler } from "../durum/uyeler.svelte";
  import { profilYerel } from "../durum/profilYerel.svelte";
  import { zeminUrl } from "../durum/zeminResmi";
  import { t } from "../i18n";
  import AltSayfa from "./AltSayfa.svelte";
  import Avatar from "./Avatar.svelte";
  import Ikon from "./Ikon.svelte";
  import YasaklaPenceresi from "./YasaklaPenceresi.svelte";

  const hedef = $derived(kullaniciKarti.hedef);
  const odaId = $derived(hedef?.odaId);
  const uye = $derived(hedef && odaId ? uyeler.uye(odaId, hedef.kullaniciId) : undefined);
  const yetki = $derived(odaId ? uyeler.al(odaId).yetki : null);
  const ben = $derived(hedef?.kullaniciId === oturum.ben?.kullaniciId);
  const ad = $derived(uye?.ad ?? hedef?.ad ?? (hedef?.kullaniciId ?? "").replace(/^@/, "").split(":")[0]);
  const avatarMxc = $derived(uye?.avatarMxc ?? hedef?.avatarMxc ?? null);

  // My own card shows my app-local banner (Matrix has none) · Kendi kartım uygulamaya yerel banner'ımı gösterir (Matrix'te yok)
  let bannerUrl = $state<string | null>(null);
  $effect(() => {
    if (ben && profilYerel.resim) void zeminUrl("banner").then((u) => (bannerUrl = u));
    else bannerUrl = null;
  });
  let yasakAcik = $state(false);
  let ozelAcik = $state(false);
  let ozelDeger = $state("");
  let mesgul = $state(false);

  // Load members + my permissions when a room context is given (cached per room). · Oda bağlamı varsa üyeleri + yetkilerimi yükle (oda başına önbellekli).
  $effect(() => {
    const id = odaId;
    if (id && !uyeler.al(id).yetki && !uyeler.al(id).yukleniyor) void uyeler.yukle(id);
  });

  function kapat() {
    kullaniciKarti.hedef = null;
    yasakAcik = false;
    ozelAcik = false;
  }

  async function kopyala() {
    try {
      await navigator.clipboard.writeText(hedef?.kullaniciId ?? "");
      bildirim.goster(t("kart.kopyalandi"), 2500, { tur: "tamam" });
    } catch {
      bildirim.goster(t("bildirim.kopyalanamadi"), 4000, { tur: "hata" });
    }
  }

  async function mesajGonder() {
    if (!hedef || mesgul) return;
    mesgul = true;
    try {
      const id = await dmAc(hedef.kullaniciId);
      kapat();
      gezinme.odaAc(id);
    } catch (e) {
      bildirim.goster(t("yasakla.hata", { mesaj: (e as { mesaj?: string }).mesaj ?? "" }), 5000, { tur: "hata" });
    } finally {
      mesgul = false;
    }
  }

  function bahset() {
    if (!hedef || !odaId) return;
    const eski = odalar.taslaklar[odaId] ?? "";
    odalar.taslakYaz(odaId, `${eski}${eski && !eski.endsWith(" ") ? " " : ""}@${ad} `);
    const id = odaId;
    kapat();
    gezinme.odaAc(id);
  }

  /** Run a moderation call; show the server's reason when it refuses. · Bir yönetim çağrısı yap; sunucu reddederse nedenini göster. */
  async function yap(f: () => Promise<unknown>) {
    mesgul = true;
    try {
      await f();
      bildirim.goster(t("kart.yapildi"), 2000, { tur: "tamam" });
    } catch (e) {
      bildirim.goster(t("yasakla.hata", { mesaj: (e as { mesaj?: string }).mesaj ?? "" }), 5000, { tur: "hata" });
    } finally {
      mesgul = false;
    }
  }

  const gucler = $derived(
    [
      { guc: 100, ad: t("kart.yonetici") },
      { guc: 50, ad: t("kart.moderator") },
      { guc: 0, ad: t("kart.uye") },
    ].filter((g) => !yetki || g.guc <= yetki.guc),
  );
  const ozelMi = $derived(!!uye && ![100, 50, 0].includes(uye.guc));
  function ozelUygula() {
    const n = Math.round(Number(ozelDeger));
    if (!hedef || !odaId || !Number.isFinite(n) || n > (yetki?.guc ?? 0)) return;
    void yap(() => uyeler.guc(odaId!, hedef!.kullaniciId, n));
    ozelAcik = false;
  }
</script>

{#if hedef}
  <AltSayfa baslik={ad} onkapat={kapat}>
    {#if ben}
      <div class="banner" style:--banner-renk={profilYerel.renk || undefined} aria-hidden="true">
        {#if bannerUrl}<img src={bannerUrl} alt="" draggable="false" />{/if}
      </div>
    {/if}
    <div class="kimlik" class:bannerli={ben}>
      <Avatar harf={ad.charAt(0).toUpperCase() || "#"} mxc={avatarMxc} boyut={72} />
      <div class="adlar">
        <strong>{ad}</strong>
        <button class="mxid" onclick={kopyala} aria-label={t("kart.kimlikKopyala")}>{hedef.kullaniciId}<Ikon ad="kopya" boyut={14} /></button>
        {#if uye && uye.uyelik !== "join"}<span class="cip {uye.uyelik === "ban" ? 'hata' : 'bekliyor'}">{uye.uyelik === "ban" ? t("kart.yasakli") : t("kart.davetli")}</span>{/if}
      </div>
    </div>

    {#if !ben}
      <div class="eylemler">
        <button class="eylem" onclick={mesajGonder} disabled={mesgul} data-dalga><Ikon ad="sohbet" boyut={22} />{t("kart.mesaj")}</button>
        {#if odaId}<button class="eylem" onclick={bahset} data-dalga><Ikon ad="kisi" boyut={22} />{t("kart.bahset")}</button>{/if}
      </div>
    {/if}

    {#if odaId && uye && !ben}
      {#if uyeler.gucDegistirebilir(odaId, uye)}
        <section>
          <h3>{t("kart.yetki")}</h3>
          <div class="liste" role="radiogroup" aria-label={t("kart.yetki")}>
            {#each gucler as g (g.guc)}
              <button class="secenek" class:secili={rolAdi(uye.guc) === (g.guc >= 100 ? "yonetici" : g.guc >= 50 ? "moderator" : "uye") && !ozelMi} role="radio" aria-checked={uye.guc === g.guc} disabled={mesgul} onclick={() => yap(() => uyeler.guc(odaId, hedef.kullaniciId, g.guc))}>
                <span>{g.ad}</span><span class="sayi">{g.guc}</span>
              </button>
            {/each}
            <button class="secenek" class:secili={ozelMi} role="radio" aria-checked={ozelMi} onclick={() => { ozelAcik = !ozelAcik; ozelDeger = String(uye.guc); }}>
              <span>{t("kart.ozel")}</span>{#if ozelMi}<span class="sayi">{uye.guc}</span>{/if}
            </button>
            {#if ozelAcik}
              <div class="ozel">
                <input type="number" inputmode="numeric" bind:value={ozelDeger} max={yetki?.guc} aria-label={t("kart.ozelAlan")} />
                <button class="buton tonlu" onclick={ozelUygula}>{t("kart.uygula")}</button>
              </div>
            {/if}
          </div>
        </section>
        <button class="satir" disabled={mesgul} onclick={() => yap(() => uyeler.guc(odaId, hedef.kullaniciId, uyeler.susturulmus(odaId, uye) ? 0 : Math.max(-1, (yetki?.yazmaEsigi ?? 0) - 1)))}>
          {uyeler.susturulmus(odaId, uye) ? t("kart.sessizden") : t("kart.sessize")}
        </button>
      {/if}
      {#if uyeler.atabilir(odaId, uye)}
        <button class="satir kirmizi" disabled={mesgul} onclick={() => yap(async () => { await uyeler.cikar(odaId, hedef.kullaniciId); kapat(); })}>{t("kart.cikar")}</button>
      {/if}
      {#if uyeler.yasaklayabilir(odaId, uye)}
        <button class="satir kirmizi" onclick={() => (yasakAcik = true)}>{t("kart.yasakla")}</button>
      {:else if uyeler.yasagiKaldirabilir(odaId, uye)}
        <button class="satir" disabled={mesgul} onclick={() => yap(() => uyeler.yasagiKaldir(odaId, hedef.kullaniciId))}>{t("kart.yasagiKaldir")}</button>
      {/if}
    {/if}
  </AltSayfa>
  {#if yasakAcik && odaId}
    <YasaklaPenceresi {odaId} kullaniciId={hedef.kullaniciId} {ad} {avatarMxc} onkapat={() => (yasakAcik = false)} onbitti={kapat} />
  {/if}
{/if}

<style>
  .banner { position: relative; height: 5rem; margin: -.25rem 0 0; border-radius: 1rem; overflow: hidden; background: color-mix(in srgb, var(--banner-renk, var(--vurgu)) 45%, var(--yuzey-2)); box-shadow: inset 0 1px 0 rgb(255 255 255 / .08); }
  .banner img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .kimlik.bannerli { margin-top: -2.25rem; padding: 0 .75rem; position: relative; }
  .kimlik.bannerli :global(.avatar) { box-shadow: 0 0 0 3px var(--yuzey-1); }
  .kimlik { display: flex; align-items: center; gap: 16px; }
  .adlar { display: grid; gap: 4px; min-width: 0; justify-items: start; }
  .adlar strong { font-family: var(--baslik-tipi); font-size: 1.25rem; line-height: 1.3; }
  .mxid { min-height: 32px; display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono-tipi); font-size: .8125rem; color: var(--yazi-2); max-width: 100%; overflow-wrap: anywhere; text-align: left; }
  .eylemler { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 12px; }
  .eylem { min-height: 72px; border-radius: 16px; background: var(--yuzey-2); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: .8125rem; font-weight: 600; }
  h3 { font-size: .75rem; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--yazi-2); margin-bottom: 8px; }
  .liste { display: grid; gap: 8px; }
  .secenek { min-height: 48px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; border-radius: 14px; background: var(--yuzey-2); text-align: left; }
  .secenek.secili { background: color-mix(in srgb, var(--vurgu) 18%, var(--zemin)); color: var(--vurgu); font-weight: 600; }
  .sayi { color: var(--yazi-2); font-size: .875rem; }
  .ozel { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
  .ozel input { min-height: 48px; padding: 0 14px; border-radius: 14px; background: var(--yuzey-2); border: 1px solid var(--kenar); outline: none; color: var(--yazi); }
  .ozel .buton { width: auto; min-height: 3rem; }
  .satir { min-height: 48px; text-align: left; padding: 0 4px; font-size: 1rem; font-weight: 500; }
  .kirmizi { color: var(--hata); font-weight: 600; }
</style>
