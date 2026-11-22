# INVESTIGATION: Wi24rd insights-tracker (arbejdstitel)

**Executor:** Claude (Fable 5.2), cloud-session uden skriveadgang til wi24rd-com
**Dato:** 2026-11-21
**Fase:** ASEWAVE Fase A. Read-only. Ingen implementering.
**Formål:** Verificere de antagelser, løsning A blev foreslået på i tråden, før der skrives kode.

Statusord: **BEKRÆFTET** (dokumentation eller kørt kommando), **AFKRÆFTET**, **DELVIST**, **KUNNE IKKE AFGØRES**.

---

## §C.0 Evidence

```
$ pwd && date -u +%F     (redigeret før offentliggørelse: sti og klokkeslæt er fjernet)
(arbejdsmappe hos Claude)
2026-11-21
$ node --version; python3 --version; gh --version | head -1
v22.23.5
Python 3.13.18
gh version 2.89.0 (2026-03-26)
```

Der findes endnu intet repo for projektet, så `git log` og `git status` er ikke relevante. Arbejdet foregik i en midlertidig arbejdsmappe hos Claude.

Traffic-API med sessionens integrations-token (ikke Jans egen nøgle):

```
traffic/views             -> 403 "Resource not accessible by integration"
traffic/clones            -> 403 "Resource not accessible by integration"
traffic/popular/referrers -> 403 "Resource not accessible by integration"
traffic/popular/paths     -> 403 "Resource not accessible by integration"
```

Release- og repo-API uden særlige rettigheder:

```
{'name': 'Huginn-Muninn-1.1.0.zip', 'download_count': 4, 'created_at': '2026-11-17T21:56:38Z', 'size': 9099629}
{'stargazers_count': 0, 'forks_count': 0, 'subscribers_count': 0, 'visibility': 'public'}
owner type: User
```

Action-versioner (`git ls-remote --tags`):

```
f418cff399f7aef4c2f0ad47e25ca7a6abbdd6fc  refs/tags/v3.4.0   actions/create-github-app-token
3d3c42e5aac5ba805825da76410c181273ba90b1  refs/tags/v7.0.1   actions/checkout
```

CORS-probe:

```
api.github.com/repos/wi24rd-com/grimnir  + Origin  -> 200, Access-Control-Allow-Origin: *
github.com/login/device/code  OPTIONS             -> 405 (svaret kom fra sessionens proxy, ikke fra GitHub)
github.com/login/device/code  POST                -> 415 (svaret kom fra sessionens proxy, ikke fra GitHub)
```

---

## Spørgsmål 1: Hvilken nøgle kan læse traffic-data?

**BEKRÆFTET.** GitHubs dokumentation for "Get page views" angiver tre nøgletyper: GitHub App user access tokens, GitHub App installation access tokens og fine-grained personal access tokens. Kravet er repository-rettigheden "Administration" (read). Kilde: docs.github.com/en/rest/metrics/traffic.

Konsekvens: En GitHub App med Administration (read) kan bruges i stedet for et PAT. Det bærer hele sikkerhedsdesignet.

## Spørgsmål 2: Kan den indbyggede GITHUB_TOKEN bruges?

**BEKRÆFTET at den ikke kan.** `permissions:`-listen i workflow-dokumentationen indeholder ikke "administration", og runtime-proben ovenfor gav 403 "Resource not accessible by integration" på alle fire endpoints med et integrations-token uden den rettighed.

Forbehold: Proben er kørt med sessionens token, ikke med en ægte GITHUB_TOKEN i en workflow-kørsel. Det testes i Fase B i første workflow-kørsel.

## Spørgsmål 3: Kan GitHub Appen oprettes automatisk (manifest flow)?

**DELVIST. Min påstand "ét klik" var for optimistisk.**

- Manifest flow virker for personlige konti: POST til `https://github.com/settings/apps/new`. Bagefter veksles en midlertidig kode via `POST /app-manifests/{code}/conversions`, som returnerer app-id og privat nøgle (pem). Alle tre trin skal ske inden for en time. Kilde: docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest.
- `default_permissions` kan sættes i manifestet, så rettighederne er fastlagt på forhånd.
- Mønstret med en lokal lytter på `http://localhost:<port>` som `redirect_url` bruges af et eksisterende værktøj (github-app-forge, Rust). Jeg har ikke selv kørt det.
- Oprettelse og installation er to trin. Brugeren bekræfter først oprettelsen og vælger derefter, hvilke repos appen installeres på.

Realistisk opsætning: **én kommando og to bekræftelser i browseren.**

KUNNE IKKE AFGØRES herfra: om GitHub accepterer `http://localhost` som `redirect_url` i dag, og om `administration: read` godtages i et manifest uden anmærkninger. Begge dele kræver en rigtig browser-session og testes som det første i Fase B.

## Spørgsmål 4: Korte tokens i workflowet

**BEKRÆFTET at værktøjet findes.** `actions/create-github-app-token` v3.4.0 (SHA `f418cff3…`) og `actions/checkout` v7.0.1 (SHA `3d3c42e5…`).

Forbehold: Jeg har ikke læst v3.4.0's inputs. Navne som `app-id`/`client-id`, `private-key`, `repositories` og `permission-*` skal slås op i actionens egen `action.yml`, før workflowet skrives. De må ikke gættes.

## Spørgsmål 5: Login direkte i dashboardet (device flow uden server)

**AFKRÆFTET efter dokumentationen. Ikke runtime-testet.**

GitHubs OAuth-dokumentation oplyser, at CORS pre-flight ikke understøttes på OAuth-endpoints. Et kendt hjælpeprojekt (octocus/github-oauth-proxy) findes netop, fordi en ren browser-app får CORS-fejl mod `github.com/login/oauth/access_token`. Device flow bruger det samme token-endpoint. Min egen probe ramte sessionens proxy og beviser derfor intet.

Konsekvens: "Mulighed 1" fra tråden (login i dashboardet, ingen server) kan sandsynligvis ikke bygges uden en lille proxy, og en proxy strider mod princippet om ingen server. **Den udgår af planen**, medmindre en browser-test i Fase B viser noget andet. `api.github.com` selv tillader CORS (bekræftet), så det er kun selve login-trinnet, der blokerer.

## Spørgsmål 6: "Gem på GitHub" med forudfyldt fil

**DELVIST.** `?filename=` på `/new/<branch>` er dokumenteret af GitHub selv (github.blog, 2012). `&value=` til at forudfylde indholdet er beskrevet af tredjeparter og efterlignet af Gitea og GitLab, men jeg fandt den ikke i GitHubs egen dokumentation.

KUNNE IKKE AFGØRES: om `value` virker i dag, og om det virker ved redigering af en eksisterende fil (`/edit/`). `traffic.yml` findes allerede efter installationen, så redigeringstilfældet er det vigtige. Fallback, der altid virker: dashboardet viser den nye fil og en "Kopiér"-knap ved siden af et link til GitHubs redigeringsside.

## Spørgsmål 7: Indstillingsformular i Actions (workflow_dispatch)

Ikke undersøgt nærmere. Funktionen er velkendt, men grænser for antal felter og felttyper skal slås op, før den bruges. Lav risiko.

## Spørgsmål 8: 60-dages-reglen

**BEKRÆFTET, med en vigtig detalje.** Dokumentationen siger: "In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days." Reglen er altså formuleret for offentlige repos.

Konsekvenser:
- Et privat data-repo er efter ordlyden ikke omfattet.
- KUNNE IKKE AFGØRES: om workflowets egne daglige data-commits tæller som "repository activity" i et offentligt repo.
- Et workflow, der er slået fra, kan ikke selv oprette et issue om det. Alarmen "indsamlingen er stoppet" skal derfor komme et andet sted fra: dashboardet viser forældede data med rødt, og et uafhængigt workflow i et andet repo kan holde øje.

## Spørgsmål 9: Privat repo, Pages og omkostninger

**BEKRÆFTET.** GitHub Free for personlige konti giver "GitHub Pages in public repositories". Pages fra private repos hører under Pro. Private repos på Free har 2.000 Actions-minutter pr. måned. Offentlige repos bruger gratis standard-runners.

Konsekvens for de tre tilstande:

| Tilstand | Data-repo | Dashboard | 60-dages-regel | Actions-forbrug |
|---|---|---|---|---|
| public | offentligt | Pages | gælder | gratis |
| encrypted | offentligt, alt indhold krypteret | Pages | gælder | gratis |
| private | privat | intet Pages på Free; rapport i README | gælder ikke efter ordlyden | ca. 30–60 min/md af 2.000 (skøn, ikke målt) |

## Spørgsmål 10: Datamodellen

**BEKRÆFTET.**
- Views og clones: totaler plus en liste pr. dag med `timestamp`, `count`, `uniques` for de seneste 14 dage. Tidsstempler ligger på UTC-midnat.
- Referrers og paths: top 10 samlet for 14 dage, uden opdeling pr. dag.
- Release-assets: `download_count` er et øjebliksbillede og kan læses uden nøgle (kørt i dag).

Konsekvens: views og clones flettes på `timestamp`. Referrers, paths og downloads gemmes som daterede snapshots. Unikke tal kan ikke summeres over dage, og det skal dashboardet sige i klart sprog.

## Spørgsmål 11: Er løsningen ny i forhold til de eksisterende?

**DELVIST.** Jeg har kun læst README for ét konkurrerende værktøj, GitHub Traffic Tracker (djdarcy). Det gemmer i en offentlig Gist og beder brugeren oprette et PAT med `gist`-scope. De andre (Repo-rter, traffic-lite, GTH, Repohistory) kender jeg kun fra søgeresultaternes korte beskrivelser.

Påstandene fra tråden om, at "ingen andre" bruger GitHub App, kryptering eller blandet synlighed, er **ikke verificerede** og må ikke bruges i README eller markedsføring, før de fem værktøjer er gennemgået.

---

## Deviation-liste

Afvigelser mellem det, jeg skrev i tråden, og det, undersøgelsen viser:

1. **"Én kommando og ét klik"** skal være "én kommando og to bekræftelser" (oprettelse og installation af appen).
2. **Login i dashboardet uden server** udgår efter dokumentationen (CORS).
3. **"Fejl opretter et issue, også når workflowet er slået fra efter 60 dage"** var forkert. Et deaktiveret workflow kan ikke køre. Alarmen skal komme fra dashboardet eller et uafhængigt workflow.
4. **Den private tilstand** har en fordel, jeg ikke nævnte (60-dages-reglen er formuleret for offentlige repos), og en omkostning, jeg ikke nævnte (den bruger af de 2.000 gratis minutter).
5. **"Har jeg ikke set andre gøre"** bygger på én læst README. Påstanden er uverificeret.
6. **"Gem på GitHub" med forudfyldt indhold** er usikker for eksisterende filer.

## Sideeffekt-fund

- Grimnir 1.0.0: zip-filen har 0 downloads og .txt-filen 1 (set tidligere i dag). Ikke undersøgt.
- Sessionens proxy besvarer selv kald til `github.com` (ikke `api.github.com`). Browser-flows kan derfor ikke testes fra denne cloud-session. De skal testes på Jans Mac.
- Denne session kan ikke pushe til wi24rd-com ("push_check: refused"). Repo-oprettelse og push sker via CLI-blokke, som Jan selv kører.

## Skal testes først i Fase B (rækkefølge efter risiko)

1. Manifest flow med `localhost`-redirect og `administration: read` på Jans egen konto.
2. Installation-token henter traffic for ét repo i en rigtig workflow-kørsel.
3. `action.yml` for create-github-app-token v3.4.0 læses, og inputs fastlægges.
4. `?value=` på `/new/` og `/edit/` i en browser.
5. Device flow fra en browser (kun for at lukke spørgsmål 5 endeligt).

---

**STOP. Venter på Jan + Cowork-Claude green-light.**
