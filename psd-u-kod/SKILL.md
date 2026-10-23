---
name: psd-u-kod
description: Prenos klijentovog dizajna (PSD ili JPEG/PDF mockup, 1080x1920 kiosk ekrani) u HTML/CSS ili Canvas kod sa tacnim pozicijama, fontovima, velicinama i bojama, i provera gotovog ekrana prema mockupu. Koristi kad klijent posalje dizajn/mockup/PSD, kad treba napraviti ili popraviti ekran po dizajnu, kad korisnik kaze "nije kao na dizajnu", "font nije dobar", "pomeri", "ne poklapa se", ili kad stigne izmenjen mockup.
---

# Dizajn klijenta -> kod

Pravilo: **nista "od oka"**. Svaka pozicija, velicina fonta i boja dolazi iz
PSD-a ili iz merenja, a gotov ekran se proverava preklapanjem sa mockupom.
Zasto i odakle svako pravilo: `LEKCIJE.md` u ovom folderu.

Potrebno: Windows (PowerShell + .NET System.Drawing za slike - bez Pythona),
Node 22+, Electron u projektu (merenje fontova u pravom Chromium-u).
`ag-psd` se sam instalira u folder skilla pri prvom pokretanju (`agpsd.cjs`).
Ispod `SKILL` = `~/.claude/skills/psd-u-kod`.

## A) Postoji .psd -> procitaj ga direktno

```bash
node SKILL/procitaj_psd.cjs "materijali/fajl.psd" --json "$TEMP/psd.json"
node SKILL/alati/psd_lista.cjs "materijali/fajl.psd"     # indeksi slojeva po grupi (za sastavi.cjs)
node SKILL/alati/psd_tekst.cjs "materijali/fajl.psd"     # pun stil teksta (tracking, kerning, prored)
```
`procitaj_psd` ispisuje svaki sloj po grupama (grupe su obicno ekrani):
x/y/w/h, tekst, font, **efektivni fontPx** (vec pomnozen skalom iz transform
matrice - NE koristi sirovo `fontSize` polje), boja, leading, poravnanje,
delove teksta sa drugacijim stilom, i **SVG sidro** (baseline) svakog teksta.

Dizajn nije 1080x1920 (npr. polozen 1920x1080)? Ne skaliraj - napravi `#stage`
u dizajn-velicini i koristi PSD koordinate 1:1.
Ekran koji je samo u JPEG-u, ne u PSD-u: izmeri pixel-scan-om (PowerShell
GetPixel u pravougaoniku boje dugmeta) i proveri metodu na ekranu koji JESTE u
PSD-u - mora da se poklopi do piksela.

Prevodjenje u CSS (dizajn 1080x1920 = CSS px 1:1 unutar `#stage`, skaliran CSS `zoom`):
- Slika/pravougaonik: `left: x; top: y; width: w; height: h`.
- `font-family` po imenu iz PSD-a (npr. `Poppins-Medium` -> Poppins 500),
  fajl fonta iz klijentovih materijala u `public/assets/fonts/`,
  `@font-face url("/assets/fonts/...")` (apsolutno! relativno tiho pada na Arial u Vite buildu).
- Dugmad: proveri da li su u PSD-u zaobljen pravougaonik ili pilula - ne
  pretpostavljaj.
- Ista ikonica u drugoj boji: `filter: brightness(0) invert(1)` (belo), ne nov asset.

### Slike iz PSD-a

- **`sastavi.cjs` (prvi izbor)** - ekran (grupa) SA efektima slojeva: solidFill,
  stroke spolja, dropShadow, clipping, maska grupe.
  `node SKILL/sastavi.cjs <psd> <izlaz> [grupa:skip,indeksi:ime]`, a iz koda
  `renderGroup(psd, grupa, { skip, samo })`. Prvo uporedi sastav sa klijentovim
  JPEG-ovima (korak C) - Fresh Corner: 0-0,09 %.
  Obrazac: pozadina ekrana = grupa BEZ slojeva koji se menjaju/animiraju, a svaki
  takav deo poseban PNG isecen na svoj okvir + `geometry.json` sa koordinatama.
  Ceo primer: `primeri-fresh-corner/pripremi_assets.cjs` (kopiraj `sastavi.cjs`
  u `<projekat>/tools/psd_sastavi.cjs`).
- Ne crta **inner bevel / emboss**: taj deo uzmi iz klijentovog JPEG-a kroz masku
  (`alati/zakrpi_jpeg.ps1`).
- `izvuci.cjs <psd> <izlaz>` - svaki sloj kao PNG BEZ efekata + `_info.json`
  (boja/radijus vektor-oblika, efekti). Za brz pregled sta sve postoji.
- `ekrani.cjs` - prost sastav (pozadina + slojevi, bez efekata); imena grupa prilagodi.

### Vektorski smart object (ikonica, sat, logo iz Illustratora)

`psd.linkedFiles[].data` je PDF. `alati/psd_smart_objekti.cjs <psd> <izlaz> [id]`
ga izvadi, `alati/pdf_tok.cjs <pdf> <broj objekta>` ispise tok crtanja. Tok
(q/Q/cm/m/l/c/h/re/f/scn) se pretvara u SVG putanje 1:1, a `/BaseFont` kaze
kojim fontom je tekst UNUTAR objekta (to nije tekst-sloj, `procitaj_psd` ga ne vidi).
Primer: `primeri-fresh-corner/sat_svg.cjs` (60 crtica sata + broj u Solido-u).

### Tekst

- Najtacnije kao SVG `<text x y text-anchor="middle">`: `transform[4..5]` iz PSD
  teksta je sidro (baseline prvog reda), prored = fontPx x 1.2 (auto leading).
  Red koji u PSD-u ima razmak pre `\n` centriran je SA razmakom
  (`xml:space="preserve"`).
- Jos tacnije (i otporno na zamenu fajla fonta): baseline = VRH mastila sloja iz
  PSD-a + ascent glifa izmeren u Chromium-u (`measureText().actualBoundingBox*`),
  centar x = centar PSD okvira. Merenje: `primeri-fresh-corner/merenje.cjs`.
- **Pre kraja proveri da je poslati font ISTI kao font dizajna** - i po obliku i po
  razmaku slova: `primeri-fresh-corner/font_vs_psd.cjs` (okvir mastila),
  `glifovi.cjs` (polozaj svakog slova), `fit_font.cjs` (da li ispravka po slovu
  objasnjava razliku). Proveri i srpska slova (Č Ć Ž Đ Š). Ako se razlikuje:
  trazi od klijenta tacan fajl fonta dizajnera, ne "popravljaj" font.

## B) Nema .psd, samo JPEG/PDF mockup -> izmeri

1. Pozicije elemenata: pixel-scan ivica na JPEG-u (PowerShell +
   `System.Drawing`, LockBits; prvi/poslednji red/kolona cija boja odstupa od
   pozadine u zadatom pravougaoniku).
2. Velicina fonta: izmerenu sirinu svake linije teksta daj
   `alati/measure_text.cjs` (+ `.html`, kopiraj u `<projekat>/electron/`, popuni
   TARGETS i @font-face) - binarna pretraga kroz pravi Chromium `measureText`,
   vraca px velicinu + ascent/descent.
3. Ako mockup nije 1080x1920 (npr. PDF export), prvo ga skaliraj na 1080x1920 pa meri.

## C) Provera: screenshot vs mockup (obavezno posle svake izmene izgleda)

1. Snimi ekrane u punoj rezoluciji iz TRENUTNOG builda (stari snimak laze).
   Alat: CDP `Emulation.setDeviceMetricsOverride` = tacna dizajn-rezolucija na
   svakom monitoru, isti alat i za instaliran .exe - primer
   `primeri-fresh-corner/cdp.mjs` + `shot.mjs` (prilagodi `window.__fc` kukice
   svojoj igri). Animacije ugasi; mockup ima primer-brojeve (50 : 25)? Upisi ih u
   DOM pre snimka, pa je poredjenje cisto.
2. Uporedi svaki ekran sa odgovarajucim mockupom:
   ```bash
   powershell -ExecutionPolicy Bypass -File "$(cygpath -w ~/.claude/skills/psd-u-kod/uporedi.ps1)" \
     -Mockup "materijali/2.jpg" -Snimak "snimci/2-start.png"
   ```
   Pravi `<snimak>.razlika.png` i `<snimak>.preklop.png` i ispisuje % razlicitih piksela.
3. Pogledaj obe slike:
   - `razlika`: tanke crvene konture = OK (JPEG sum, antialiasing).
     **Puna crvena slova** = drugaciji font/debljina (font se nije ucitao,
     pogresan weight). **Duple konture pomerene** = pomeraj, izmeri koliko.
   - `preklop`: duple ivice pokazuju smer i velicinu pomeraja.
   - Orijentaciono: ekran 1:1 iz PSD-a ~0 %, ~1-3 % = poklapa se (tekst),
     >5 % = nesto ozbiljno nije isto.
   - Mockup sa primer-sadrzajem se legitimno razlikuje na tom mestu - proceni samo to mesto.
4. Popravi i ponovi dok razlika ne bude samo sum. Korisniku posalji putanju
   preklop slike kao dokaz, ne samo "poravnato".

## Kad klijent posalje izmenjen dizajn

Sacuvaj ga u `materijali/` pod imenom koje govori sta je (npr.
`2-izmenjeno.jpg`), uporedi STARI i NOVI mockup istim `uporedi.ps1` (razlika
odmah pokaze sta je klijent promenio - ne oslanjaj se samo na njegov opis),
pa promeni samo to. Posle izmene: korak C za taj ekran, pa novi build i provera
stvarno instalirane kopije.
