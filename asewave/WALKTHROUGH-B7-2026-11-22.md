# WALKTHROUGH B7: opdatering, offentlig demo, vagten mod 60-dages-stoppet og formatløftet

Executor: Claude (Fable 5.2), 2026-11-22. Bygget efter `INVESTIGATION-B7-2026-11-22.md` og Jans svar samme dag. Udgangspunkt: commit `3b77d2a` på `main`.

## §C.0 Evidence

```
$ node --test     (asewave/evidence/74-npm-test-b7.txt, Node v22)
# tests 127
# pass 127
# fail 0

$ actionlint .github/workflows/collect.yml .github/workflows/test.yml     (75)
exit code: 0
(shellcheck var ikke installeret, så shell-linjerne i trinnene er ikke tjekket)

$ asewave/evidence/72-browser-flow-b7.json
"scenarios": 36, "checks": 186, "failed": 0
chrome 153.0.8010.12, firefox 159.0, webkit 27.2; hver i 1280x800 og 390x844

$ node src/update.mjs --check     (76, mod det rigtige repository, som ingen tags har)
Mimir 0.1.0: no version has been released yet.

$ node src/dashboard.mjs --demo --no-open, åbnet i Chrome     (77)
{"url":"local --demo","demoChip":true,"repos":true,"errors":[],"outsideRequests":[]}
```

Skærmbilleder, alle med opdigtede tal: `62` demoens forside i Chrome, `63` demoens dashboard, `64` og `65` Brønden i Firefox og WebKit, `66` til `68` Brønden i telefonbredde i de tre browsere, `69` forsiden i telefonbredde i WebKit, `70` og `71` beskeden om, at GitHub har sat indsamlingen på pause.

## Hvad der er bygget

| Fil | Ændring |
|---|---|
| `src/update.mjs`, `src/update-paths.json` | Ny kommando. Henter en tagget version fra `wi24rd-com/mimir` og erstatter Mimirs egne filer. Rører ikke `mimir.json`, README, `data`-grenen eller `docs/CNAME`. Committer intet. Afviser en ny hovedversion uden `--major`, en klon med ændringer, og en filliste, der peger uden for Mimirs egne filer |
| `.github/workflows/collect.yml` | Nyt job `keep-alive` med kun `actions: write`, som slår workflowet til igen ved hver kørsel. Nyt trin i indsamlingsjobbet, som kører `src/guard.mjs` |
| `src/guard.mjs` | Tæller dage siden sidste commit på `main`. Efter 45 dage i et offentligt repository åbnes én issue; den lukkes efter næste commit og gentages ikke |
| `docs/app.js`, `docs/index.html` | Når der ikke er indsamlet i 36 timer, spørger siden GitHub én gang, om workflowet er slået fra, og siger årsagen med en knap til Actions. CSP tillader nu `api.github.com`. `?demo` og `?demo=front` viser demoen på Pages. En tom kopi på Pages tilbyder demoen |
| `src/dashboard.mjs`, `src/show.mjs`, `src/lib/data.mjs` | Det lokale dashboard og terminalen spørger om det samme gennem `gh`, så det også virker for et privat repository |
| `docs/lib/demo.js`, `docs/lib/state.js` | Demotallene og tilstandens form er flyttet hertil, så browseren kan lave demoen. `src/lib/demo.mjs` og `src/lib/merge.mjs` peger videre |
| `src/setup.mjs` | Appen hedder nu `mimir-<konto>-<repository>`, højst 34 tegn, så to kopier på samme konto ikke får samme navn |
| `.github/workflows/test.yml` | Kører testene ved push til `main` og ved pull requests. Kun `contents: read`, action låst til commit |
| `test/format.test.mjs`, `test/fixtures/format-1/` | Formatløftet: filer skrevet af 0.1.0 (lavet med den urørte kode fra `3b77d2a`) skal kunne læses, åbnes og bygges videre på |
| `test/update.test.mjs`, `test/guard.test.mjs`, `test/setup.test.mjs`, `test/view.test.mjs` | 22 nye tests |
| `docs/lib/i18n.js` | Fem nye tekster på engelsk og dansk |
| `README.md`, `SECURITY.md` | Nyt afsnit "Updating" med formatløftet, link til demoen, de tre lag i vagten, hvad siden henter fra GitHub, hvilke browsere der er prøvet |

## Sådan er det afprøvet

**Opdateringen** er prøvet mod to midlertidige git-repositories uden fælles historik: en "skabelon" med versionerne 1.0.0, 1.1.0, en betaversion og 2.0.0, og en "kopi" med egen `mimir.json`, egen README, egen workflow og en `docs/CNAME`. Testene viser, at de nye filer kommer ind, at en fil, den nye version ikke har, forsvinder, at ejerens filer er urørte, at intet er committet, og at `git reset --hard` fører tilbage.

**Vagtens issue** er prøvet med stedfortrædere for `git` og `gh`: åbner én gang efter 45 dage, gentager ikke, lukker efter et commit, gør intet i et privat repository og intet, når GitHub ikke svarer.

**Pausebeskeden** er prøvet i de tre browsere på en adresse formet som Pages (`/mimir/`), hvor svarene fra `raw.githubusercontent.com` og `api.github.com` er lagt ind af testværktøjet: `disabled_inactivity`, `disabled_manually`, `active` og et afvist kald. Siden spurgte præcis én gang, om det rigtige workflow i det rigtige repository.

**Demoen** er prøvet de samme steder: den tomme kopi tilbyder den, alle fem visninger tegnes, forsiden viser Brønden med 14 sten, og demoen henter intet udefra.

## Deviation-liste

1. **Undersøgelsen sagde actionlint i `test.yml`.** Den er udeladt, fordi Mimir ikke henter noget udefra i sine workflows ud over de to låste actions. actionlint er kørt her i stedet (`75`).
2. **Fillisten kommer fra den version, man opdaterer til**, ikke fra den, man har. Ellers ville en ældre kopi aldrig få en ny fil uden for de kendte mapper. Listen tjekkes, før den bruges.
3. **Vagtens issue åbnes også, hvis lag 1 virker.** Der er ingen måde at aflæse GitHubs nedtælling på. Teksten siger, at intet er galt endnu.
4. **README's statuslinje øverst er ikke skrevet om.** Den skal rettes efter prøven med en rigtig kopi.
5. **WebKit meldte en politikfejl ved hvert skærmbillede.** Den kommer fra testværktøjet, som lægger et stilark ind, når det tager billedet, ikke fra siden (`73`). Den er talt for sig i `72` (4 gange) og ikke som fejl.
6. **Bygget i Claudes klon**, ikke i Jans mappe. Leveret til Jan som én fil med ændringerne.

## Kendte begrænsninger og uprøvet

- **Intet af dette har kørt på GitHub.** `keep-alive`, `guard.mjs` i en rigtig kørsel, `test.yml` og svaret fra `api.github.com` er ikke set for alvor. API'ets tilstandsnavn `disabled_inactivity` er skrevet efter GitHubs dokumentation; siden behandler enhver anden tilstand end `active` som "slået fra".
- **Om `keep-alive` forhindrer pausen, kan først ses efter 60 dage.**
- **`update.mjs` har aldrig hentet en rigtig version**, fordi der ingen tags er. Første rigtige prøve er fra 1.0.0 til den næste.
- **Demoen på Pages findes først, når Pages er slået til på skabelonen.** Indtil da fører README's to links til 404.
- **WebKit er ikke Safari.** Motoren er den samme, men Safari på en Mac eller iPhone er ikke prøvet. Android heller ikke.
- **"Use this template" fra bunden, badges og appnavnet ved to kopier** er stadig ikke prøvet for alvor. Det er næste skridt, og det kræver Jan.
- **Uautoriserede kald til `api.github.com` er begrænset til 60 i timen pr. adresse.** Siden spørger kun, når indsamlingen ser stoppet ud, og kun én gang pr. indlæsning.

---

**STOP. Ingen `git commit` eller `push` er udført. Jan kører blokkene.**
