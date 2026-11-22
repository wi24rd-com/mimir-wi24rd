# WALKTHROUGH B9: setup følger første indsamling, og Brønden er det første, man møder

Executor: Claude (Fable 5.2), 2026-11-22. To ting fra Jans anden prøve med `mimir-proeve`: første indsamling fejlede, uden at setup sagde det, og Jan bad om, at Brønden bliver forsiden med en graf pr. repository under. Udgangspunkt: commit `2a0dfc9` på `main`.

## §C.0 Evidence

```
Jans udskrift fra den rigtige kørsel (mimir-proeve, 2026-11-22):
X  Collect                     Collect                 main  workflow_dispatch
✓  pages build and deployment  pages-build-deployment  main  dynamic
✓  Follow my repositories      Test                    main  push
✓  Initial commit              Test                    main  push
collect  Get a short-lived token      url: 'https://api.github.com/users/wi24rd-com/installation',
collect  Get a short-lived token      status: 404,
collect  Get a short-lived token  ##[error]Not Found - .../apps#get-a-user-installation-for-the-authenticated-app

$ node --test     (asewave/evidence/88-npm-test-b9.txt, Node v22)
# tests 150
# pass 150
# fail 0

$ asewave/evidence/87-well-first-three-browsers.json     (chrome, firefox, webkit; 1440x900 og 390x844)
alle seks: "landsOn": "well", "cards": 3, "charts": 3, "overflowX": false, "frontHasCards": 0, "errors": []
computer, alle tre: "cardsWhenOnePicked": 1, "headingWhenOnePicked": "This repository", "detailsLeadsTo": "#traffic"
```

## Hvad Jans prøve beviste for alvor

- `install.sh` oprettede og klonede kopien, og setup startede i den.
- Guiden gemte, committede og pushede `mimir.json` (7 offentlige repositories, `public`, alle fire udgivelser).
- `test.yml` kørte grønt to gange på GitHub.
- Pages blev slået til af setup og bygget; adressen svarede.
- Appen blev oprettet: indsamlingsjobbet startede, og det gør det kun, når appens id er gemt. Om den fik det nye navn med repository i, er ikke aflæst.

## Fundet

Appen var oprettet, men ikke installeret på kontoen, da indsamlingen startede. Trinnet, der henter adgang, fik 404 og stoppede kørslen efter 18 sekunder, før noget blev gemt. Setup havde skrevet "First collection started" og "Done", fordi den kun startede kørslen og ikke så, hvordan den gik. Siden på Pages viste derfor "The figures could not be loaded" uden nogen forklaring.

## Hvad der er bygget

| Fil | Ændring |
|---|---|
| `src/setup.mjs` | Setup bliver hos første indsamling, til den er færdig. Går den godt, står der, at tallene er i `data`-grenen. Mangler appens installation, siges det med linket, og indsamlingen prøves igen efter Enter, højst tre gange. Kan appen ikke læse nogle af de valgte repositories, nævnes de ved navn. Andre fejl peger på loggen. "Done" skrives kun, når der er tal. Trin 2 viser nu de repositories, man skal vælge, i stedet for "the ones listed above" |
| `docs/app.js` | Brønden er første visning, når adressen ikke nævner en anden. Under den får hvert repository en boks med sin egen graf over visninger og kloninger, downloads i alt og i perioden, og stjerner. "Details" fører til Traffic for det repository. Er ét valgt, vises kun dets boks. Kolonnen i Brøndens tabel hedder nu "Downloads in period" |
| `docs/app.css` | To bokse ved siden af hinanden, hvor der er plads; én i telefonbredde |
| `docs/lib/i18n.js` | Fem nye tekster på engelsk og dansk |
| `README.md` | Trin 7 og beskrivelsen af dashboardet rettet til |
| `test/setup.test.mjs` | 5 nye tests af første indsamling, med logteksten fra Jans rigtige kørsel |

Boksene er bygget af kittets `kasse` og den graf, Traffic i forvejen bruger. Den offentlige forside har ingen bokse, fordi der ikke udgives tal pr. dag for hvert repository.

## Sådan er det afprøvet

`86` er setup kørt i en skrabet kopi, hvor stedfortræderen for `gh` lader første indsamling fejle, som den rigtige gjorde, og den anden lykkes: setup siger, at appen ikke er installeret, venter på Enter, prøver igen og skriver først derefter "Done".

`83` til `85` er skærmbilleder med opdigtede tal: Brønden som første visning, boksene på computer og telefon i Chrome, og boksene i WebKit.

## Deviation-liste

1. **Ingen særskilt undersøgelse (Fase A).** Fejlen blev fundet i Jans udskrift, og ønsket om forsiden kom i samtalen.
2. **Setup kan ikke spørge GitHub, om appen er installeret**, uden appens egen nøgle, som den med vilje ikke beholder. Derfor ses det på den første indsamling i stedet.
3. **Boksene er ikke en del af designpakken** (Jans ord). De er sat sammen af pakkens egne dele, ikke tegnet for sig.
4. **Tabellen "Repositories" ved siden af Brønden er beholdt**, selv om boksene nedenunder gentager tallene; den er oversigten, boksene er detaljen.

## Kendte begrænsninger og uprøvet

- **Den nye ventetid i setup er ikke prøvet mod det rigtige GitHub.** Den læser `gh run list` og `gh run view --log-failed`; teksten, den genkender, er taget fra Jans rigtige log.
- **En vellykket indsamling i `mimir-proeve` er endnu ikke set.** Dermed er badges, den offentlige Brønd med rigtige tal og tal på Pages stadig uprøvede for alvor.
- **Mange repositories:** med 18 bokse bliver siden lang. Det er ikke prøvet med flere end tre.
- **Venter højst fire minutter** på indsamlingen; derefter siger setup, at den stadig kører.

---

**STOP. Ingen `git commit` eller `push` er udført. Jan kører blokkene.**
