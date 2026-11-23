<!--
  Presence line for the other person of a DM ("çevrimiçi" / "son görülme ..."): asked from the server once when the room opens. Many servers
  switch presence off; then the request fails and NOTHING is drawn (no fake "offline"). Not live: it refreshes when the room is reopened.
  DM'deki karşı kişinin varlık satırı ("çevrimiçi" / "son görülme ..."): oda açılınca sunucuya bir kez sorulur. Birçok sunucu varlığı kapatır;
  o zaman istek başarısız olur ve HİÇBİR ŞEY çizilmez (sahte "çevrimdışı" yok). Canlı değil: oda yeniden açılınca yenilenir.
-->
<script lang="ts">
  import { varlikDurumu } from "../api/komutlar";
  import type { VarlikDurumu } from "../api/tipler";
  import { t } from "../i18n";
  import { goreliZaman } from "../zaman-bicim";

  let { kullaniciId }: { kullaniciId: string } = $props();
  let varlik = $state<VarlikDurumu | null>(null);

  $effect(() => {
    const id = kullaniciId;
    varlik = null;
    varlikDurumu(id)
      .then((v) => {
        if (id === kullaniciId) varlik = v;
      })
      .catch(() => {
        /* presence is off on this server · bu sunucuda varlık kapalı */
      });
  });

  const metin = $derived.by(() => {
    if (!varlik) return null;
    if (varlik.durum === "cevrimici") return t("varlik.cevrimici");
    if (varlik.sonEtkinlikMs === null) return null;
    return t("varlik.sonGorulme", { zaman: goreliZaman(Date.now() - varlik.sonEtkinlikMs) });
  });
</script>

{#if metin}<span class="varlik" class:acik={varlik?.durum === "cevrimici"}><i></i>{metin}</span>{/if}

<style>
  .varlik { display: inline-flex; align-items: center; gap: 4px; flex: none; }
  i { width: 6px; height: 6px; border-radius: 50%; background: var(--yazi-2); }
  .acik { color: var(--cozum); }
  .acik i { background: var(--cozum); }
</style>
