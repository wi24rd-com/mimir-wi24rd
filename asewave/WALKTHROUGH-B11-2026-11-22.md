# WALKTHROUGH B11: Overview er startsiden, med Brønden og en graf pr. repository

Executor: Claude (Fable 5.2), 2026-11-22. Jan bad om, at Brønden med data til højre og graferne nedenunder bliver startsiden under Overview, og valgte "Samlet i Overview": sætningen med totalerne øverst, den store tabel udgår, og fanen "The Well" fjernes. Udgangspunkt: `9ec438c` på `main` med 1.0.0-ændringen (B10) lagt på; ingen af delene var committet hos Jan.

## §C.0 Evidence

```
$ node --test     (asewave/evidence/91-npm-test-b11.txt, Node v22)
# tests 151
# pass 151
# fail 0

$ asewave/evidence/90-overview-start-page-three-browsers.json     (chrome, firefox, webkit; 1440x900 og 390x844)
alle seks:
"order": ["headline", "sentence", "well", "heading", "boxes", "note"]
"tabs": ["Overview", "Traffic", "Downloads", "Sources"]
"stones": 14, "boxes": 3, "charts": 3, "overflowX": false, "errors": []
"oldWellAddressShows": "overview", "traffic": true, "downloads": true, "sources": true
"frontStones": 14, "frontBoxes": 0
```

## Hvad der er ændret

| Fil | Ændring |
|---|---|
| `docs/app.js` | Overview viser sætningen med totalerne, derefter Brønden med tabellen og læsevejledningen til højre, derefter en boks pr. repository. Den store tabel på Overview er væk; dens tal står i boksene og i grafernes forklaring. Fanen "The Well" er fjernet, så der er fire faner. En gammel adresse, der ender på `#well`, viser Overview |
| `docs/app.css` | En kommentar rettet |
| `README.md`, `CHANGELOG.md` | Beskrivelsen af dashboardet rettet til fire faner og den nye startside |
| `assets/screens/` | Seks billeder taget om med opdigtede tal, så README viser det, der findes. `well-dark.png` er erstattet af `repos-dark.png` (boksene) |

Den offentlige forside er uændret: Brønden uden bokse.

## Deviation-liste

1. **Ingen særskilt undersøgelse (Fase A).** Jan beskrev ønsket og valgte mellem tre udformninger.
2. **B9's "Brønden åbner først" er trukket tilbage** og erstattet af dette. B9's walkthrough beskriver derfor en forside, der ikke længere findes; dens del om setup gælder stadig.
3. **Teksten `vWell` ligger stadig i oversættelserne**, ubrugt.
4. **`phone-front-light.png` er ikke taget om**; forsiden er ikke ændret.

## Kendte begrænsninger og uprøvet

- **Ikke set af Jan endnu**, og ikke set med rigtige tal eller med flere end tre repositories.
- **De største antal unikke besøgende pr. dag** stod før som kolonner i den store tabel. De står nu kun i forklaringen over hver graf.
- **Med mange repositories bliver startsiden lang.** Brønden og oversigten står øverst; boksene kommer under.

---

**STOP. Ingen `git commit` eller `push` er udført. Jan kører blokkene.**
