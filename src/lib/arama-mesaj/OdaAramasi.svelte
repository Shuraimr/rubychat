<!--
  In-room search jump logic (no UI of its own any more: the search bar is OdaIciArama.svelte, shown in place of the composer).
  It owns the "jump to result" step for the open room: when `atlama.hedef` points at this room it loads history until the
  message is in the timeline, scrolls to it and flashes it. Mount it once per open room, anywhere inside the room component.
  Oda içi arama atlama mantığı (artık kendi arayüzü yok: arama çubuğu OdaIciArama.svelte, yazma alanının yerinde gösterilir).
  Açık oda için "sonuca atla" adımı BURADA: `atlama.hedef` bu odayı gösterirse mesaj çizelgeye girene dek geçmişi yükler,
  mesaja kaydırır ve vurgular. Açık oda başına bir kez, oda bileşeninin herhangi bir yerine koy.
-->
<script lang="ts">
  import { tick } from "svelte";
  import { olayaGit } from "../api/komutlar";
  import { bildirim } from "../durum/bildirim.svelte";
  import { zaman } from "../durum/zaman.svelte";
  import { t } from "../i18n";
  import { konumKaydet } from "../klavyeKisayol.svelte";
  import { atlama } from "./durum.svelte";
  import { kaydirVeVurgula, satiriBul } from "./vurgula";

  let { odaId }: { odaId: string } = $props();

  // ---- Jump to the tapped result · Dokunulan sonuca atla ----
  let isleniyor = "";
  $effect(() => {
    const h = atlama.hedef;
    // Wait until the room itself is open and its first page arrived. · Odanın kendisi açılıp ilk sayfası gelene dek bekle.
    if (!h || h.odaId !== odaId || !zaman.bilgi || zaman.yukleniyor || zaman.ogeler.length === 0) return;
    if (isleniyor === h.olayId) return;
    isleniyor = h.olayId;
    void atla(h.olayId);
  });

  async function atla(olayId: string) {
    konumKaydet(odaId, olayId);
    let bulundu = !!satiriBul(olayId);
    if (!bulundu) {
      try {
        bulundu = await olayaGit(odaId, olayId);
      } catch (e) {
        console.error(e);
      }
    }
    if (bulundu) {
      // The row appears once the backend's update reached the list; wait a few frames for it. · Satır, arka ucun güncellemesi listeye ulaşınca belirir; birkaç kare bekle.
      for (let i = 0; i < 30; i++) {
        await tick();
        const el = satiriBul(olayId);
        if (el) {
          // Scroll twice: the timeline may still re-stick to the bottom / shift when older pages land. · İki kez kaydır: eski sayfalar inerken çizelge alta yapışabilir / kayabilir.
          kaydirVeVurgula(el);
          setTimeout(() => {
            const e2 = satiriBul(olayId);
            if (e2) kaydirVeVurgula(e2);
          }, 300);
          break;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
    } else {
      bildirim.goster(t("mesajAra.bulunamadi"), 4000, { tur: "hata" });
    }
    if (atlama.hedef?.olayId === olayId) atlama.hedef = null;
    isleniyor = "";
  }
</script>
