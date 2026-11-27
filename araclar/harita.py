#!/usr/bin/env python3
# Regenerates the "Dosya kataloğu" part of docs/HARITA.md from each file's header comment, so agents read one map
# instead of the whole project. Run after adding/renaming UI files: python3 araclar/harita.py
# docs/HARITA.md'nin "Dosya kataloğu" bölümünü her dosyanın baş yorumundan yeniden üretir; ajanlar bütün projeyi değil
# tek bir haritayı okur. Arayüz dosyası ekleyip/adını değiştirince çalıştır: python3 araclar/harita.py
import os, re
KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KLASORLER = ["src/lib/ekranlar", "src/lib/bilesenler", "src/lib/durum", "src/lib/medya", "src/lib/arama-mesaj", "src/lib/arama-ec", "src/lib/api", "src/lib"]
out, onceki = [], None
for kok in KLASORLER:
    tam = os.path.join(KOK, kok)
    if not os.path.isdir(tam):
        continue
    for ad in sorted(os.listdir(tam)):
        p = os.path.join(tam, ad)
        if not os.path.isfile(p) or not ad.endswith((".svelte", ".ts")):
            continue
        s = open(p, encoding="utf-8").read()
        ozet = ""
        m = re.search(r"<!--\s*(.*?)-->", s, re.S) if ad.endswith(".svelte") else None
        if m:
            ozet = m.group(1).strip().split("\n")[0]
        if not ozet:
            m = re.search(r"^\s*(?://|/\*\*?|\*)\s*(.+)$", s, re.M)
            ozet = m.group(1).strip() if m else ""
        ozet = ozet.split(" · ")[0].replace("|", "/")[:150]
        props = ""
        if ad.endswith(".svelte"):
            m = re.search(r"let \{([^}]*)\}\s*(?::[^=]*)?=\s*\$props\(\)", s, re.S)
            if m:
                props = "`" + re.sub(r"\s+", " ", m.group(1)).strip()[:110] + "`"
        if kok != onceki:
            out.append(f"\n### `{kok}/`\n\n| Dosya | Satır | Ne yapar | Props |\n|---|---|---|---|")
            onceki = kok
        out.append(f"| `{ad}` | {s.count(chr(10))} | {ozet} | {props} |")
h = os.path.join(KOK, "docs/HARITA.md")
metin = open(h, encoding="utf-8").read()
bas = metin.split("## Dosya kataloğu")[0]
open(h, "w", encoding="utf-8").write(bas + "## Dosya kataloğu\n" + "\n".join(out) + "\n")
print("docs/HARITA.md güncellendi")
