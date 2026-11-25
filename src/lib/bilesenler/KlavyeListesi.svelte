<!--
  Shortcut list rendered directly from the single command table (KOMUTLAR). Used by both KlavyeYardim and KlavyeAyarlari.
  Tek komut tablosundan (KOMUTLAR) doğrudan çizilen kısayol listesi. Hem KlavyeYardim hem KlavyeAyarlari kullanır.
-->
<script lang="ts">
  import { t, type Anahtar } from "../i18n";
  import { KOMUTLAR, type Komut } from "../klavyeKisayol.svelte";

  const bolumler: { ad: Anahtar; ogeler: Komut[] }[] = [
    { ad: "klavye.her", ogeler: KOMUTLAR.filter((k) => k.herZaman) },
    { ad: "klavye.baglamGenel", ogeler: KOMUTLAR.filter((k) => !k.herZaman && k.context === "genel") },
    { ad: "klavye.baglamListe", ogeler: KOMUTLAR.filter((k) => !k.herZaman && k.context === "liste") },
    { ad: "klavye.baglamMesaj", ogeler: KOMUTLAR.filter((k) => !k.herZaman && k.context === "mesaj") },
  ];
</script>

<div class="liste">
  {#each bolumler as b (b.ad)}
    <section>
      <h3>{t(b.ad)}</h3>
      <dl>
        {#each b.ogeler as k (k.id)}
          <div>
            <dt>{#each k.key.split("+") as parca, i (i)}<kbd>{parca}</kbd>{/each}</dt>
            <dd>{t(k.etiket)}</dd>
          </div>
        {/each}
      </dl>
    </section>
  {/each}
</div>

<style>
  .liste { display: grid; gap: .75rem; }
  section { display: grid; gap: .25rem; }
  h3 { font-size: .8125rem; font-weight: 600; color: var(--vurgu); }
  dl { margin: 0; display: grid; }
  dl div { display: flex; align-items: center; gap: .75rem; min-height: 2.125rem; }
  dt { flex: none; width: 9.25rem; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
  dd { margin: 0; flex: 1; min-width: 0; font-size: .875rem; color: var(--yazi-2); }
  kbd { min-width: 1.5rem; padding: .125rem .375rem; border-radius: 6px; background: var(--yuzey-3); color: var(--yazi); font: inherit; font-size: .8125rem; font-weight: 600; text-align: center; }
</style>
