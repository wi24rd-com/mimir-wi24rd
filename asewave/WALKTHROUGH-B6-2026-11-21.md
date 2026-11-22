# WALKTHROUGH B6: Brønden på forsiden, "Fetch again" lokalt og status

Executor: Claude (Fable 5.2), 2026-11-21. Jan spurgte, om Brønden kan vises offentligt på forsiden, og bad derefter om at få det hele gjort færdigt.

## §C.0 Evidence

```
$ npm test | tail     (asewave/evidence/55-npm-test-b6.txt)
# tests 105
# suites 0
# pass 105
# fail 0

$ asewave/evidence/56-browser-flow-public-well.json     (demo, krypteret, --front, Chrome uden skærm)
"front": {"title": "Figures from GitHub", "well": true, "stones": 14, "points": ["img lantern: 499 views, 64 clones, +8 downloads", "img quill-notes: 149 views, 19 clones, +0 downloads", "img tidepool: 51 views, 5 clones, +0 downloads"], "wellRows": ["lantern | 499 | 64 | +8", "quill-notes | 149 | 19 | +0", "tidepool | 51 | 5 | +0"], "figureRows": 5, "notes": ["The Well: the last 14 days.", "As of 21 Nov."], "leaks": false, "passField": false}
"clickDoesNothing": {"stillFront": true, "dimmed": 0, "hash": ""}
"lockAfterButton": true
"phone": {"note": "Brønden: de seneste 14 dage.", "overflow": false}
"problems": []
"external": []
```

Skærmbilleder med opdigtede tal: `57` forsiden med Brønden, `58` det samme i telefonbredde på dansk. `59` viser felterne i SSH-signaturen på Jans nyeste commit.

De to ældre forløb er kørt igen efter ændringen, begge uden fejl og uden forespørgsler udadtil.

## Hvad der er bygget

| Fil | Ændring |
|---|---|
| `docs/lib/config.js` | Nyt valg `well` i `public_badges` |
| `docs/lib/public.js` | `publicWell`: visninger pr. dag lagt sammen, og visninger, kloninger og downloads pr. repository, for 14 dage. Kun for de repositories, der står i `mimir.json` |
| `src/collect.mjs` | Skriver `well` i `public.json`, når den er valgt; ellers ikke |
| `docs/app.js` | Forsiden tegner Brønden af `public.json`, efter at hvert felt er tjekket. Punkterne kan ikke vælges dér. Indstillingerne har et nyt hak og en advarsel. Knappen "Open your figures" står nu over billedet |
| `src/dashboard.mjs` | Lokalt hentes tallene fra GitHub ved hvert "Fetch again", ikke kun ved opstart. Demoen udgiver også Brønden |
| `docs/lib/i18n.js`, `docs/app.css` | Tekster på engelsk og dansk; bred forside, når Brønden vises |
| `README.md` | Status rettet til det, der faktisk er prøvet. `well` beskrevet under de offentlige tal |
| `test/public.test.mjs`, `test/collect.test.mjs` | Tre nye tests |

## Deviation-liste

1. **Ingen særskilt undersøgelse (Fase A).** Jan fik beskrevet, hvad der bliver offentligt, og hvordan den ville blive bygget, før han bad om at få det gjort færdigt.
2. **Brønden på forsiden er slået fra fra start**, og Jan har ikke valgt den. Hans eget repository udgiver stadig ingen tal.
3. **Perioden er fast 14 dage.** Jan svarede ikke på, om det var den rigtige periode.
4. **Et offentliggjort tal kan ikke trækkes tilbage.** Fravælges Brønden, forsvinder den fra `public.json` ved næste indsamling, men de gamle udgaver ligger i `data`-grenens historik. Advarslen i indstillingerne og README siger det.
5. **Lokalt giver "Fetch again" nu et kald til GitHub hver gang.** Uden net vises de senest hentede tal, og terminalen skriver det.

6. **Efter Jans prøve på Pages med LastPass installeret:** LastPass tog forespørgslen om at oprette en passkey, og den passkey kan ikke beskytte en adgangsfrase. Mimir huskede derfor intet, fire gange i træk, og beskeden forklarede ikke hvorfor. Beskeden nævner nu adgangskodeprogrammet og tilbyder en knap, "Remember without the check" (`61`). Mimir kan ikke forhindre, at en browserudvidelse tager forespørgslen.
7. **"Fetch again" gav intet synligt svar**, når der ikke var nyere tal. Den siger nu, hvornår der sidst blev indsamlet, og at knappen læser resultatet igen og ikke starter en indsamling (`61`).

## Kendte begrænsninger og uprøvet

- Den offentlige Brønd er kun prøvet med opdigtede tal og kun i Chrome uden skærm. Den er ikke set på Pages.
- Badge-kæden og "Use this template" er stadig ikke prøvet for alvor.
- Vagten mod, at GitHub slår planlagte kørsler fra efter 60 dage, er ikke bygget.

## Undersøgt i samme runde

Jans commits er signeret med en SSH-nøgle. Signaturen indeholder nøgle, navnerum, et tomt reserveret felt, hash-algoritme og selve signaturen, og intet andet (`59`). Den gemmer altså ikke et tidspunkt ved siden af den faste commit-tid.

---

**STOP. Ingen `git commit` eller `push` er udført. Jan kører blokkene.**
