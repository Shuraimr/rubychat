// Small date/time formatting helpers (locale follows the app language). · Küçük tarih/saat biçimleme yardımcıları (yerel ayar uygulama dilini izler).
import { tercihler } from "./durum/tercihler.svelte";
import { t, yerel } from "./i18n";

// 24h / 12h follows Görünüm › Saat biçimi · 24 / 12 saat Görünüm › Saat biçimini izler
export const saatYaz = (ms: number): string =>
  new Date(ms).toLocaleTimeString(yerel, { hour: "2-digit", minute: "2-digit", hour12: !tercihler.d.saat24 });

/** "Bugün" / "Dün" / "12 Mart" (with year if not this year) · "Bugün" / "Dün" / "12 Mart" (bu yıl değilse yılıyla) */
export function gunEtiketi(ms: number): string {
  const d = new Date(ms);
  const bugun = new Date();
  const dun = new Date();
  dun.setDate(bugun.getDate() - 1);
  if (d.toDateString() === bugun.toDateString()) return t("oda.bugun");
  if (d.toDateString() === dun.toDateString()) return t("oda.dun");
  return d.toLocaleDateString(yerel, {
    day: "numeric",
    month: "long",
    year: d.getFullYear() === bugun.getFullYear() ? undefined : "numeric",
  });
}


/** Chat-list time: "şimdi", "14:02", "Dün", weekday (within a week), else "12 Mar". · Sohbet listesi zamanı. */
export function goreliZaman(ms: number | null): string {
  if (!ms) return "";
  const d = new Date(ms);
  const simdi = new Date();
  if (simdi.getTime() - ms < 60_000 && simdi.getTime() >= ms) return t("sohbetler.simdi");
  if (d.toDateString() === simdi.toDateString()) return saatYaz(ms);
  const gunBasi = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const fark = Math.round((gunBasi(simdi) - gunBasi(d)) / 86_400_000);
  if (fark === 1) return t("oda.dun");
  if (fark > 1 && fark < 7) return d.toLocaleDateString(yerel, { weekday: "long" });
  return d.toLocaleDateString(yerel, { day: "numeric", month: "short", year: d.getFullYear() === simdi.getFullYear() ? undefined : "numeric" });
}

/** 42 → "00:42", 3725 → "1:02:05" */
export function sureYaz(sn: number): string {
  const s = Math.max(0, Math.floor(sn));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const iki = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${iki(m)}:${iki(s % 60)}` : `${iki(m)}:${iki(s % 60)}`;
}
