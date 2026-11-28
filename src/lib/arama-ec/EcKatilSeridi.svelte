<!--
  Ringing strip for a DM call somebody started (Katıl / Yoksay), wherever you are. A call running in the room you have open is joined from
  that room's header instead (Oda.svelte), so the same action is not shown twice. In the page flow (pushes content down, nothing overlaps);
  like the other call bars it takes the status-bar inset itself, so on the phone it never slides under the system bar.
  Birinin başlattığı DM araması için çalma şeridi (Katıl / Yoksay), neredeysen. Açık odada süren aramaya o odanın başlığından katılınır
  (Oda.svelte); aynı eylem iki kez görünmez. Sayfa akışındadır (içeriği aşağı iter, hiçbir şey üst üste binmez); diğer arama çubukları gibi
  durum çubuğu boşluğunu kendisi alır, telefonda sistem çubuğunun altına kaymaz.
-->
<script lang="ts">
  import { gezinme } from "../durum/gezinme.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { t } from "../i18n";
  import Ikon from "../bilesenler/Ikon.svelte";
  import { ec } from "./ec.svelte";

  const sec = $derived.by(() => {
    if (ec.etkin) return null;
    for (const d of Object.values(ec.aktifler)) {
      if (d.odaId === gezinme.acikOdaId) continue;
      const o = odalar.liste.find((x) => x.id === d.odaId);
      if (o?.dm && !d.benIcinde && !ec.yoksayilan[d.odaId]) return { d, o };
    }
    return null;
  });

  const katil = () => {
    if (!sec) return;
    const { o } = sec;
    ec.katil({ id: o.id, ad: o.ad, avatarHarf: o.avatarHarf, avatarMxc: o.avatarMxc, dm: o.dm, sesli: o.dm });
  };
</script>

{#if sec}
  <div class="serit" role="status">
    <Ikon ad="telefon" boyut={18} />
    <span class="metin">{t("arama.ec.ariyor", { ad: sec.o.ad })}</span>
    <button class="ikincil" onclick={() => sec && ec.yoksay(sec.o.id)}>{t("arama.ec.yoksay")}</button>
    <button class="katil" onclick={katil}>{t("arama.ec.katil")}</button>
  </div>
{/if}

<style>
  .serit {
    flex: none; display: flex; align-items: center; gap: 8px; min-height: 52px; box-sizing: border-box;
    padding: calc(4px + env(safe-area-inset-top)) calc(12px + env(safe-area-inset-right)) 4px calc(16px + env(safe-area-inset-left));
    min-height: calc(52px + env(safe-area-inset-top));
    background: var(--ton); color: var(--ton-ustu); font-size: .9375rem;
  }
  .metin { flex: 1; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  button { min-height: 44px; padding: 0 16px; border-radius: 22px; font-weight: 600; color: inherit; }
  .katil { background: var(--cozum); color: var(--zemin); }
  .ikincil { border: 1px solid color-mix(in srgb, var(--ton-ustu) 40%, transparent); }
  button:active { opacity: .85; }
</style>
