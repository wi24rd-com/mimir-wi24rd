# WALKTHROUGH B3: dashboardet på Wi24rd UI Kit 2, klar til telefon

**Executor:** Claude (Fable 5.2), cloud-session
**Dato:** 2026-11-21
**Fase:** ASEWAVE Fase C for B-cyklus 3
**Green-light og beslutninger fra Jan 2026-11-21:** mærket er blågrønt ("vi kører med teal"), dashboardet skal være klar til telefon med det samme, engelsk først, licensen er Apache 2.

---

## §C.0 Evidence

```
$ ls -la asewave/evidence   (kun nye filer fra B3: bytes, navn)
 13623 15-npm-test-b3.txt
  1233 16-browser-flow-b3.json
 81859 17-overview-light-en.png
109305 18-repository-dark-en.png
 67529 19-phone-repository-dark.png
 63156 20-phone-overview-light-da.png
157333 21-settings-dark-da.png
 30857 22-unlock-dark-en.png
       23-actionlint-b3.txt

$ shasum -a 256 asewave/evidence/* | awk '{print $1}' | sort | uniq -d
(tom: ingen dubletter)
```

Første kørsel af dublet-tjekket fandt én dublet: `23-actionlint-b3.txt` var byte for byte lig `13-actionlint-b2.txt`, fordi begge kun indeholdt "actionlint exit=0". Filen fra B3 er skrevet om med version og kommando, og tjekket er derefter tomt.

Tests (`npm test`, Node v22.23.5, fuld suite):

```
# tests 75
# pass 75
# fail 0
exit=0
```

Break/fix på kit-kopien (ét mellemrum føjet til `docs/kit/kit.css`, derefter gendannet):

```
not ok 28 - no file in the kit copy has been edited
# pass 74
# fail 1
=== restored
# tests 75
# pass 75
# fail 0
```

Kit-kopien mod kilden på Jans Mac (SHA-256 målt på Mac'en i `Grimnir/design/ui-kit-2/pakke/` og i kopien):

```
eac798fa9779897130f4144d40b31c6cc26cc3837b074f7c38af2906875c513f  kit.css
15b28a58cdefab1381b07309fc7a86ca3f346920b5b94fa5b77970942196c8be  kit.js
bdc0c075c63c88a26cefef2638b3142cf6a64928427c27924602d1f36cb99860  tema.js
5dd9bd4353162b88034caa353f1d17aa686e903c13e7e67f7899c103d90ab5f1  sprogmotor.js
8c9da687ebfedcf1166b88db19463f2415b5654d3fa8e5c4639d47cbb62307dd  tokens.css
→ kit copies match the hashes measured on the Mac
```

Rigtig browser (Google Chrome, headless) mod `node src/dashboard.mjs --demo --encrypted`. Uddrag af `16-browser-flow-b3.json`:

```
"lang": "en"
"unlockTitle": "Open your figures"
"wrong": "That passphrase does not open the file. Check for a missing character and try again."
"stillLocked": true
"unlockMs": 168
"storage": "{\"local\":{},\"session\":{}}"
"fonts": ["Inter", "JetBrains Mono"]
"accent": "#35D6B3"
"markColor": "rgb(53, 214, 179)"
"repoTitle": "example/lantern"
"tooltip": "14 Nov | Views | 20 (8 unique) | Clones | 2 (1 unique)"
"line1": "rgb(111, 165, 255)"
"langAfter": "da"
"storageAfterLang": "{\"mimir-sprog\":\"da\"}"
"afterRefreshStillOpen": true
"copyDisabled": true
"lockedAgain": true
"problems": []
"external": []
```

`problems` er konsollens fejl og advarsler, herunder brud på indholdspolitikken. `external` er forespørgsler til andet end `127.0.0.1`. Begge er tomme. `markColor` er kittets `--accent-on-rail`, og `line1` er kittets `--data-1` i mørkt tema.

Alle skærmbilleder viser opdigtede tal for tre opdigtede repos.

---

## Hvad der er bygget

| Del | Fil | Status |
|---|---|---|
| Kittet, kopieret uændret (2.8.0, 14 filer med licenser og skrifter) | `docs/kit/` | Hashes lig kilden; test vogter kopien |
| Siden i kittets skal: titellinje, bånd, navigationsrude, arbejdsflade, fodlinje | `docs/index.html`, `docs/app.js` | Testet i Chrome |
| Mimirs egen stil, kun med kittets tokens | `docs/app.css` | Test afviser farvekoder |
| Smal udgave under 900 px | `docs/app.css`, `docs/app.js` | Skærmbilleder ved 390 px |
| Mærket som maske i titellinjen | `docs/mimir-mark.svg`, `docs/app.css` | Målt farve `rgb(53, 214, 179)` |
| Engelsk først, dansk som valg, via kittets sprogmotor | `docs/lib/i18n.js` | Testet |
| Licens og NOTICE | `LICENSE`, `NOTICE`, `package.json` | Apache-2.0 |
| README opdateret, nyt skærmbillede | `README.md`, `assets/dashboard-demo.png` | Ikke set gengivet på GitHub |

Fjernet: `docs/style.css` og `docs/fonts/` (hjemmesidens skrifter). De er stadig sporet i Jans repo og fjernes med `git rm` i commit-blokken.

## Status pr. punkt

| Punkt | Status |
|---|---|
| Dashboardet følger softwarens designsystem | Implementeret: kittets komponenter, tokens, skrifter, tema og sprog |
| Mærket i teal | Implementeret som maske; kittet farver det |
| Klar til telefon | Implementeret: under 900 px skjules navigationsruden, en valgliste tager over, og kasserne står i én kolonne |
| Engelsk først | Implementeret: standard er engelsk, valget huskes |
| Licens Apache 2 | Implementeret |
| "Ingen pynt med tal" | Rækken med fire samletal er fjernet. Oversigten er sætningerne og en tabel, hvor hver række åbner sit repository |
| Tillid i fodlinjen | Implementeret: "Decrypted in this browser. Nothing is sent anywhere." |
| Pages | Koden er klar. **Ikke kørt**: kræver, at repoet gøres offentligt |

Kittets komponenter i brug: AppShell, CommandBar uden faner, Segmentknap, NavPane, DataTable med rulleramme, Kasse, Banner, Tom tilstand, TextField, Button, Valgliste, Radiogruppe, Afkrydsning, Dialog, StatusFooter, ikoner, Tema og Sprog.

## Deviation-liste

1. **Mindstemålet er sat ned til 320 × 420 px.** Kittet lover 900 × 560 og har ingen smal udgave. Mimir bruger kittets egen variabel (`--vindue-min-bredde`) og lægger en smal opstilling i sin egen CSS. Under 900 px er det altså Mimirs opstilling og ikke en, kittet har målt. Godkendt af Jan ("lav det klar til telefon").
2. **Engelsk er standardsprog.** Kittet siger "dansk først". Godkendt af Jan ("Engelsk først").
3. **Adgangsfrasen huskes i fanens hukommelse**, så "Fetch again" kan åbne den nye fil uden at spørge igen. Den gemmes ikke i browserens lager (se `storage` ovenfor), og låsen i titellinjen glemmer den. I B2 blev den ikke husket. Ikke godkendt på forhånd.
4. **Feltet til adgangsfrasen er kittets tekstfelt med typen ændret til `password`.** Kittets `Kit.felt` laver altid `type="text"`.
5. **Sprogknappen i titellinjen viser "EN" eller "DA" som tekst**, ikke et ikon. Kittets `.rk` er tænkt til ikoner.
6. **Grafen er Mimirs egen.** Kittet har ingen diagramkomponent; grafen bruger kittets datafarver og regler.
7. **Kittets mørke datafarver består ikke dataviz-skillens lysstyrketjek** (se undersøgelsen). Kittet er fulgt.
8. **Et eget ikon** (`opdater`) er registreret, fordi kittet ikke har et for "hent igen".
9. **Fejlteksten ved ugyldig indstilling er stadig på engelsk** i dansk visning.
10. **Undersøgelsen blev færdiggjort i denne fase.** De afsnit af `KOMPONENTER.md`, der manglede i Fase A, er læst før brug: mindstemål, CommandBar, NavPane, StatusFooter, DataTable, StatusChip, Button, TextField, Banner, Segmentknap, Kasse, Tom tilstand, Valgliste, Dialog, Ikoner, Afkrydsning og Radiogruppe. Ikke læst: Wizard, Fletbaand, Vælger ud over de første linjer, Sidepanel, Filterchip, StatusTile ud over det citerede, Fremdrift, Værktøjstip, Kontakt og Tekststørrelse. Ingen af dem bruges.

## Kendte begrænsninger og uprøvede antagelser

- **Jan har ikke set B3 endnu**, og dashboardet er ikke kørt mod de rigtige data i denne udgave.
- **Kun Chrome.** Safari og Firefox er ikke prøvet. Masken til mærket og `100dvh` er de to steder, jeg ville se efter først.
- **Telefonen er kun prøvet som et smalt Chrome-vindue på 390 px**, ikke på en rigtig telefon.
- **Pages er ikke kørt.** Ukendt: om `raw.githubusercontent.com` leverer `state.enc` fra `data`-grenen som forventet, og hvor længe svaret caches (proben i B2 viste 300 sekunder).
- På en smal skærm ruller handlingsbåndet vandret, og "Fetch again" står delvist uden for kanten, indtil man ruller.
- Værnet mod 60-dages-stoppet er stadig ikke bygget. Det bliver relevant, når repoet er offentligt.
- `git ls-files` i Jans repo vil vise `docs/style.css` og `docs/fonts/` som ændret eller slettet, til commit-blokken er kørt.

## Læste regelfiler

- `Grimnir/design/ui-kit-2/README.md` og `pakke/README.md`
- `pakke/KOMPONENTER.md`: afsnittene nævnt i afvigelse 10
- `pakke/web/kit.js` (hjælperne `el`, `tekstAf`, `aria`, `felt`, `banner`, `navTrae`, `valgliste`, `kasse`), `tema.js`, `sprogmotor.js`
- `Grimnir/ui/index.html` (indlæsningsrækkefølge og mærke), `Grimnir/NOTICE`, `Huginn-Muninn/NOTICE`
- Skills: `asewave-walkthrough`, `dataviz`, `frontend-design`, `husk-sti`, `git-fast-tidsstempel`, `wi24rd-github-excellence`

---

## Tillæg: topmenu og knapper som i de andre programmer (2026-11-21)

Jan så B3 og skrev: "Det ligner ikke de andre ting, som vi har lavet i forhold til topmenu og knapper." Det var rigtigt. Jeg havde bygget efter kittets dokumentation uden at se på, hvordan Grimnir og Huginn and Muninn bruger kittet.

Læst før rettelsen: `Grimnir/ui/index.html` og `ui/assets/app.js` (båndets kald), `Huginn-Muninn/ui/assets/ramme.js` (båndets grupper og periodeknapper) og `ui/index.html`, Grimnirs skærmbillede `docs/manual/img/sager--light-en-1200x860.png`, og afsnittene om visninger som båndets faner og om Mere i `KOMPONENTER.md`.

Evidence:

```
$ npm test   (asewave/evidence/24-npm-test-b3-top.txt)
# tests 78
# pass 78
# fail 0

$ uddrag af asewave/evidence/25-browser-flow-b3-top.json
"tabs": ["Overview*", "Traffic", "Downloads", "Sources"]
"groups": ["Figures", "Period"]
"commands": ["Fetch again (primary)", "14 days (pressed)", "30 days", "90 days", "Everything", "More"]
"titleButtons": ["Skift til dansk", "Lock the figures", "Theme: Follow system. Change theme", "Open settings"]
"hash": "#traffic"
"tooltipAll": "14 Nov | Views | 28 | Clones | 3"
"problems": []
"external": []
```

Dublet-tjekket over hele `asewave/evidence/` er tomt. Nye skærmbilleder: `26` til `30`.

Ændret, så det følger de to programmer:

| Før (B3) | Nu | Forbillede |
|---|---|---|
| Bånd uden faner, med en segmentknap | Visningerne som båndets faner: Overview, Traffic, Downloads, Sources | Grimnir og Huginn and Muninn (`visninger: { som: 'faner' }`) |
| Én lille kommando | Kommandoer med ikon over ord i navngivne grupper; "Fetch again" er den primære | Begge programmer |
| Periode som segmentknap | Periode som fire knapper med kalenderikon, den valgte trykket ind | Huginn and Muninn (`gPeriode`) |
| Ingen Mere | Mere samler det, der ikke er plads til på én række | Begge programmer |
| Kun ikoner i titellinjen | Ordknapper ("Dansk", "Lock") ved siden af ikonerne, og en kort linje efter navnet | Grimnir ("Guide", "Lock") og Huginn and Muninn (`<small>`) |
| Navigationsruden skiftede side | Navigationsruden filtrerer: alle repositories eller ét, i alle fire visninger | Grimnirs træ |
| Tabeller i kasser | Værktøjslinje med en oplysningschip, tabellen direkte på fladen og en forklarende linje under | Grimnirs Sager-visning |
| Fodlinje med én tekst | Antal og tidspunkt til venstre; "Only in this browser" og version til højre | Grimnir |

Nyt som følge af opbygningen: en graf for alle repositories lagt sammen (uden unikke besøgende, som ikke kan lægges sammen), og en tabel med de mest viste sider.

Nye afvigelser:

11. **Fanerne skifter via adressen** (`#traffic`), som i de to programmer. Filteret i navigationsruden står ikke i adressen.
12. **Hele skallen tegnes om ved hvert skift.** Fokus flytter sig derfor ikke med, når man skifter fane eller periode med tastaturet. De to programmer bygger skallen én gang. Kendt svaghed, ikke rettet.
13. **Tre regler i Mimirs egen CSS følger programmerne og ikke kittet:** `.titel small`, ordknappen i titellinjen og accentkanten på en trykket periodeknap. Huginn and Muninn og Grimnir har tilsvarende regler i deres egen CSS.
14. Ingen genveje (⌘1 til ⌘4) til fanerne. Begge programmer har dem; i en browser ville de kollidere med browserens egne.

Jan har også luftet et helt andet, "vildt futuristisk" design i samme farver. Det blev til én signaturvisning oven på det rolige program; se tillægget herunder.

## Tillæg: Brønden / The Well (2026-11-21)

Jan valgte mulighed 1 (én signaturvisning oven på det rolige program), så en prototype med opdigtede tal, og svarede "Ja nummer 1". Det er læst som et rent ja: Brønden lægges ind, som prototypen viste den.

### §C.0 Evidence

```
$ ls -la asewave/evidence/3[1-6]*
16113 asewave/evidence/31-npm-test-well.txt
2135 asewave/evidence/32-browser-flow-well.json
275334 asewave/evidence/33-well-dark-en.png
268627 asewave/evidence/34-well-light-en.png
131011 asewave/evidence/35-well-phone-dark.png
294597 asewave/evidence/36-well-reduced-motion.png

$ shasum -a 256 asewave/evidence/* | awk "{print \$1}" | sort | uniq -d   (skal være tom)
(slut)

$ npm test | tail -9   (asewave/evidence/31-npm-test-well.txt)
1..87
# tests 87
# suites 0
# pass 87
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2358.586841

$ node --test test/well.test.mjs | grep -c "^ok"
9

$ uddrag af asewave/evidence/32-browser-flow-well.json   (demo, krypteret, Chrome uden skærm)
"tabs": ["Overview*", "Traffic", "Downloads", "Sources", "The Well"]
"wellTab": "The Well"
"wellStones": 90
"wellChip": "i90 days"
"wellSources": ["lantern: 3,721 views, 491 clones, +138 downloads", "quill-notes: 1,051 views, 134 clones, +25 downloads", "tidepool: 325 views, 37 clones, +0 downloads"]
"wellTableRows": 3
"wellScale": ["No views", "1–82", "83–163", "164–244", "245–325", "326–406"]
"wellColors": {"pulse": "rgb(53, 214, 179)", "ring": "rgb(111, 165, 255)", "clone": "rgb(255, 176, 102)", "drop": "rgb(185, 161, 255)"}
"wellTooltip": "lantern | Views | 3,721 | Clones | 491 | Downloads | +138"
"wellHashAfterEnter": "#well"
"wellDimmed": 2
"wellTreeCurrent": "lantern3,721"
"wellReducedMotion": {"ring": "none", "dot": "absent"}
"tabsDa": ["Oversigt", "Trafik", "Downloads", "Kilder", "Brønden"]
"problems": []
"external": []
```

Skærmbilleder: `33` mørk med fokus på et repository, `34` lys, `35` telefon (390 px), `36` med "mindre bevægelse" slået til. Alle med opdigtede tal fra `--demo`.

Scope kan ikke vises med `git status` her, fordi arbejdskopien hos Claude ikke er et git-repo. Jans `git status` i hans egen mappe er beviset; se overdragelsen.

### Hvad der er bygget

| Fil | Ændring |
|---|---|
| `docs/lib/well.js` | Ny. Rene funktioner: skalatrin, niveau pr. dag, antal ringe (1 til 5, kvadratrodsskala), antal dråber (højst 12), kantens sten, punkternes placering, pulslinjens sti |
| `test/well.test.mjs` | Ny. 9 tests af funktionerne ovenfor |
| `docs/app.js` | Femte fane `well`, placeret til højre; `wellView` tegner billedet som SVG med tabel og forklaring ved siden af |
| `docs/app.css` | Brøndens udseende, kun med kittets tokens; stillestående udgave ved `prefers-reduced-motion`; fanerne på smal skærm |
| `docs/lib/i18n.js` | Tekster på engelsk og dansk |
| `README.md` | Afsnittet om dashboardet nævner de fire faner og Brønden (det sagde før "one page per repository", som ikke passede efter topmenu-rettelsen) |

Hvad billedet viser: én sten pr. dag på kanten, farvet efter visninger med kittets `--seq-1..5`; en linje over vandet for visninger pr. dag i `--accent`; ét punkt pr. repository med 1 til 5 ringe (`--data-1`), en stiplet ring ved kloninger (`--data-2`) og dråber for downloads i perioden (`--data-3`). Periode og repository-filter virker som i de andre faner. De samme tal står i tabellen ved siden af, og skalaen har tal på hvert trin.

### Afvigelser

15. **Pulslinjen zigzagger.** Højden er dagens visninger; om et udsving går op eller ned, skifter bare hver dag og betyder intet. Det er pynt, valgt for at ligne mærket. Jan er gjort opmærksom på det og har sagt ja til prototypen.
16. **Brønden bryder bevidst kittets ro** (bevægelse, glød). Den er holdt til én fane; resten af programmet er uændret.
17. **Højst 12 dråber pr. repository.** Flere downloads vises kun som tal i tabellen og i tooltip.
18. **Den vandrende prik på linjen findes ikke ved "mindre bevægelse"**; ringe og dråber står stille og er alle synlige.

19. **Fejl under overførslen, rettet.** Claudes arbejdskopi havde en tom `.git`-mappe, som kom med i transportfilen. Derved blev `.git/config` og tre inaktive eksempel-hooks (`commit-msg.sample`, `fsmonitor-watchman.sample`, `pre-commit.sample`) i Jans mappe overskrevet. `.git/config` er genskabt med origin (`https://github.com/wi24rd-com/mimir.git`, adressen fra `.git/FETCH_HEAD`), sporing af `main`, noreply-mailen og de to macOS-standardværdier `ignorecase` og `precomposeunicode`. De to sidste og en eventuel lokal `user.name` eller `fasttid.klokken` kunne ikke læses tilbage og er dermed et kvalificeret gæt. Historik, grene, `post-commit` og `pre-push` blev ikke rørt; `sh tools/fast-tid.sh check` afslutter med 0 efter rettelsen.

### Kendte begrænsninger

- Ved 90 dage bliver kanten tæt og linjen meget sammenpresset (`36`). Én travl dag gør de øvrige sten næsten ens.
- Linjen kan krydse et punkts navn.
- Kun prøvet i Chrome uden skærm. Safari, Firefox og en rigtig telefon er ikke prøvet.
- Kun prøvet med opdigtede tal, ikke med Jans rigtige.
- Svagheden fra punkt 12 (hele skallen tegnes om) gælder også her: fokus bliver ikke på punktet, når man vælger et repository med Enter.

---

**STOP. Ingen `git commit` eller `push` er udført. Jan committer efter gennemgang.**
