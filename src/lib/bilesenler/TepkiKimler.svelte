<!--
  "Who reacted" sheet (opened by a long press on a reaction chip): the chips of the message as tabs-in-a-list, each group with the people
  who used it. Tapping a person opens their user card.
  "Kimler tepki verdi" sayfası (tepki çipine uzun basınca açılır): mesajın çipleri liste içinde bölümler olarak, her grup onu kullanan kişilerle.
  Bir kişiye dokunmak kullanıcı kartını açar.
-->
<script lang="ts">
  import type { Tepki } from "../api/tipler";
  import { kullaniciKartiAc } from "../durum/kullaniciKarti.svelte";
  import { t } from "../i18n";
  import { gorselUrl } from "../medya";
  import AltSayfa from "./AltSayfa.svelte";
  import Avatar from "./Avatar.svelte";

  let { tepkiler, odaId, baslangic, onkapat }: { tepkiler: Tepki[]; odaId: string; baslangic?: string; onkapat: () => void } = $props();

  // The chip that was long-pressed comes first. · Uzun basılan çip en başa gelir.
  const sirali = $derived([...tepkiler].sort((a, b) => Number(b.anahtar === baslangic) - Number(a.anahtar === baslangic)));
</script>

<AltSayfa baslik={t("tepki.kimler")} {onkapat}>
  {#each sirali as r (r.anahtar)}
    <section>
      <h3>
        {#if r.anahtar.startsWith("mxc://")}<img src={gorselUrl(r.anahtar, 24) ?? ""} alt="" width="24" height="24" />{:else}<span class="emoji">{r.anahtar}</span>{/if}
        <span class="sayi">{r.sayi}</span>
      </h3>
      {#each r.kisiler as k (k.id)}
        <button class="kisi" data-dalga onclick={() => kullaniciKartiAc(k.id, odaId, k.ad, k.avatarMxc)}>
          <Avatar harf={k.ad.charAt(0).toUpperCase() || "#"} mxc={k.avatarMxc} boyut={40} />
          <span class="ad">{k.ad}</span>
        </button>
      {/each}
    </section>
  {/each}
</AltSayfa>

<style>
  section { display: grid; }
  h3 { display: flex; align-items: center; gap: 8px; padding: 8px 0; font-size: .875rem; color: var(--yazi-2); }
  .emoji { font-size: 1.25rem; line-height: 1; }
  .sayi { font-weight: 600; }
  img { width: 24px; height: 24px; object-fit: contain; }
  .kisi { min-height: 52px; display: flex; align-items: center; gap: 12px; text-align: left; border-radius: 12px; padding: 4px 4px; transition: background var(--sure-hizli) var(--egri-cikis); }
  .kisi:active { background: var(--yuzey-3); }
  .ad { font-size: .9375rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
