# WALKTHROUGH B10: version 1.0.0

Executor: Claude (Fable 5.2), 2026-11-22. Jan sagde ja til release-afsnittet, efter at prøven med `mimir-proeve` var kørt igennem. Udgangspunkt: commit `9ec438c` på `main`.

## §C.0 Evidence

```
$ node --test     (asewave/evidence/89-npm-test-1.0.0.txt, Node v22)
# tests 151
# pass 151
# fail 0

$ grep '"version"' package.json ; cat docs/lib/version.js | tail -1
  "version": "1.0.0",
export const VERSION = '1.0.0';

Læst af Claude i data-grenen af wi24rd-com/mimir-proeve (Jans prøvekopi, 2026-11-22):
commit "data: 2026-11-22", tidsstempel 2026-11-22T00:00:00+00:00
badges/total_downloads.json  {"schemaVersion":1,"label":"downloads","message":"18","color":"007864"}
public.json                  mimir 1, 9 tal, well med 14 dage og 7 repositories
state.json                   schema 1, last_errors: wi24rd-com/mimir:access, wi24rd-com/wi24rd-com:access

Set af Jan i browseren: tallene på https://wi24rd-com.github.io/mimir-proeve/, de to advarsler om
repositories uden for appen, og badgen "downloads 18" tegnet af shields.io.
```

## Hvad Jans prøve beviste for alvor

| Punkt fra undersøgelsen (B7) | Resultat |
|---|---|
| "Use this template" fra bunden | Kørt med `install.sh`: kopi oprettet, klonet og sat op |
| Appnavn ved to kopier på samme konto | En ny app blev oprettet ved siden af den gamle; indsamlingen fik adgang med den |
| Badges | Fil skrevet af indsamlingen og tegnet af shields.io |
| `collect.yml` og `test.yml` på GitHub | Begge har kørt; `Test` grøn to gange |
| Tal på Pages | Vist i Jans browser, med advarsel om to repositories uden for appen |
| Commit-tid på `data`-grenen | Kun dagen, klokken 00:00 UTC |

## Hvad der er ændret

| Fil | Ændring |
|---|---|
| `package.json`, `docs/lib/version.js` | 0.1.0 til 1.0.0 |
| `CHANGELOG.md` | Nyt. Hvad 1.0.0 indeholder, og de kendte begrænsninger |
| `README.md` | Statuslinjen siger, hvad der er kørt for alvor, hvad der ikke er bevist, og hvad der ikke er prøvet |
| `SECURITY.md` | Understøttet version er den nyeste 1.x |
| `src/update-paths.json` | `CHANGELOG.md` følger med en opdatering |
| `test/version.test.mjs` | Ny test: versionen er den samme i `package.json`, `version.js`, README og changelog |

## Deviation-liste

1. **README's link til `install.sh` peger stadig på `main`, ikke på tagget.** Installeren laver kopien fra skabelonens `main` uanset hvad, så et låst link ville kunne hente en ældre installer til en nyere skabelon.
2. **Skærmbillederne i README viser Overview som første visning.** De er fra før, Brønden blev forside, og er ikke taget om.
3. **Tagget får fast klokkeslæt i blokken til Jan**, fordi et annoteret tag bærer sin egen tid, som værktøjet for commits ikke rører.

## Kendte begrænsninger og uprøvet

- **Vagten mod 60-dages-stoppet** er ikke bevist; det tager 60 dage.
- **Den ventende setup fra B9** (der følger første indsamling) er ikke kørt mod det rigtige GitHub; prøvekopien blev lavet før den.
- **Den udgivne Brønd på forsiden med rigtige tal** er ikke set; prøven kørte `public`, hvor forsiden ikke vises. Filen bag den er læst og har den rigtige form.
- **`update.mjs` har ikke hentet en rigtig version.** Første mulighed er fra 1.0.0 til den næste.
- **GitHub viser selv, hvornår tagget blev pushet og releasen udgivet.** Det kan ikke skjules.
- Android, Safari selv og "Add to Home Screen" er ikke prøvet.

---

**STOP. Ingen `git commit`, tag eller release er lavet. Jan kører blokkene.**
