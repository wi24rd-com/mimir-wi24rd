# WALKTHROUGH B2: se tallene (terminal og dashboard)

**Executor:** Claude (Fable 5.2), cloud-session
**Dato:** 2026-11-21
**Fase:** ASEWAVE Fase C for B-cyklus 2
**Green-light:** givet af Jan 2026-11-21: "gå i gang og lav så meget som overhovedet muligt, også ud over B2a". Skrifttyper lægges i repoet. Passphrasen spørges der om i terminalen; nøglering venter.

---

## §C.0 Evidence

```
$ ls -la asewave/evidence   (kun nye filer fra B2)
-rw-r--r-- 1 root root  11857 Nov 21 11:47 05-npm-test-b2.txt
-rw-r--r-- 1 root root   1035 Nov 21 11:47 06-browser-flow.json
-rw-r--r-- 1 root root 103803 Nov 21 11:47 07-dashboard-hover-light-da.png
-rw-r--r-- 1 root root  29928 Nov 21 11:47 08-unlock-light-da.png
-rw-r--r-- 1 root root 125860 Nov 21 11:47 09-settings-light-da.png
-rw-r--r-- 1 root root  62467 Nov 21 11:47 10-mobile-dark-en.png
-rw-r--r-- 1 root root  91346 Nov 21 11:47 11-dashboard-dark-en.png
-rw-r--r-- 1 root root    960 Nov 21 11:47 12-show-demo-da.txt
-rw-r--r-- 1 root root     18 Nov 21 11:47 13-actionlint-b2.txt

$ shasum -a 256 asewave/evidence/* | awk '{print $1}' | sort | uniq -d
(tom: ingen dubletter)
```

Tests (`npm test`, Node v22.23.5, fuld suite):

```
# tests 66
# pass 66
# fail 0
exit=0
```

Rigtig browser (Google Chrome, headless, styret med puppeteer-core uden for repoet) mod `node src/dashboard.mjs --demo --encrypted`. Uddrag af `06-browser-flow.json`:

```
"unlockTitle": "Åbn dine tal"
"wrong": "Adgangsfrasen åbner ikke filen. Tjek, om der mangler et tegn, og prøv igen."
"stillLocked": true
"unlockMs": 175
"headline": "699 visninger og 88 kloninger i de seneste 14 dage."
"storage": "{\"local\":{},\"session\":{}}"
"tooltip": "14. nov. | Visninger | 20 (8 unikke) | Kloninger | 2 (1 unikke)"
"keyboardTip": "20. nov."
"invalid": "Ikke gyldig endnu: \"not a repo\" is not a valid \"owner/name\""
"copyDisabled": true
"problems": []
"external": []
```

`problems` er konsollens fejl og advarsler, herunder brud på sidens indholdspolitik. `external` er alle forespørgsler til andet end `127.0.0.1`. Begge er tomme.

Farverne i graferne, tjekket med `validate_palette.js` fra dataviz-skillen:

```
dark  #0ea5c4,#d17a22 på #0f1b30  → ALL CHECKS PASS   (værste par ΔE 20.5 ved protanopi)
light #0891b2,#c2570c på #ffffff  → ALL CHECKS PASS
```

Workflow-lint: `actionlint exit=0` (version 1.7.12).

Terminalvisningen (`12-show-demo-da.txt`, opdigtede tal):

```
Wi24rd Mimir  Sidst indsamlet for 3 timer siden

699 visninger og 88 kloninger i de seneste 14 dage.
lantern havde flest besøgende (499 visninger).
De fleste kom fra news.ycombinator.com.
Release-filer blev hentet 8 gange; lantern-2.1.0-windows.exe oftest (5).
```

Alle skærmbilleder viser opdigtede tal for tre opdigtede repos (`example/...`). Ingen rigtige tal, navne eller hemmeligheder.

---

## Hvad der er bygget

| Del | Fil | Status |
|---|---|---|
| Terminalvisning i klart sprog, dansk og engelsk | `src/show.mjs` | Testet. Ikke kørt mod Jans rigtige data |
| Dashboard på `127.0.0.1` | `src/dashboard.mjs`, `docs/` | Testet i rigtig browser med opdigtede tal |
| Dekryptering i browseren | `docs/lib/open.js` | Testet i Node og i Chrome |
| Tal og sætninger, fælles for terminal og dashboard | `docs/lib/summary.js`, `docs/lib/i18n.js` | Testet |
| Indstillingspanel, der skriver en ny `mimir.json` | `docs/app.js` | Testet i browser |
| Læsning af `data`-grenen via git | `src/lib/data.mjs` | Testet mod et rigtigt git-repo oprettet i testen |
| Opdigtede tal til demo og skærmbilleder | `src/lib/demo.mjs` | Testet |
| Skrifttyper i repoet (Outfit, JetBrains Mono, OFL-1.1) | `docs/fonts/` | Hentet fra npm-pakkerne `@fontsource-variable/*` 5.3.0, licensfiler lagt ved |
| Rettet optælling i loggen | `src/collect.mjs` | Testet |
| Vellykket kørsel lukker fejl-issuet | `.github/workflows/collect.yml` | Lint bestået. **Ikke kørt** |
| Dashboard på GitHub Pages | `docs/app.js` (`locate`) | Skrevet. **Aldrig kørt**, repoet er privat |

## Status pr. punkt

| Punkt | Status |
|---|---|
| B2a.1 Ret optællingen | Implementeret: "26 of 26 requests succeeded, 4 skipped" |
| B2a.1 Luk fejl-issuet ved succes | Implementeret, uprøvet |
| B2a.2 `show` i terminalen | Implementeret |
| B2a.3 Dashboard lokalt | Implementeret |
| Skrifttyper i repoet | Implementeret |
| Passphrase: spørg i terminalen, ingen nøglering | Implementeret. `MIMIR_PASSPHRASE` kan også bruges |
| Dansk og engelsk | Implementeret, test sikrer at begge sprog har de samme tekster |
| Lyst og mørkt tema | Implementeret |
| Tabelvisning af hver graf, tastaturbetjening | Implementeret |
| Advarsel, når indsamlingen er stoppet (36 timer) | Implementeret i terminal og dashboard |
| B2b Pages | Forberedt, uprøvet |
| Grafik fra ChatGPT | Bestilt. Ikke koblet på; favicon er en pladsholder |
| Profilkort i SVG, værn mod 60-dages-stop | Ikke bygget |

## Deviation-liste

1. **Accentfarven i lyst tema er `#8a3322`**, som designgrundlaget angiver. Den bruges til ordmærkets "24", links og fokusramme. Jeg har fulgt dokumentet, men farven ser fremmed ud ved siden af cyan. Til vurdering.
2. **Grafernes linjefarver er ikke brandets cyan `#2fe0ff`.** Den faldt uden for det lysstyrkeinterval, validatoren kræver. Graferne bruger `#0ea5c4` og `#d17a22` (mørkt) og `#0891b2` og `#c2570c` (lyst). Brandfarven bruges fortsat i resten af siden.
3. **Dashboard-filerne ligger i `docs/`**, ikke i `dashboard/`. Så kan Pages senere pege direkte på mappen uden et ekstra workflow.
4. **Valideringen af `mimir.json` er flyttet** til `docs/lib/config.js`, så indsamler, opsætning og indstillingspanel bruger samme regler. `src/config.mjs` videresender.
5. **Fejlteksten ved ugyldig indstilling er på engelsk** også i dansk visning (se `invalid` ovenfor).
6. **Etiketter i versaler med mono-skrift** er brugt få steder, fordi designgrundlaget foreskriver dem.
7. **Browsertesten ligger ikke i repoet.** Den kræver puppeteer-core, og repoet skal forblive uden afhængigheder. Beviset er `06-browser-flow.json` og skærmbillederne.
8. **`--demo --encrypted`** har en fast, offentlig demo-passphrase i koden. Den beskytter kun opdigtede tal.
9. Ud over aftalt omfang: indstillingspanelet, Pages-forberedelsen og `--demo`.

## Kendte begrænsninger og uprøvede antagelser

- **Intet i B2 er kørt mod Jans rigtige data.** Jeg kan ikke læse det private repo. Første rigtige prøve er `node src/show.mjs` på Jans Mac.
- **Kun testet i Chrome.** Safari og Firefox er ikke prøvet.
- Nøgleafledningen tog 175 ms i Chrome på denne maskine. En telefon er langsommere; ikke målt.
- Pages-vejen (hente `state.enc` fra `raw.githubusercontent.com`) er skrevet ud fra CORS-proben i undersøgelsen, men aldrig kørt.
- Den skjulte indtastning af passphrasen i terminalen er ikke testet automatisk; den kræver en rigtig terminal.
- Med kun én dags data viser grafen et enkelt punkt. Det er sådan, Jans første visning vil se ud.
- Indstillingspanelet kan ikke gemme. Brugeren kopierer filen og gemmer den på GitHub. Det er bevidst (undersøgelse B1, spørgsmål 5).
- Linket "Åbn mimir.json på GitHub" antager, at standardgrenen hedder `main`.

## Læste regelfiler

- Skills: `dataviz`, `frontend-design`, `asewave-walkthrough`, `husk-sti`, `git-fast-tidsstempel`, `wi24rd-github-excellence`
- Projektdokument: `claude/design-grundlag.md`
- `validate_palette.js` fra dataviz-skillen (kørt, ikke kun læst)

---

**STOP. Ingen `git commit` eller `push` er udført. Jan committer efter gennemgang.**

---

## Tillæg efter Jans første kørsel (2026-11-21)

Jan kørte `node src/show.mjs --lang da` mod de rigtige data. Tallene er udeladt her, fordi de er krypterede i Jans opsætning. Terminalvisningen virker altså mod rigtige, krypterede data. Dashboardet er endnu ikke bekræftet af Jan.

Evidence for tillægget:

```
$ npm test   (asewave/evidence/14-npm-test-b2-tillaeg.txt)
# tests 69
# pass 69
# fail 0
```

Ændret efter kørslen:

1. **Download-sætningen var misvisende.** Når alle filer først er set inde i perioden, skriver Mimir nu, hvornår tællingen begyndte, i stedet for "Ingen nye downloads". Terminalen markerer sådanne rækker med `*` og en forklaring.
2. **Unikke pr. dag vises.** Terminalen har to nye kolonner med det højeste antal unikke på én dag, og dashboardets forklaring til grafen viser det samme tal. Unikke kan ikke lægges sammen over dage, så det er døgnets maksimum og ikke en sum.
3. **Grafikken fra ChatGPT er lagt i `assets/`** (mærke som SVG og PNG, to bannere, social preview). Banneret står øverst i README i lys og mørk udgave. Mærket bruges som ikon i dashboardet. De tre `outlined-masters` på 2,4 MB hver er ikke lagt i repoet.

### Fejl i designvalget (fundet af Jan)

**Dashboardet følger det forkerte designsystem.** Jeg brugte `claude/design-grundlag.md`, som beskriver hjemmesidens udtryk (Outfit, cyan på navy). Samme dokument siger, at app-kittet (Wi24rd UI Kit 2: Inter og teal) hører til inde i programmerne. Dashboardet er et program og skulle have brugt kittet.

Kittet ligger i `Grimnir/design/ui-kit-2/pakke/` (version 2.8.0, Apache-2.0) med tokens, komponenter, tema, sprogmotor, skrifter og vejledning til at tage det i brug. Det har egne farver til dataserier (`--data-1` til `--data-6`), så afvigelse 1 og 2 ovenfor bortfalder, når dashboardet flyttes over.

Konsekvens: `docs/style.css`, skrifterne i `docs/fonts/` og dele af `docs/app.js` skal laves om. Logikken (tal, sætninger, dekryptering, server, tests) berøres ikke. Det er B3 og kræver sin egen undersøgelse af `KOMPONENTER.md`.

README-banneret og social preview følger hjemmesidens udtryk, og det er rigtigt efter designgrundlaget, fordi de vises på GitHub.

**STOP. Ingen `git commit` eller `push` er udført.**
