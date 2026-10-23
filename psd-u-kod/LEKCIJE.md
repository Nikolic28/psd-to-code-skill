# Lekcije sa terena (dizajn -> kod)

Svako pravilo iz `SKILL.md` je nastalo iz greske na stvarnom projektu (kiosk igre
1080x1920, Electron + Vite, 2026-09/10).

## Citanje PSD-a

**ag-psd umesto merenja sa JPEG-a.** JPEG ima kompresijski sum i nema ime fonta ni
tacnu velicinu. ag-psd daje tacne x/y/w/h, font, boju. PAZI: posle "Free Transform"
u Photoshopu velicina teksta je `fontSize x skala iz transform matrice`, ne samo
`fontSize` (`procitaj_psd.cjs` to vec racuna).

**Efekti slojeva postoje samo u PSD kompozitu.** ag-psd daje piksele sloja BEZ
kontura, prebojavanja i senki. `sastavi.cjs` ih crta sam: solidFill, stroke spolja,
dropShadow (multiply preko providnog = boja senke, ne crna!), clipping, maska grupe.
Provereno prema Photoshop JPEG-ovima: 0-0,09 %. Inner bevel ne crta - taj deo iz
klijentovog JPEG-a kroz masku (`alati/zakrpi_jpeg.ps1`).

**Vektorski smart object je PDF unutra.** Sat na Fresh Corner kvizu nije bio slika
ni tekst-sloj: PDF iz Illustratora. Iz toka crtanja dobijene su tacne crtice (SVG),
a iz `/BaseFont` font broja (Solido Compact Medium) - inace bi se "animacija sata"
pravila od oka.

## Tekst i fontovi

**SVG `<text>` sa sidrom iz PSD-a** - svi ekrani su se poklopili iz prvog pokusaja
(0,02-0,8 %). Red sa razmakom pre preloma Photoshop centrira SA razmakom.

**Font koji klijent posalje nije uvek font iz dizajna.**
- MTS: isto ime fajla, a drugi font (uzan, besplatna verzija, bez Č/Ć/Ž/Đ).
- Fresh Corner: isti oblik i visina slova, ali bez kerning tabele - razmak slova
  1-3 px drugaciji ("5" i "0" se u dizajnu dodiruju).
- Uvek: proveri srpska slova, iscrtaj rec iz PSD-a tim fontom i uporedi sa slojem.
  Ako ne valja: fiksni tekst moze kao slika iz PSD sastava, a promenljivo (brojevi)
  najblizim fontom izabranim POREDJENJEM PIKSELA, i pitanje klijentu za pravi fajl.
- Sidro PSD teksta ume da ima razmak na kraju ("35 ") - centriraj po mastilu.

**Alternativna slova (ss01..ss07).** Canvas preuzima `font-feature-settings` sa
ELEMENTA canvas, ne iz `@font-face`. Posle ukljucivanja ponovo izmeri velicinu.

**Vite + @font-face: `url("./assets/fonts/...")` TIHO ne radi u buildu** - font
pada na Arial, a u `npm run dev` radi. Koristi `url("/assets/fonts/...")`. Build
koji ispise "didn't resolve at build time" NIJE ispravan build.

**Bez PSD-a: velicina fonta binarnom pretragom** kroz pravi Chromium `measureText`
(`alati/measure_text.cjs`), sirina linije izmerena pixel-scan-om sa JPEG-a.

## Provera

**Brojevi, ne "od oka".** `uporedi.ps1` daje % razlicitih piksela + sliku razlike i
preklopa. Ekrani 1:1 iz mockupa moraju dati ~0 %. Bez toga se problem razmaka slova
na Fresh Corner-u nikad ne bi video - izgledalo je "otprilike isto".

**Snimci kroz DevTools protokol** (`--remote-debugging-port`,
`Emulation.setDeviceMetricsOverride`, `Page.captureScreenshot`): tacno u
dizajn-velicini na svakom monitoru, koordinate dodira = koordinate dizajna, isti
alat za dev build i za INSTALIRAN .exe. Test-prozor drzi van ekrana i bez fokusa
(`x: -2600, focusable: false` + `disable-features=CalculateNativeWinOcclusion`),
inace prima prave klikove osobe za racunarom.

**Skaliranje scene: CSS `zoom`, ne `transform: scale()`** (mutno na kiosku).
