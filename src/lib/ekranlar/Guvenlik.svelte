<!--
  Ben › Güvenlik (design section 12d): device verification, recovery key, key backup and where the secrets are kept, as one status card.
  Ben › Güvenlik (tasarım bölüm 12d): cihaz doğrulama, kurtarma anahtarı, anahtar yedeği ve gizli bilgilerin yeri; tek durum kartı olarak.
-->
<script lang="ts">
  import Baslik from "../bilesenler/Baslik.svelte";
  import GuvenlikSatiri from "../bilesenler/GuvenlikSatiri.svelte";
  import { gezinme } from "../durum/gezinme.svelte";
  import { oturum } from "../durum/oturum.svelte";
  import { sifreleme } from "../durum/sifreleme.svelte";
  import { t } from "../i18n";

  const g = $derived(sifreleme.durum);
</script>

<div class="sayfa">
  <Baslik baslik={t("guvenlik.baslik")} geri={() => gezinme.benAltKapat()} />
  <div class="icerik">
    <div class="kart satirlar">
      {#if g}
        <GuvenlikSatiri
          baslik={t("guvenlik.cihazDogrulama")}
          durum={g.cihazDogrulandi ? t("durum.dogrulandi") : g.caprazImza === "bekliyor" ? t("durum.bekliyor") : t("durum.dogrulanmadi")}
          ton={g.cihazDogrulandi ? "tamam" : g.caprazImza === "bekliyor" ? "notr" : "bekliyor"}
          eylem={!g.cihazDogrulandi && g.caprazImza !== "bekliyor" ? t("eylem.dogrula") : undefined}
          onEylem={() => sifreleme.ac("kurulum")}
        />
        <GuvenlikSatiri
          baslik={t("guvenlik.kurtarma")}
          durum={g.kurtarma === "hazir" ? t("durum.hazir") : g.kurtarma === "eksik" ? t("durum.gerekli") : g.kurtarma === "kapali" ? t("durum.kurulmadi") : t("durum.bekliyor")}
          ton={g.kurtarma === "hazir" ? "tamam" : g.kurtarma === "bilinmiyor" ? "notr" : "bekliyor"}
          eylem={g.kurtarma === "kapali" ? t("eylem.olustur") : g.kurtarma === "eksik" ? t("eylem.anahtariGir") : undefined}
          onEylem={() => (g.kurtarma === "kapali" ? sifreleme.ac("kurtarma-olustur") : sifreleme.ac("kurtarma-gir"))}
          eylemKilitli={g.kurtarma === "kapali" && g.caprazImza !== "hazir"}
        />
        <GuvenlikSatiri
          baslik={t("guvenlik.yedek")}
          durum={g.yedek === "acik" ? t("durum.acik") : g.yedek === "yukleniyor" ? t("durum.indiriliyor") : t("durum.kapali")}
          ton={g.yedek === "acik" ? "tamam" : g.yedek === "yukleniyor" ? "bekliyor" : "notr"}
        />
      {:else}
        <GuvenlikSatiri baslik={t("guvenlik.cihazDogrulama")} durum={t("durum.bekliyor")} ton="notr" />
      {/if}
      <GuvenlikSatiri
        baslik={t("guvenlik.gizliDepo")}
        durum={t(`guvenlik.gizli.${oturum.ben?.gizliDepo ?? "dosya"}`)}
        ton={oturum.ben?.gizliDepo === "dosya" ? "bekliyor" : "tamam"}
      />
    </div>
    {#if oturum.ben?.gizliDepo === "dosya"}<p class="not">{t("guvenlik.gizliDosyaNotu")}</p>{/if}
  </div>
</div>

<style>
  .sayfa { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--zemin); }
  .icerik { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 8px 16px 24px; display: grid; gap: 12px; align-content: start; }
  .kart { background: var(--yuzey-1); border: 1px solid var(--kenar-ince); border-radius: 16px; padding: 4px 16px; display: grid; }
  /* Rows are rendered by a child component, so the selector must reach into it with :global. · Satırları alt bileşen çizer; seçici :global ile içeri uzanmalı. */
  .satirlar > :global(*) { padding: 14px 0; border-bottom: 1px solid var(--kenar-ince); }
  .satirlar > :global(*:last-child) { border-bottom: 0; }
  .not { font-size: .8125rem; color: var(--bekliyor); padding: 0 4px; }
</style>
