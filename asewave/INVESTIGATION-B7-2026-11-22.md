# INVESTIGATION B7: vejen til Mimir 1.0.0

Executor: Claude (Fable 5.2), 2026-11-22. Fase A: kun undersøgelse, intet er bygget.

Jans bestilling i samtalen: alt det, der står mellem Mimir og en 1.0.0, skal ses på i dag, undtagen selve release-afsnittet (versionsnummer, changelog, tag). "Add to Home Screen" droppes som prøvepunkt.

## §C.0 Evidence

```
$ git clone https://github.com/wi24rd-com/mimir && git log -1 --format='%H %s'
3b77d2afdde4ae70b3e75bd7d7d1f63d8716f740 Phone and Pages have been tried; say what is still untried

$ git tag            (tomt: ingen tags)

$ node --test | tail
# tests 105
# pass 105
# fail 0

$ ls .github/workflows
collect.yml          (ingen workflow kører testene)

$ grep -n '"version"' package.json ; cat docs/lib/version.js
  "version": "0.1.0",
export const VERSION = '0.1.0';

$ grep -n "name:" src/setup.mjs | head -1
25:    name: `mimir-${owner}`.slice(0, 34),

$ grep -n "schema\|mimir: 1" src/lib/store.mjs src/lib/crypto.mjs src/collect.mjs
src/lib/store.mjs:42:    if (state.schema !== SCHEMA) throw new Error(`data is schema ...
src/lib/crypto.mjs:24:    mimir: 1,
src/collect.mjs:104:  writeFileSync(join(dir, 'public.json'), JSON.stringify({ mimir: 1, day, ...

$ curl -o /dev/null -w "%{http_code}" https://wi24rd-com.github.io/mimir/
404                  (skabelonen har ikke Pages slået til)
$ curl -o /dev/null -w "%{http_code}" https://wi24rd-com.github.io/mimir-wi24rd/
200

$ grep -n "permissions" -A3 .github/workflows/collect.yml
9:permissions: {}
21:    permissions:
22-      contents: write # commits to the "data" branch of this repository
23-      issues: write # opens an issue when a collection fails
```

Ikke aflæst: About-felt, topics og Pages-indstillinger for de to repositories. GitHub-API'et var lukket for denne session; kun det offentlige indhold kunne klones.

## 1. Opdateringsvejen

I dag: en kopi følger ikke skabelonen. README siger, at man kopierer filerne over og beholder sin `mimir.json`.

| Vej | Hvad den opdaterer | Hvad den ikke opdaterer | Omfang |
|---|---|---|---|
| **A. `node src/update.mjs`** i klonen: henter en tagget version af skabelonen og lægger `src/`, `docs/`, `test/`, `tools/` og workflows ind; rører ikke `mimir.json` | Alt: indsamling, dashboard, workflows | Intet | Lille |
| **B. Composite action** (`action.yml` i roden, kopiens `collect.yml` kalder `wi24rd-com/mimir@v1`) | Kun indsamlingen | Dashboardet i `docs/`, som Pages serverer fra kopien | Mellem |

Fund om B:
- En composite action kan ikke læse `secrets`. Appens nøgle og adgangsfrasen skal gives som inputs fra kopiens workflow.
- Marketplace-kravene i GitHubs engelske dokumentation: offentligt repository, én `action.yml` i roden, et navn der ikke er taget. Kravet "ingen workflow-filer i repositoryet" står stadig i en oversat udgave af siden, men ikke i den engelske. Uafklaret; release-dialogen afgør det.
- B løser ikke opdatering af dashboardet, så A skal alligevel til.

Anbefaling: A i 1.0.0. B som 1.1, fordi den er et tilvalg oven på og ikke bryder noget. B's værdi er synlighed på Marketplace, ikke opdatering.

## 2. Hvad 1.0.0 lover

Formaterne har allerede versionsmærker: `"version": 1` i `mimir.json`, et skemanummer i tilstanden (`src/lib/store.mjs:42`) og `mimir: 1` i de krypterede filer og i `public.json`.

Forslag til løftet: inden for 1.x læser en nyere Mimir altid en ældre kopis `mimir.json` og `data`-gren uden, at brugeren gør noget. Det skal stå i README, og en test skal holde det (en gemt tilstand, der skal kunne læses).

## 3. "Use this template" fra bunden

Jans egen opsætning er lavet fra skabelonen, men af os. Det er ikke prøvet af én, der kun har README.

**Forventet fund, ikke afprøvet:** setup navngiver appen `mimir-<ejer>` (`src/setup.mjs:25`). Appnavne er unikke på GitHub, og `mimir-wi24rd-com` findes. En anden kopi på samme konto vil derfor sandsynligvis støde på, at navnet er taget, når appen skal oprettes. Det rammer alle, der vil have to kopier, og det rammer prøven her.

Prøven: Jan laver en kopi `mimir-proeve` fra skabelonen og følger kun README. Det, der går galt eller er uklart, er fundene. Kopien slettes bagefter.

## 4. Badges

Aldrig kørt for alvor: `public_badges` er tom i Jans opsætning, fordi han venter med badges.

Prøven kan køre i `mimir-proeve` med `total_downloads` og `stars` valgt. Begge tal er i forvejen offentlige på GitHub, så intet nyt bliver afsløret. Beviset er shields.io-billedet hentet fra en README i prøvekopien.

## 5. Den offentlige Brønd på Pages

Kun set med opfundne tal i Chrome uden skærm. Brønden udgiver visninger og kloninger, som ellers kun ejeren ser, og de bliver i `data`-grenens historik.

Forslag: Brøndens tegning på Pages bevises i den offentlige demo (punkt 6) med opfundne tal. Kæden fra indsamling til `public.json` er den samme som for badges og bevises i punkt 4. Så skal ingen rigtige ejertal udgives for prøvens skyld.

## 6. Offentlig demo

Skabelonens Pages svarer 404. Dashboardet på Pages gætter ejer og repository ud fra adressen og henter `data`-grenen (`docs/app.js:69-71`); skabelonen har ingen.

Demotallene laves af `src/lib/demo.mjs`, som er ren JavaScript uden Node-afhængigheder ud over to interne filer. Den kan flyttes til `docs/lib/`, så browseren selv laver tallene.

Forslag: adressen `…/mimir/?demo` viser demoen med mærket "Demo", som den lokale gør i dag. Skabelonens Pages slås til, og README får linket "Try the demo". En kopi får samme mulighed; det er harmløst, fordi demoen siger, hvad den er.

## 7. Browsere og telefon

- Safari og Firefox er ikke prøvet. Claude forsøger med Firefox og WebKit i sit eget miljø; lykkes det ikke at installere dem der, bliver det en prøve hos Jan.
- Android er ikke prøvet. Uden en Android-telefon bliver det stående som kendt begrænsning.
- "Add to Home Screen" droppes som prøvepunkt (Jans valg). README må stadig ikke sige, at det er prøvet; linjen flyttes til Limits.

## 8. Vagten mod 60-dages-stoppet

GitHubs dokumentation: planlagte kørsler i et offentligt repository slås fra efter 60 dage uden aktivitet i repositoryet. Uofficielle kilder siger, at det er aktivitet på standardgrenen, der tæller. Mimir committer kun til `data`, så en kopi, ingen rører, kan blive stoppet.

Kendt modtræk: workflowet slår sig selv til igen via API'et ved hver kørsel. Det kræver rettigheden `actions: write`.

Forslag: et særskilt lille job med kun `actions: write`, så indsamlingsjobbets token ikke får mere, end det har i dag.

Kan ikke bevises i dag: om det virker, ses først efter 60 dage. Det skal stå sådan i README.

## 9. Test ved hvert push

Ingen workflow kører `npm test`. Forslag: `test.yml` med `npm test` ved push og pull request, `permissions: contents: read`, actions låst til commit som i `collect.yml`.

## Sideeffekt-fund (flages, rettes ikke her)

1. README's statuslinje øverst siger stadig "No release has been tagged" og nævner de uprøvede punkter; den skal skrives om, når runden er færdig.
2. Skabelonens og Jans opsætnings About-felt og topics kunne ikke aflæses i denne session.

## Beslutninger, Jan skal træffe

1. **Opdatering:** `update.mjs` i 1.0.0 og Action som 1.1? (anbefalet)
2. **Løftet:** formaterne er stabile i hele 1.x? (anbefalet)
3. **Prøvekopi:** må der laves en `mimir-proeve` på Jans konto til punkt 3 og 4, som slettes bagefter? (anbefalet)
4. **Brønden:** bevises i demoen med opfundne tal, så ingen rigtige ejertal udgives? (anbefalet)
5. **Demo:** `?demo` på skabelonens Pages? (anbefalet)
6. **Vagten:** særskilt job med `actions: write`? (anbefalet)
7. **Android:** har Jan adgang til en Android-telefon, eller bliver det stående som kendt begrænsning?

## Deviation-liste

- Undersøgelsen er lavet på en frisk klon af det offentlige repository, ikke i Jans mappe.
- Ingen regelfiler er læst i denne runde; bestillingen kommer fra samtalen.
- Punkt 3's fund om appnavnet er læst i koden, ikke fremprovokeret.

## Kilder

- GitHub: https://docs.github.com/en/enterprise-cloud@latest/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace
- GitHub: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows
- GitHub: https://docs.github.com/en/rest/actions/workflows
- gh-workflow-immortality: https://github.com/PhrozenByte/gh-workflow-immortality
- gh-action-keepalive: https://github.com/efrecon/gh-action-keepalive

## Jans svar (2026-11-22)

- 60-dages-stoppet er en reel risiko: der skal bygges en vagt, som holder øje og advarer brugeren. Aftalt som tre lag: forebyg (job der slår workflowet til), varsl før (issue efter 45 stille dage), sig årsagen efter (dashboard og terminal spørger GitHub).
- Ingen adgang til Android: står som kendt begrænsning.
- Ja til at bygge efter anbefalingerne i punkt 1 til 6.
