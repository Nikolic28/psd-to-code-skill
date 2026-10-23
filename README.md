# psd-to-code — a Claude Code skill

Turns a client's design (PSD or JPEG mockups) into the code of a screen, accurate to the
pixel, and proves it by comparing a screenshot of the app with the mockup
(% of differing pixels + a diff image).

Built for touch-screen kiosk games (Electron + Vite, 1080x1920), but the PSD tools work
for any screen design.

## Install

Copy the `psd-to-code` folder to:

    C:\Users\<user>\.claude\skills\psd-to-code

Claude Code uses it automatically when a PSD/mockup is shared or when you say something
"doesn't match the design". You can also ask for it explicitly: "use the psd-to-code skill".

Requirements: Windows, Node 22+ (https://nodejs.org), internet on first run (it installs
`ag-psd` by itself). No Python needed.

## What's inside

| File | What it does |
|---|---|
| `SKILL.md` | the procedure Claude follows (A: PSD, B: JPEG only, C: verify) |
| `LESSONS.md` | why each rule exists (mistakes from earlier projects) |
| `read_psd.cjs` | every layer: position, font, real size, color, text anchor |
| `composite.cjs` | a screen from the PSD WITH layer effects (stroke, shadow, color overlay, masks) |
| `extract_layers.cjs` | every layer as a PNG + vector/effect info |
| `compare.ps1` | app screenshot vs mockup: % difference + diff and overlay images |
| `tools/` | layer index list, text styles, vector (PDF) extraction from smart objects, font size from a JPEG, patching from the JPEG |
| `examples-fresh-corner/` | a real project (Fresh Corner quiz, 2026-10): building all images, clock from a vector, font check, screenshots through DevTools |

The example scripts are kept as they ran on that project; the texts in them are the
client's Serbian design copy.

## Result on the Fresh Corner quiz

Screens composited from the PSD vs Photoshop JPEG exports: 0–0.34 % difference. Screens with
text in the finished app: 2.4 % — the remainder is letter spacing, because the delivered font
file was not the designer's (which is exactly what the comparison revealed).
