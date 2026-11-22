# INVESTIGATION B2: se tallene (terminal og dashboard)

**Executor:** Claude (Fable 5.2), cloud-session
**Dato:** 2026-11-21
**Fase:** ASEWAVE Fase A. Read-only. Ingen implementering.
**Udgangspunkt:** B1 er verificeret hos Jan: kørsel 44894771589, "30 of 30 requests succeeded, mode encrypted". Repoet `wi24rd-com/mimir` er privat.

---

## §C.0 Evidence

Jans kørsler (indsat af Jan i tråden):

```
X  44894011942  Get a short-lived token: "at least one repository ... not accessible to the parent installation"
X  44894430636  Mimir 2026-11-21: 5 repos, 29 of 30 requests succeeded, mode encrypted.
                Your Mimir app cannot read traffic for: wi24rd-com/wi24rd-com
                data-gren: raw/2026-11-21.enc, state.enc
✓  44894771589  Mimir 2026-11-21: 5 repos, 30 of 30 requests succeeded, mode encrypted.
```

Browser-vejen kørt i Node v22.23.5 med kun WebCrypto og DecompressionStream (`/tmp/browser-path.mjs`):

```
same data: true
two years x five repos: plain bytes 139246 | encrypted file bytes 7951
key derivation ms (this machine, 600000 rounds): 129
```

CORS på rå filer (offentligt repo, `Origin: https://wi24rd-com.github.io`):

```
HTTP/2 200
cache-control: max-age=300
access-control-allow-origin: *
```

Min adgang til `wi24rd-com/mimir`: `add_repo` svarede "you don't have access", og GitHub-connectoren gav 404. Jeg kan altså ikke læse repoet eller data-grenen herfra.

---

## Spørgsmål 1: Kan dashboardet ligge på GitHub Pages i dag?

**Nej.** Repoet er privat, og GitHub Free giver kun Pages i offentlige repos (bekræftet i B1-undersøgelsen). Et dashboard på Pages kræver, at repoet gøres offentligt, eller GitHub Pro.

## Spørgsmål 2: Opdateres Pages, når workflowet skriver nye data?

**AFKRÆFTET for den enkle løsning.** GitHubs dokumentation siger: "Commits pushed by a GitHub Actions workflow that uses the GITHUB_TOKEN do not trigger a GitHub Pages build." Workflowet skriver netop til `data`-grenen med den token. Pages udgivet direkte fra `data`-grenen ville derfor vise gamle tal.

To veje uden om:
- **A.** Dashboardet ligger som statisk side og henter `state.enc` ved hver visning fra `raw.githubusercontent.com`. Proben ovenfor viser `access-control-allow-origin: *`, så browseren må læse filen. Svaret caches i 300 sekunder. Ingen ekstra Actions.
- **B.** Workflowet udgiver selv Pages med `actions/upload-pages-artifact` og `actions/deploy-pages`. To afhængigheder mere, og rettigheden `pages: write`.

Vej A er enklest, men virker kun for offentlige repos. Rå filer fra private repos kræver en nøgle.

## Spørgsmål 3: Kan en browser åbne de krypterede filer?

**BEKRÆFTET for koden, ikke for en rigtig browser.** Kørslen ovenfor åbner en Mimir-fil udelukkende med WebCrypto og `DecompressionStream`. `DecompressionStream` med gzip findes i Chrome 80, Firefox 113 og Safari 16.4 (web.dev, MDN: "Baseline Widely available").

To års data for fem repos fylder cirka 8 KB krypteret. Nøgleafledningen tog 129 ms på denne maskine; en telefon er langsommere. Ikke målt.

## Spørgsmål 4: Virker det, hvis siden åbnes som lokal fil?

**KUNNE IKKE AFGØRES.** `crypto.subtle` kræver en "secure context". Kilderne siger entydigt, at HTTPS og `localhost` tæller. Om `file://` tæller, er ikke ens på tværs af browsere, og jeg fandt intet klart svar for Safari.

Konsekvens: et lokalt dashboard skal vises via `http://127.0.0.1:<port>` fra en lille lokal server, ikke åbnes som fil. Det mønster er allerede testet i opsætningen.

## Spørgsmål 5: Hvor kommer data fra, når dashboardet kører lokalt?

Fra `data`-grenen i Jans egen klon: `git fetch origin data` og derefter `git show origin/data:state.enc`. Det kræver ingen nøgle ud over den, `git` allerede bruger, og det virker i alle tre tilstande, også mens repoet er privat. Kommandoen `git ls-tree origin/data` er kørt af Jan i dag og viste begge filer.

Ikke afprøvet: at læse filen med `git show` fra Node.

## Spørgsmål 6: Hvordan får værktøjet passphrasen?

Ingen hemmeligheder i kommandoer (skill `husk-sti`). Mulighederne:
- Spørge i terminalen uden at vise det tastede. Kræver ingen opsætning.
- macOS-nøgleringen via `security find-generic-password`. Bekvemt, men kun macOS. Ikke undersøgt.
- I dashboardet: et felt på siden. Passphrasen bliver i fanens hukommelse og gemmes ikke.

## Spørgsmål 7: Design

Designgrundlaget (`claude/design-grundlag.md`) foreskriver Outfit og JetBrains Mono. At hente skrifttyper fra en ekstern tjeneste ville bryde løftet om, at intet sendes andre steder hen. Mulighederne er systemskrifter eller at lægge skriftfilerne (OFL) i repoet. Ikke afgjort.

Grafer skal skrives som SVG i hånden for at holde nul afhængigheder. Skillen `dataviz` skal læses, før der skrives grafkode.

## Spørgsmål 8: Fejlen i optællingen fra B1

**BEKRÆFTET.** Kørsel 44894430636 skrev "29 of 30", selv om fire traffic-kald blev sprunget over. Årsag: `src/collect.mjs` registrerer ét fejlpunkt for et repo uden adgang, men regner stadig med seks forsøg. Dataene er korrekte; linjen i loggen er misvisende.

---

## Deviation-liste

Afvigelser fra det, jeg skrev tidligere i tråden:

1. **"Dashboard på Pages" kan ikke være første skridt.** Repoet er privat, og Pages ville alligevel ikke blive opdateret af data-commits.
2. **Det krypterede dashboard på Pages** forudsætter et offentligt repo. Det var underforstået før, men ikke sagt tydeligt.
3. Ingen nye afvigelser i forhold til B1-walkthroughen.

## Sideeffekt-fund

- Issuet "Mimir: collection failed" fra de to fejlede kørsler står formentlig stadig åbent. Workflowet lukker det ikke selv, når en kørsel lykkes igen.
- Workflowet opretter issuet, men ingen fortæller brugeren, at den næste kørsel gik godt.

## Forslag til B2 (til beslutning, ikke en plan)

**B2a, virker i dag med privat repo:**
1. Ret optællingen (spørgsmål 8), og lad en vellykket kørsel lukke fejl-issuet.
2. `node src/show.mjs`: henter `data`-grenen, spørger om passphrasen og skriver en opsummering i klart sprog i terminalen.
3. `node src/dashboard.mjs`: samme data som side på `http://127.0.0.1`, med grafer.

**B2b, når repoet er offentligt:** den samme side på Pages efter vej A.

## Skal testes først i Fase B

1. `git show origin/data:state.enc` læst fra Node på Jans Mac.
2. Siden åbnet i Safari og én anden browser på `127.0.0.1`.
3. Nøgleafledningens tid i en rigtig browser.

---

**STOP. Venter på Jan + Cowork-Claude green-light.**
