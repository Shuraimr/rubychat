<!-- Keyboard shortcut list (? key, Görünüm › Masaüstü) · Klavye kısayolu listesi (? tuşu, Görünüm › Masaüstü) -->
<script lang="ts">
  import { tercihler } from "../durum/tercihler.svelte";
  import { t, type Anahtar } from "../i18n";
  import { klavye } from "../klavyeKisayol.svelte";
  import AltSayfa from "./AltSayfa.svelte";

  const bolumler: { ad: Anahtar; vim: boolean; satirlar: [string, Anahtar][] }[] = [
    { ad: "klavye.her", vim: false, satirlar: [["Ctrl Space", "klavye.kPalet"], ["Ctrl E", "klavye.kListe"], ["Enter · Shift Enter", "klavye.kAdim"], ["Esc", "klavye.kKapat"]] },
    { ad: "klavye.vimGenel", vim: true, satirlar: [["h j k l", "klavye.kGez"], ["Enter", "klavye.kEtkin"], ["h · l", "klavye.kHL"], ["J · K", "klavye.kOda"], ["gt · gT", "klavye.kSekme"], ["gs", "klavye.kAyar"], ["?", "klavye.kYardim"]] },
    { ad: "klavye.vimOdada", vim: true, satirlar: [["j · k", "klavye.kMesaj"], ["gg · G", "klavye.kUc"], ["Ctrl D · Ctrl U", "klavye.kYarim"], ["Tab · /", "klavye.kTabAra"], ["i", "klavye.kYaz"], ["Esc", "klavye.kNormal"], ["r", "klavye.kYanit"], ["e", "klavye.kDuzenle"], ["y", "klavye.kKopya"], ["Enter · o", "klavye.kMenu"], ["gi", "klavye.kBilgi"]] },
  ];
</script>

<AltSayfa baslik={t("klavye.kisayollar")} onkapat={() => (klavye.yardim = false)}>
  {#each bolumler as b (b.ad)}
    <section>
      <h3>{t(b.ad)}</h3>
      {#if b.ad === "klavye.vimGenel" && !tercihler.d.vim}<p>{t("klavye.vimKapali")}</p>{/if}
      <dl class:soluk={b.vim && !tercihler.d.vim}>
        {#each b.satirlar as [tus, ne] (ne)}
          <div><dt>{#each tus.split(" ") as x, i (i)}{#if x === "·"}<i>/</i>{:else}<kbd>{x}</kbd>{/if}{/each}</dt><dd>{t(ne)}</dd></div>
        {/each}
      </dl>
    </section>
  {/each}
</AltSayfa>

<style>
  section { display: grid; gap: .25rem; padding-bottom: .75rem; }
  h3 { font-size: .8125rem; font-weight: 600; color: var(--vurgu); }
  p { font-size: .8125rem; color: var(--yazi-2); }
  dl { margin: 0; display: grid; }
  dl.soluk { opacity: .6; }
  dl div { display: flex; align-items: center; gap: 1rem; min-height: 2.25rem; }
  dt { flex: none; width: 9.5rem; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
  dd { margin: 0; flex: 1; min-width: 0; font-size: .875rem; color: var(--yazi-2); }
  kbd { min-width: 1.5rem; padding: .125rem .375rem; border-radius: 6px; background: var(--yuzey-3); color: var(--yazi); font: inherit; font-size: .8125rem; font-weight: 600; text-align: center; }
  i { font-style: normal; color: var(--yazi-2); font-size: .75rem; }
</style>
