# WALKTHROUGH B5: klar til offentliggørelse som skabelon

Executor: Claude (Fable 5.2), 2026-11-21. Jan valgte "grundigt" og "del i 2": programmet i et nyt, rent, offentligt repository, som er en skabelon, og hans egen opsætning i et repository lavet fra skabelonen.

## §C.0 Evidence

```
$ npm test | tail     (asewave/evidence/52-npm-test-b5.txt)
# tests 103
# pass 103
# fail 0
```

Resten står i `asewave/evidence/53-template-checks.txt`: actionlint uden fund, den medfølgende `mimir.json`, vagten i workflowen, og en søgning, der viser nul forekomster af Jans tal, Claudes arbejdssti og klokkeslættet.

## Gennemgang før offentliggørelse (sikkerhed, OPSEC, GitHub)

| Fund | Alvor | Handling |
|---|---|---|
| Jans rigtige tal stod i klar tekst i `WALKTHROUGH-B2` | Høj: modsiger krypteret tilstand | Fjernet |
| Arbejdssti og et rigtigt klokkeslæt i den første undersøgelse | Middel: afslører arbejdstid | Fjernet |
| De samme ting ligger i alle tidligere commits | Høj | Nyt repository med én ren commit; det gamle arkiveres privat |
| `data`-grenens commits, Actions-kørsler og et issue viser tider fra opsætningsdagen | Middel | Følger ikke med til det nye repository |
| En frisk kopi kørte indsamlingen før opsætning og oprettede et fejl-issue | Middel | Vagt i workflowen: jobbet springes over, indtil opsætningen har gemt sin variabel |
| En fork tager ejerens krypterede `data`-gren med | Middel | README siger "Use this template"; repositoryet gøres til skabelon |
| Ejerens egne repositories stod i `mimir.json` | Lav | Erstattet af et eksempel, som opsætningen nægter at køre med |
| Ingen sikkerhedspolitik | Lav | `SECURITY.md` |
| Hemmeligheder, tokens, nøgler | Ingen fundet | Søgt i filer og historik |
| Actions låst til commit, mindste rettigheder, ingen utroværdig tekst i `run:` | I orden | Ingen ændring |

## Hvad der er ændret

| Fil | Ændring |
|---|---|
| `mimir.json` | Eksempel: `your-account/your-repository` |
| `docs/lib/config.js`, `src/config.mjs`, `src/setup.mjs` | `EXAMPLE_REPO`; opsætningen stopper med en forklaring, hvis eksemplet ikke er erstattet |
| `.github/workflows/collect.yml` | `if: vars.MIMIR_APP_CLIENT_ID != ''` på jobbet |
| `README.md` | Opsætning via "Use this template", hvorfor ikke fork, hvordan Pages slås til |
| `SECURITY.md` | Ny |
| `test/config.test.mjs` | Ny test: den medfølgende `mimir.json` er eksemplet |
| `asewave/WALKTHROUGH-B2-2026-11-21.md`, `asewave/INVESTIGATION-2026-11-21.md` | Renset som beskrevet |

## Deviation-liste

1. Ingen særskilt undersøgelse (Fase A) for B5. Fundene kom af gennemgangen, og Jan traf de to valg i samtalen.
2. Privat sårbarhedsrapportering, som `SECURITY.md` henviser til, skal slås til i repositoryets indstillinger. Det er ikke gjort endnu.
3. En kopi følger ikke skabelonen. Opdatering sker ved at kopiere filer over. Der er ikke bygget noget til det.
4. `tools/fast-tid.sh` og mappen `asewave/` følger med til alle, der bruger skabelonen.

5. **Commits på `data`-grenen bærer nu kun datoen** (midnat UTC), så grenen ikke viser, hvornår en indsamling blev kørt eller startet med hånden. Tilføjet efter offentliggørelsen, før Jans egen opsætning. Listen over kørsler under Actions viser stadig tidspunkterne.

6. **Efter første prøve på en rigtig iPhone (Brave, på Pages):** den femte fane var klippet over. Fanerækken er gjort tættere på smalle skærme og passer nu fra 375 px; under det kan den rulles (`54`). Vejledningen i telefon-dialogen siger nu, at ikonet på hjemmeskærmen laves i Safari, og at andre browsere på iPhone måske ikke kan.
7. **README har fået nye billeder** af demoen i `assets/screens/`: oversigten i lys og mørk, Brønden, trafikgrafen, og tre i telefonbredde. Det gamle `assets/dashboard-demo.png` er fjernet.

## Uprøvet

- Vagten i workflowen er kun tjekket med actionlint. Den er ikke set springe et job over på GitHub.
- "Use this template", opsætning i et nyt repository og Pages er ikke kørt.
- At gamle commits kan hentes efter en omskrivning, er Claudes viden om GitHub og ikke slået op denne dag. Det nye repository gør spørgsmålet uden betydning.

---

**STOP. Ingen `git commit` eller `push` er udført. Jan kører blokkene.**
