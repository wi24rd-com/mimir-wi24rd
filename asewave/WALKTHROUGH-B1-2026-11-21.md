# WALKTHROUGH B1: indsamler, lagring, kryptering, opsætning

**Executor:** Claude (Fable 5.2), cloud-session
**Dato:** 2026-11-21
**Fase:** ASEWAVE Fase C for B-cyklus 1
**Green-light:** givet af Jan 2026-11-21 ("Green Light", titel "Wi24rd Mimir - GH Insights-tracker", CLI-blokke som vi plejer)

---

## §C.0 Evidence

Artefakter (fanget før denne tekst blev skrevet):

```
$ ls -la asewave/evidence
-rw-r--r-- 1 root root 7752 Nov 21 11:01 01-npm-test.txt
-rw-r--r-- 1 root root 4879 Nov 21 11:01 02-real-run-public.txt
-rw-r--r-- 1 root root  624 Nov 21 11:01 03-real-run-encrypted.txt
-rw-r--r-- 1 root root   79 Nov 21 11:01 04-actionlint.txt

$ shasum -a 256 asewave/evidence/* | awk '{print $1}' | sort | uniq -d
(tom: ingen dubletter)
```

Tests (`npm test`, Node v22.23.5, fuld suite, ingen fil-liste):

```
# tests 45
# pass 45
# fail 0
# cancelled 0
# skipped 0
exit=0
```

Break/fix: `mergeDaily` ændret til at overskrive blindt, derefter gendannet:

```
not ok 25 - daily figures: a later, higher count replaces a partial day; a lower one never does
# pass 44
# fail 1
=== restored
# tests 45
# pass 45
# fail 0
```

Rigtig kørsel mod GitHub, åben tilstand (uddrag; fuldt output i `02-real-run-public.txt`):

```
Mimir 2026-11-21: 5 repos, 6 of 30 requests succeeded, mode public.
  failed: wi24rd-com/huginn-muninn views (HTTP 403: Resource not accessible by integration)
  ...
exit=2

wi24rd-com/huginn-muninn {'v1.1.0/Huginn-Muninn-1.1.0.zip': 4, 'v1.0.0/Huginn-Muninn-1.0.0.zip': 6} ['downloads', 'meta']
wi24rd-com/grimnir {'v1.0.0/Grimnir-1.0.0.txt': 1, 'v1.0.0/Grimnir-1.0.0.zip': 0} ['downloads', 'meta']
wi24rd-com/Wi24rd-FTP {'v1.0.1/SHA256SUMS.txt': 2, 'v1.0.1/Wi24rdFTP-Setup-1.0.1.exe': 2, 'v1.0.1/Wi24rdFTP-Setup.exe': 3} ['downloads', 'meta']
wi24rd-com/Wi24rd-Site-Kit {} []
wi24rd-com/wi24rd-com {} []
```

Rigtig kørsel, krypteret tilstand:

```
Mimir 2026-11-21: 5 repos, 6 of 30 requests succeeded, mode encrypted.

$ find <tmp> -type f
./raw/2026-11-21.enc
./state.enc

$ grep -rlE "huginn|grimnir|Wi24rd|download" <tmp>
(no match)

$ guard: encrypted run against the public data folder
Mimir stopped: this data folder holds unencrypted data. Switching to "encrypted" does not remove what is already in the git history. Start a fresh data branch, or set MIMIR_MIGRATE=1 to convert anyway.
exit=1
```

Workflow-lint:

```
$ actionlint -version
1.7.12
$ actionlint .github/workflows/collect.yml
exit=0
```

Scope (intet er committet; hele repoet er nyt):

```
$ git --no-optional-locks status --porcelain
?? .github/workflows/collect.yml
?? .gitignore
?? README.md
?? asewave/INVESTIGATION-2026-11-21.md
?? asewave/evidence/01-npm-test.txt
?? asewave/evidence/02-real-run-public.txt
?? asewave/evidence/03-real-run-encrypted.txt
?? asewave/evidence/04-actionlint.txt
?? mimir.json
?? package.json
?? src/collect.mjs
?? src/config.mjs
?? src/lib/crypto.mjs
?? src/lib/github.mjs
?? src/lib/merge.mjs
?? src/lib/store.mjs
?? src/setup.mjs
?? test/collect.test.mjs
?? test/config.test.mjs
?? test/crypto.test.mjs
?? test/merge.test.mjs
?? test/setup.test.mjs
?? test/store.test.mjs
?? tools/fast-tid.sh
```

1.077 linjer i `src/`, `test/` og workflowet. `package.json` har ingen afhængigheder.

---

## Hvad der er bygget

| Del | Fil | Status |
|---|---|---|
| Konfiguration med validering | `mimir.json`, `src/config.mjs` | Testet |
| GitHub-klient: genforsøg ved 5xx/429, sidegrænse, nøglen kun i header | `src/lib/github.mjs` | Testet med efterlignet API og mod rigtig API |
| Fletning af data | `src/lib/merge.mjs` | Testet, break/fix udført |
| Kryptering (PBKDF2-SHA256, 600.000 runder, AES-256-GCM, gzip) | `src/lib/crypto.mjs` | Testet, også åbnet med ren WebCrypto |
| Lagring i tre tilstande, værn mod skift af tilstand | `src/lib/store.mjs` | Testet og kørt mod rigtige data |
| Indsamler | `src/collect.mjs` | Downloads og repo-tal: kørt mod rigtig API. Traffic: kun efterlignet |
| Opsætning (manifest flow, lokal lytter, secrets via `gh`) | `src/setup.mjs` | Lytteren testet. **Ikke kørt mod GitHub** |
| Workflow | `.github/workflows/collect.yml` | Lint bestået. **Aldrig kørt** |
| Fast commit-tid | `tools/fast-tid.sh` | Kopieret ordret fra skillen. Ikke kørt her |

## Status pr. designpunkt fra tråden

| Punkt | Status |
|---|---|
| GitHub App i stedet for PAT, tokens på en time | Implementeret i workflow og opsætning. Uprøvet mod GitHub |
| Appens rettigheder: kun Administration (read) | Implementeret og testet i manifestet. Strammere end planlagt, se afvigelse 2 |
| Én kommando, to bekræftelser | Implementeret. Uprøvet mod GitHub |
| Privat nøgle aldrig på disk eller skærm | Implementeret: fra GitHubs svar direkte til `gh secret set` via stdin. Test bekræfter, at nøglen ikke vises i browseren |
| Tre tilstande: public, encrypted, private | Implementeret og testet |
| Alt gemt er krypteret, filnavne røber ikke repos | Implementeret og vist på rigtige data |
| Skift af tilstand kræver aktivt valg | Implementeret (`MIMIR_MIGRATE=1`) og testet begge veje |
| Udvalgte offentlige samletal (`public_badges`) | Implementeret for `total_downloads` og `stars`. Testet |
| Rå API-svar gemmes ved siden af de afledte tal | Implementeret for de fire traffic-svar. Se afvigelse 4 |
| Kørsel flere gange dagligt, ufarligt at køre igen | Implementeret (to gange dagligt) og testet |
| Fejl skal kunne ses | Delvist: kørsel fejler synligt og opretter et issue. Alarm ved 60-dages-stop mangler |
| Data på separat `data`-gren | Implementeret i workflowet. Uprøvet |
| Dashboard med indstillinger | Ikke bygget. Næste cyklus |
| Klart-sprog-rapport, profilkort i SVG | Ikke bygget |

## Deviation-liste

1. **Konfigurationen er `mimir.json`, ikke `traffic.yml`.** Node kan ikke læse YAML uden et ekstra bibliotek, og nul afhængigheder vejer tungere. Ulempen er, at JSON ikke kan have kommentarer. Ikke godkendt af Jan på forhånd.
2. **Appen får ikke skriveadgang til Contents.** Workflowet skriver til `data`-grenen med den indbyggede token, som kun gælder dette ene repo. Appen kan derfor kun læse. Det er en stramning i forhold til tråden.
3. **Standardtilstand er `encrypted`.** Jans svar "ja tak" valgte ikke mellem encrypted og private. Jeg valgte den, jeg tidligere anbefalede. Det er én linje i `mimir.json`.
4. **"Rå svar" dækker kun traffic.** Svarene for releases og repo gemmes ikke råt, fordi de fylder meget og kan hentes igen.
5. **Kun én ejer pr. opsætning.** Alle repos i `mimir.json` skal have samme ejer.
6. **`gh`-extension er ikke lavet.** Opsætningen er `node src/setup.mjs` i klonen.
7. **Ingen licens.** Valget er Jans. README skriver "License: not chosen yet".
8. **Ingen værn mod 60-dages-stoppet endnu.**
9. **Appens navn** foreslås som `mimir-<ejer>`. Navne på GitHub Apps er globalt unikke; brugeren kan rette navnet på GitHubs side.

## Kendte begrænsninger og uprøvede antagelser

- **Hele vejen fra opsætning til første indsamling er aldrig kørt mod GitHub.** Det kræver en browser og Jans konto. Konkret uprøvet:
  - om GitHub accepterer `http://127.0.0.1:<port>/callback` som `redirect_url`
  - om et manifest med `hook_attributes.active: false` og `default_permissions: {administration: read}` godtages
  - om `actions/create-github-app-token` giver en token, der kan læse traffic
  - om `ubuntu-latest` har Node 20 eller nyere forudinstalleret (workflowet installerer ikke Node selv)
  - om `gh auth setup-git` med `github.token` kan pushe `data`-grenen
- **Traffic-delen af indsamleren er kun kørt mod et efterlignet API.** Sessionens nøgle har ikke rettigheden, og GitHub svarede 403 som forventet.
- I den rigtige kørsel fejlede `Wi24rd-Site-Kit` og `wi24rd-com` helt. Årsagen er sessionens proxy, som kun slipper de tre tilføjede repos igennem. Det siger intet om Mimir.
- Bevisfilen `02-real-run-public.txt` indeholder proxyens fejltekst for de to repos. Den er harmløs, men hører til denne session og ikke til GitHub.
- Passphrasen vises én gang i terminalen under opsætningen. Den kan stå i terminalens rullehistorik bagefter.
- PBKDF2 er valgt, fordi browsere har den indbygget. Argon2 er stærkere mod gætteri, men kræver et bibliotek i dashboardet. Den genererede passphrase har omkring 128 bit og afhænger ikke af det valg.
- Påstande om, hvad andre værktøjer ikke kan, er fortsat uverificerede (INVESTIGATION, spørgsmål 11) og står ikke i README.

## Læste regelfiler

- Skills: `asewave-investigation`, `asewave-walkthrough`, `wi24rd-github-excellence`, `husk-sti`, `verify-command-block`, `git-fast-tidsstempel`
- Projektdokument: `claude/design-grundlag.md`
- `action.yml` for `actions/create-github-app-token` ved v3.4.0 (SHA `f418cff399f7aef4c2f0ad47e25ca7a6abbdd6fc`)

`verify_block.py` findes ikke i dette repo. Navne i CLI-blokke er derfor tjekket manuelt mod filerne og mod `gh --help` (gh 2.89.0 i denne session; Jans version er ikke målt).

---

**STOP. Ingen `git commit` eller `push` er udført. Jan committer efter gennemgang.**
