<!--
  Rounded-square avatar: the Matrix image (served by the Rust `medya` scheme) with an initial fallback while loading or on error.
  Yuvarlatılmış kare avatar: Matrix resmi (Rust `medya` şemasından gelir); yüklenirken ya da hatada baş harf yedeği.
-->
<script lang="ts">
  import { avatarUrl } from "../medya";

  let { harf, boyut = 48, mxc = null, yaricap: ozelYaricap }: { harf: string; boyut?: number; mxc?: string | null; yaricap?: number } = $props();
  // Radius 12 at 48px, scaled for smaller sizes · 48px'te 12 yarıçap, küçüklerde orantılı
  const yaricap = $derived(ozelYaricap ?? Math.round(boyut / 4));
  const url = $derived(avatarUrl(mxc, boyut));
  let hatali = $state(false);
  // A new image gets a fresh chance. · Yeni resim yeni bir şans alır.
  $effect(() => {
    url;
    hatali = false;
  });
</script>

<span
  class="avatar"
  style:width="{boyut}px"
  style:height="{boyut}px"
  style:border-radius="{yaricap}px"
  style:font-size="{Math.round(boyut * 0.42)}px"
  aria-hidden="true"
>
  {harf}
  {#if url && !hatali}<img src={url} alt="" loading="lazy" draggable="false" onerror={() => (hatali = true)} />{/if}
</span>

<style>
  .avatar {
    flex: none;
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: var(--ton);
    color: var(--ton-ustu);
    font-weight: 600;
    font-family: var(--baslik-tipi);
  }
  img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; background: var(--yuzey-2); }
</style>
