# Skill "psd-u-kod" za Claude Code

Pretvara dizajn klijenta (PSD ili JPEG mockup) u kod ekrana igre, tacno do piksela,
i dokazuje to poredjenjem snimka aplikacije sa mockupom (% razlike + slika razlike).

## Instalacija (jednom)

Kopiraj ceo folder `psd-u-kod` u:

    C:\Users\<korisnik>\.claude\skills\psd-u-kod

Claude Code ga sam koristi kad se posalje PSD/mockup ili kad se kaze "nije kao na
dizajnu". Moze i izricito: "koristi skill psd-u-kod".

Potrebno: Windows, Node 22+ (https://nodejs.org), internet pri prvom pokretanju
(sam instalira `ag-psd`). Python nije potreban.

## Sta je unutra

| Fajl | Sta radi |
|---|---|
| `SKILL.md` | uputstvo koje Claude prati (postupak A/B/C) |
| `LEKCIJE.md` | zasto je svako pravilo tu (greske sa ranijih projekata) |
| `procitaj_psd.cjs` | spisak svih slojeva: pozicija, font, prava velicina, boja |
| `sastavi.cjs` | ekran iz PSD-a SA efektima (kontura, senka, prebojavanje) |
| `izvuci.cjs`, `ekrani.cjs` | svaki sloj kao PNG / prost sastav ekrana |
| `uporedi.ps1` | snimak aplikacije vs mockup: % razlike + slike |
| `alati/` | lista slojeva, stilovi teksta, vadjenje vektora (PDF) iz PSD-a, merenje fonta bez PSD-a, zakrpa iz JPEG-a |
| `primeri-fresh-corner/` | stvaran projekat (Fresh Corner kviz, 2026-10): priprema svih slika, sat iz vektora, provera fonta, snimci kroz DevTools |

## Rezultat na Fresh Corner kvizu

Ekrani iz PSD-a prema Photoshop JPEG-ovima: 0 % / 0,32 % razlike; ekrani sa
tekstom 2,4 % - ostatak je razmak slova jer poslati font nije isti kao dizajnerov
(to je skill i otkrio).
