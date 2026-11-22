# INVESTIGATION B4: telefon, QR-kode, offentlig forside og badge-koder

Executor: Claude (Fable 5.2), 2026-11-21. Fase A: kun undersøgelse, intet er bygget.

Jans bestilling i samtalen: en QR-kode i den oplåste del, så dashboardet nemt åbnes på telefonen og ligner en app; "husk på denne enhed" som tilvalg; en offentlig forside på Pages med tal, man selv har valgt; kopiklare felter med badge-koder til README-filer. Jans valg indtil nu: kun adressen i QR-koden, og "husk" som tilvalg pr. enhed.

## §C.0 Evidence

```
$ git log --oneline -1 && git --no-optional-locks status -sb      (Jans mappe, Mimir)
1c02b69 Mimir: The Well, a fifth tab that draws the figures as one picture
## main...origin/main

$ grep -n "const salt = randomBytes" src/lib/crypto.mjs
19:  const salt = randomBytes(16);

$ grep -n "color: '22d3ee'" src/collect.mjs
93:    writeFileSync(join(dir, 'badges', `${name}.json`), JSON.stringify({ schemaVersion: 1, label, message: String(value), color: '22d3ee' }) + '\n');

$ grep -n "location.hostname.split" docs/app.js
64:  const owner = location.hostname.split('.')[0];

$ sed -n 6p docs/index.html     (afkortet)
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self' https://raw.githubusercontent.com; base-uri 'none'; form-action 'none'">

$ grep -n "BADGES" docs/lib/config.js | head -1
5:export const BADGES = ['total_downloads', 'stars'];

$ cat mimir.json | grep public_badges
  "public_badges": []

$ GitHub-søgning user:wi24rd-com  (via GitHub-forbindelsen)
5 offentlige repositories: wi24rd-com, huginn-muninn, Wi24rd-Site-Kit, grimnir, Wi24rd-FTP. Ingen hedder wi24rd-com.github.io.

$ npm view jsqr version     (kun til afprøvning hos Claude, ikke en afhængighed)
1.4.0
```

## 1. Hvad møder en besøgende på Pages i dag?

Læst i `docs/app.js:59-68` og `:465-476`. På Pages gætter siden ejer og repository ud fra adressen (`<ejer>.github.io/<repo>/`) og henter `state.enc` eller `state.json` fra `data`-grenen på raw.githubusercontent.com.

- **Krypteret:** kun låseskærmen (`unlockView`, `docs/app.js:432`). Ingen forklaring til en fremmed.
- **Offentlig:** hele dashboardet uden lås.
- Der findes ingen forside for besøgende.

Uprøvet: Pages har aldrig kørt. **Fund:** gættet på ejer og repository virker ikke på et eget domæne (f.eks. `wi24rd.com/mimir`). Det er ikke et problem i dag, for der blev ikke fundet noget `wi24rd-com.github.io`-repository. Private repositories kunne ikke ses.

## 2. QR-kode

Kan bygges uden afhængigheder som en ren funktion (`docs/lib/qr.js`): tekst ind, et gitter af sorte og hvide felter ud, tegnet som SVG. En Pages-adresse er 30 til 80 tegn og kræver kun de små QR-versioner.

- **Indhold:** kun adressen (Jans valg). Ingen passphrase.
- **Afprøvning:** egne tests af funktionen, og hos Claude læses den tegnede kode tilbage med en uafhængig læser (`jsqr`), som ikke bliver en del af Mimir. Ikke gjort endnu.
- **Placering:** en kommando "Phone" i båndet, som åbner en dialog med koden, adressen i et kopifelt og tre linjer om "føj til hjemmeskærm".
- **Lokalt dashboard:** koden peger på Pages-adressen udledt af repositoryets navn. Siden kan ikke vide, om Pages er slået til, så dialogen siger det.

## 3. Skal ligne en app

Kilder: web.dev, Chromes udviklerblog, firt.dev (se nederst).

- **Det kræver:** en manifestfil (navn, `display: standalone`, farver, ikoner på 192 og 512 px), et `apple-touch-icon` på 180 px som PNG, og `manifest-src 'self'` i sidens CSP.
- **Android (Chrome):** kan installeres fra menuen uden service worker siden version 108.
- **iPhone:** ingen installationsknap; brugeren vælger selv Del og "Føj til hjemmeskærm". Fra iOS 26 åbner en side fra hjemmeskærmen som app som standard; før det kræves `display: standalone` i manifestet.
- **Service worker:** foreslås udeladt. Uden den virker appen ikke uden net, men der er heller ingen risiko for, at telefonen hænger fast i en gammel udgave af koden.
- **Ikoner:** kan udledes af det eksisterende mærke i de tre størrelser; ingen ny grafik.

Uprøvet: alt på rigtige telefoner. Uvist: om appen på hjemmeskærmen på iPhone deler lager med Safari. Er det adskilt, skal "husk" slås til inde i appen.

## 4. "Husk på denne enhed"

**Rettelse af det, Claude sagde tidligere:** telefonen kan ikke gemme en afledt nøgle. Hver indsamling krypterer med et nyt tilfældigt salt (`src/lib/crypto.mjs:19`), og filen skiftes to gange i døgnet, så en gemt nøgle passer ikke til næste fil. Det, der skal huskes, er selve passphrasen.

| Model | Sådan | Beskytter mod | Beskytter ikke mod |
|---|---|---|---|
| **A (anbefalet nu)** | Passphrasen gemmes krypteret i browserens IndexedDB under en nøgle, browseren ikke vil udlevere | Aflæsning af lagerfiler og sikkerhedskopier | Enhver med den oplåste telefon; anden kode på samme adresse |
| **B (senere)** | En passkey med Face ID eller fingeraftryk låser passphrasen op (WebAuthn PRF) | Også en oplåst telefon i andres hænder | Uens understøttelse: bredt på Android, iPhone fra iOS 18.4, afhænger af adgangskodeprogrammet |

**Vigtigt fund:** alle Pages-sider på samme konto deler adresse (`wi24rd-com.github.io`), og browserens lager følger adressen, ikke mappen. En anden Pages-side på kontoen kan derfor læse det, Mimir gemmer. I dag er der ingen andre fundet, men det skal stå i README, og tilvalget skal sige det.

Foreslået opførsel: et afkrydsningsfelt på låseskærmen, slået fra fra start. "Lock" låser som nu. En ny "Forget this device" sletter det gemte. Skifter passphrasen, fejler den gemte, og siden beder om den nye.

## 5. Offentlig forside

Forslag: listen `public_badges` i `mimir.json` bliver det ene sted, hvor man vælger, hvad der er offentligt. Indsamleren skriver i forvejen ét lille åbent JSON-dokument pr. valgt tal på `data`-grenen (`src/collect.mjs:88-95`); forsiden læser de samme filer.

- **Krypteret med valgte tal:** forside med navnet, de valgte tal og knappen "Open your figures".
- **Krypteret uden valgte tal:** forside med navnet, én forklarende linje og samme knap.
- **Offentlig:** som nu, direkte til dashboardet.

I dag kan kun to tal vælges: downloads i alt og stjerner (`docs/lib/config.js:5`). Flere kræver en udvidelse af listen. Siden har `noindex`, så søgemaskiner bedes blive væk.

## 6. Kopiklare badge-koder

Filerne har allerede det format, shields.io læser. Koden til en README bliver:

```
![Downloads](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2F<ejer>%2F<repo>%2Fdata%2Fbadges%2Ftotal_downloads.json)
```

- **Placering:** i indstillingerne under hvert valgt tal: ét felt med Markdown og ét med HTML, hver med kopiknap.
- **Forudsætter:** offentligt repository, og at tallet er valgt og indsamlet mindst én gang.
- **Afhængighed:** billedet tegnes af shields.io, en tjeneste uden for GitHub. Mimir henter intet derfra; det gør læserens browser.
- **Ingen forhåndsvisning** fra shields.io i dashboardet, så reglen "ingen forespørgsler udadtil" holder.

Uprøvet: der er aldrig skrevet en badge-fil (listen er tom), og repositoryet er privat, så hele kæden er ubevist.

## Sideeffekt-fund (flages, rettes ikke her)

1. Badges farves cyan (`22d3ee`) og `docs/favicon.svg` er cyan på mørkeblå, mens programmet er teal.
2. Kopien af B3-walkthroughen i projektets dokumenter mangler tillægget om Brønden.
3. Gættet på ejer og repository (punkt 1) holder ikke på eget domæne.

## Beslutninger, Jan skal træffe

1. **Husk:** model A nu og passkey som en senere runde? (anbefalet)
2. **Offentlige tal:** de to nuværende plus downloads pr. repository? Visninger og kloninger tilbydes ikke. (anbefalet)
3. **Farve på badges og app-ikon:** teal som programmet (anbefalet) eller cyan som wi24rd.com?
4. **Service worker:** udelades? (anbefalet)
5. **Rækkefølge:** bygge og afprøve med opdigtede tal nu, og derefter gøre repositoryet offentligt med Pages for den rigtige prøve? (anbefalet)

## Deviation-liste

- Undersøgelsen er skrevet i Claudes arbejdskopi og i projektets dokumenter. Den lægges i Jans mappe sammen med bygningen, så der ikke overføres filer to gange.
- Ingen regelfiler er læst i denne runde; spørgsmålene kommer fra samtalen.
- Intet er afprøvet på en telefon eller på Pages.

## Kilder

- Chrome: https://developer.chrome.com/blog/update-install-criteria
- web.dev: https://web.dev/learn/pwa/enhancements
- firt.dev: https://firt.dev/notes/pwa-ios/
- Corbado om WebAuthn PRF: https://www.corbado.com/blog/passkeys-prf-webauthn
- Delt lager på Pages: https://tomashubelbauer.github.io/github-pages-local-storage

---

**STOP. Venter på Jans green-light.**
