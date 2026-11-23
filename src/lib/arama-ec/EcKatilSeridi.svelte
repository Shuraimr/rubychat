<!--
  "Katıl" strip, in the page flow (it pushes the content down, nothing overlaps): a DM call somebody started rings here wherever you are
  (Katıl / Yoksay); in the room you have open, a running call of any room shows "Aramada: …  Katıl".
  "Katıl" şeridi, sayfa akışında (içeriği aşağı iter, hiçbir şey üst üste binmez): birinin başlattığı DM araması neredeysen burada çalar
  (Katıl / Yoksay); açık odada, o odada süren her arama "Aramada: …  Katıl" gösterir.
-->
<script lang="ts">
  import { gezinme } from "../durum/gezinme.svelte";
  import { odalar } from "../durum/odalar.svelte";
  import { t } from "../i18n";
  import Ikon from "../bilesenler/Ikon.svelte";
  import { ec } from "./ec.svelte";

  const sec = $derived.by(() => {
    if (ec.etkin) return null;
    const bul = (id: string) => odalar.liste.find((o) => o.id === id);
    // 1) a DM call that is ringing (not dismissed) · 1) çalan DM araması (yoksayılmamış)
    for (const d of Object.values(ec.aktifler)) {
      const o = bul(d.odaId);
      if (o?.dm && !d.benIcinde && !ec.yoksayilan[d.odaId]) return { d, o, cal: true };
    }
    // 2) the open room has a running call · 2) açık odada süren arama var
    const acik = gezinme.acikOdaId ? ec.aktifler[gezinme.acikOdaId] : undefined;
    const o = acik ? bul(acik.odaId) : undefined;
    if (acik && o && !acik.benIcinde) return { d: acik, o, cal: false };
    return null;
  });

  const katil = () => {
    if (!sec) return;
    const { o } = sec;
    ec.katil({ id: o.id, ad: o.ad, avatarHarf: o.avatarHarf, avatarMxc: o.avatarMxc, dm: o.dm, sesli: o.dm });
  };
</script>

{#if sec}
  <div class="serit" role="status" class:cal={sec.cal}>
    <Ikon ad="telefon" boyut={18} />
    <span class="metin">{sec.cal ? t("arama.ec.ariyor", { ad: sec.o.ad }) : t("arama.ec.suruyor", { n: sec.d.katilimcilar.length })}</span>
    {#if sec.cal}<button class="ikincil" onclick={() => sec && ec.yoksay(sec.o.id)}>{t("arama.ec.yoksay")}</button>{/if}
    <button class="katil" onclick={katil}>{t("arama.ec.katil")}</button>
  </div>
{/if}

<style>
  .serit {
    flex: none; display: flex; align-items: center; gap: 8px; min-height: 52px; box-sizing: border-box;
    padding: 4px calc(12px + env(safe-area-inset-right)) 4px calc(16px + env(safe-area-inset-left));
    background: var(--ton); color: var(--ton-ustu); font-size: .9375rem;
  }
  .metin { flex: 1; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  button { min-height: 44px; padding: 0 16px; border-radius: 22px; font-weight: 600; color: inherit; }
  .katil { background: var(--cozum); color: var(--zemin); }
  .ikincil { border: 1px solid color-mix(in srgb, var(--ton-ustu) 40%, transparent); }
  button:active { opacity: .85; }
</style>
