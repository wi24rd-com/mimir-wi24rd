# INVESTIGATION B3: dashboardet over på Wi24rd UI Kit 2

**Executor:** Claude (Fable 5.2), cloud-session
**Dato:** 2026-11-21
**Fase:** ASEWAVE Fase A. Read-only. Ingen implementering.
**Anledning:** Jan påpegede, at dashboardet i B2 ikke følger softwarens designskema. Jan har besluttet, at mærket i programmet er blågrønt (teal).

Kilde: `Grimnir/design/ui-kit-2/` på Jans Mac, læst via 13 filer hentet til sessionen. Jeg har læst kittets to README-filer, afsnittene Grundlag, AppShell, StatusTile, Sprog og "Findes ikke endnu" i `KOMPONENTER.md`, samt `tema.js`. Resten af `KOMPONENTER.md` (cirka 1.200 af 1.500 linjer) og `flytning/HUGINN-MUNINN.md` er **ikke læst** endnu.

---

## §C.0 Evidence

```
$ cat pakke/VERSION
2.8.0

$ wc -c (uddrag)
 124007 KOMPONENTER.md
  66736 web/kit.css
 128520 web/kit.js
   3658 web/sprogmotor.js
   2953 web/tema.js
   5913 tokens/tokens.css
```

Tjek af `kit.js` mod sidens indholdspolitik (antal linjer med mønsteret):

```
innerHTML                1
style="                  0
.style.                  0
eval(                    0
new Function             0
fetch(                   0
XMLHttpRequest           0
localStorage             0
http                     1     (kun http://www.w3.org/2000/svg)
```

Vinduets mindstemål (`kit.css`, linje 196):

```
.vindue { display: flex; flex-direction: column; height: 100vh; min-width: 900px; min-height: 560px; background: var(--bg); overflow: hidden; }
```

Grimnirs brug af kittet (`Grimnir/ui/index.html`):

```
2:<html lang="da" data-tema="system" data-kit-praefiks="grimnir" data-laast>
7:<link rel="stylesheet" href="assets/tokens.css">
8:<link rel="stylesheet" href="assets/kit.css">
9:<link rel="stylesheet" href="assets/app.css">
10:<script src="assets/tema.js"></script>
11:<script src="assets/sprogmotor.js" defer></script>
13:<script src="assets/kit.js" defer></script>
26:    <span class="mrk-maske gr-mrk" aria-hidden="true"></span>
```

Kittets API (sidste linje i `kit.js`, afkortet):

```
window.Kit = Object.freeze({ IKONER, ikon, registrerIkoner, chip, knap, felt, banner, tabel, commandBar, navTrae,
  visningsskift, guide, fletbaand, SYMBOL, vaelger, sidepanel, segment, filterchip, filterchips, kasse, statusflise,
  statusfliser, tomTilstand, fremdrift, vaerktoejstip, afkrydsning, kon…
```

Kittets to første datafarver gennem dataviz-skillens validator:

```
lyst  #2F74E0,#B85C00 på #FFFFFF → ALL CHECKS PASS   (værste par ΔE 28.5 ved protanopi)
mørkt #6FA5FF,#FFB066 på #121C29 → Lightness band FAIL (0.723 og 0.819 mod 0.48–0.67); øvrige fire tjek PASS
```

---

## Spørgsmål 1: Hvad er softwarens designsystem?

**BEKRÆFTET.** Wi24rd UI Kit 2, version 2.8.0. Kittets README: "fælles udseende og opførsel for Wi24rd-programmerne". Inter til alt, JetBrains Mono til værdier, accent `#007864` (lyst) og `#35D6B3` (mørkt), lyst tema som standard, radier på 4, 6 og 10 px, kanter frem for skygger, brødtekst 14/20.

`claude/design-grundlag.md` sagde det allerede: "App-kittet hører til inde i programmerne." B2 fulgte hjemmesidens udtryk og var forkert.

## Spørgsmål 2: Kan kittet køre under dashboardets indholdspolitik?

**BEKRÆFTET efter kildekoden. Ikke kørt.** `kit.js` sætter ingen inline-stil, henter intet og bruger hverken `eval` eller `new Function`. `tema.js` skal stå uden `defer` og er en almindelig fil, så `script-src 'self'` rækker. Kittet er klassiske scripts (`window.Kit`), og min `app.js` er et modul. De kan indlæses side om side.

Forbehold: den ene forekomst af `innerHTML` i `kit.js` er ikke undersøgt.

## Spørgsmål 3: Har kittet grafer?

**NEJ.** Kittet har farver til dataserier (`--data-1` til `--data-6`, akse, gitter, etiket) og regler for dem, men ingen diagramkomponent: "programmet tegner selv prikken, søjlen eller kortet". Min SVG-graf fra B2 kan altså blive, med kittets tokens.

Regler, grafen skal følge: serier i rækkefølge med `--data-1` først, højst seks, aldrig farve alene, tal og etiketter i `--data-label`. Oplysning og besøg er `--info-mark`, som er samme blå som `--data-1`. Visninger er altså blå og kloninger orange.

**Konflikt:** Kittets mørke datafarver falder uden for det lysstyrkeinterval, dataviz-skillen kræver. Kittet stiller sit eget målte krav (3:1 mod fladerne) og er projektets designsystem. Jeg følger kittet og noterer konflikten.

## Spørgsmål 4: Mærket

**BEKRÆFTET.** Grimnir viser sit mærke med `.mrk-maske`: en flade i `--accent-on-rail`, som programmet giver form med `mask-image`. Titellinjen (`rail`) er mørk i begge temaer, og `--accent-on-rail` er `#35D6B3` i begge.

Konsekvens: Mimirs mærke lægges på som maske. Så bliver det blågrønt af sig selv og følger kittet uden en farvet kopi af filen. Det svarer til Jans beslutning.

## Spørgsmål 5: Passer skallen til et dashboard?

**DELVIST. Her er de to valg, Jan skal træffe.**

- **Mindste vindue er 900 × 560 px.** Kittet er lavet til skrivebordsprogrammer. Det lokale dashboard åbnes fra terminalen på en computer, så det passer. På en telefon (relevant, hvis dashboardet senere lægges på Pages) vil siden skulle rulles vandret. Kittet har ingen smal udgave.
- **"Ingen pynt med tal."** Kittets regel: "En flise findes kun, når brugeren handler på tallet." B2's række med fire samletal er netop tal, man ikke kan handle på. Den skal enten væk eller laves om til fliser, der åbner det, tallet tæller.

Opbygningen, kittet lægger op til: titellinje med mærke og navn, ét handlingsbånd, navigationsrude til venstre, arbejdsflade med tabel, og fodlinje. Kittets princip 5: "Programmer, der holder alt lokalt, siger det fast i fodlinjen." Det passer præcist til Mimir.

## Spørgsmål 6: Sprog

**BEKRÆFTET.** Kittet ejer mekanikken (`KitSprog.opret`, `data-t`-attributter), programmet ejer teksterne. "Dansk først, engelsk med samme nøgler." `kit.js` sætter kun `data-t`-attributterne; et program må beholde sit eget sprogmodul, hvis det udfylder dem.

Mimirs sætninger i klart sprog er funktioner, ikke skabeloner. Kittets skabeloner kan ental og flertal (`{v:fil|filer}`), men ikke betingede sætninger. Forventet løsning: `window.Sprog` fra kittet til alt, kittet bygger, og Mimirs egne funktioner til opsummeringen. Ikke afprøvet.

## Spørgsmål 7: Tema

**BEKRÆFTET.** `tema.js` sætter `<html data-tema="lys | moerk | system">` og husker valget i `localStorage['<præfiks>-tema']`. B2's eget `data-theme` og min egen lagring udgår. Kittet har også tekststørrelse i tre trin.

## Spørgsmål 8: Licens

**BEKRÆFTET.** Kittet er Apache-2.0, og licensteksten "skal blive liggende sammen med pakken", når den kopieres. Skrifterne er OFL-1.1 med egne licensfiler. Mimir har ingen licens endnu.

## Spørgsmål 9: Hvordan holdes kopien ren?

Kittets README: "Ret ikke i kopierne." Grimnir har `build-kit.mjs --check`, som fejler, hvis en kopi afviger fra kilden. Mimir har ikke kilden i sit eget repo.

Forslag til Fase B: kopiér filerne uændret fra version 2.8.0, læg `VERSION` og licenser ved, og lad en test sammenligne hver fil med en nedskrevet SHA-256. Så opdages en rettelse i kopien, og en opgradering er en bevidst handling.

---

## Deviation-liste

1. **B2's dashboard følger det forkerte designsystem.** Det er anledningen til denne undersøgelse.
2. **Undersøgelsen er ufuldstændig.** Cirka fire femtedele af `KOMPONENTER.md` er ikke læst, herunder DataTable, Banner, Dialog, Segmentknap, TextField og Tom tilstand, som dashboardet skal bruge. De læses som første skridt i Fase B, før der skrives markup.
3. Skrifterne fra B2 (`docs/fonts/`, Outfit) udgår. Kittet har sine egne filer til Inter og JetBrains Mono.

## Sideeffekt-fund

- Grafikken fra ChatGPT bruger hjemmesidens cyan. Banner og social preview vises på GitHub, hvor hjemmesidens udtryk gælder, så de er rigtige. Mærkets egen farve betyder ikke noget i programmet, når det bruges som maske.
- `grimnir-maerke.svg` indeholder et `c2pa`-navnerum. Ikke undersøgt.

## Forslag til B3 (til beslutning, ikke en plan)

Dashboardet bygges om i kittets skal:

- **Titellinje:** Mimirs mærke som maske, navnet, og til højre sprog, tema og lås.
- **Handlingsbånd uden faner:** Opdatér, periode, indstillinger.
- **Navigationsrude:** Oversigt og derefter ét punkt pr. repository.
- **Arbejdsflade, Oversigt:** opsummeringen i klart sprog og en tabel med ét repository pr. række. En række åbner sit repository. Ingen samletal som pynt.
- **Arbejdsflade, repository:** grafen i kittets datafarver, og kittets tabel til release-filer og henvisninger.
- **Fodlinje:** at tallene bliver på computeren, og hvornår der sidst er indsamlet.
- **Bannere** til stoppet indsamling og ufuldstændig kørsel. **Dialog** til indstillinger. **Tom tilstand**, når intet er indsamlet.

Uændret: tal, sætninger, dekryptering, server, terminalvisning og de 69 tests.

---

**STOP. Venter på Jan + Cowork-Claude green-light.**
