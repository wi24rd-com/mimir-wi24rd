# WALKTHROUGH B4: telefon, QR-kode, husk på enheden, offentlig forside og badge-koder

Executor: Claude (Fable 5.2), 2026-11-21. Bygget efter `INVESTIGATION-B4-2026-11-21.md` og Jans svar: Face ID og fingeraftryk med nu; punkt 2 til 5 som anbefalet.

## §C.0 Evidence

```
$ ls -la asewave/evidence/   (nye filer: størrelse, navn)
18871 37-npm-test-b4.txt
3940 38-browser-flow-b4.json
2165 39-browser-flow-regression.json
404 40-qr-read-back.txt
46314 41-front-dark-en.png
69337 42-lock-remember-dark-en.png
138050 43-phone-dialog-dark-en.png
174093 44-badge-codes-dark-en.png
41599 45-lock-remembered-dark-en.png
35743 46-front-phone-light-da.png
45583 47-lock-phone-light-da.png
18128 48-app-icon-512.png

$ shasum -a 256 asewave/evidence/* | awk '{print $1}' | sort | uniq -d     (skal være tom)
(tom)

$ npm test | tail -9     (asewave/evidence/37-npm-test-b4.txt)
1..102
# tests 102
# suites 0
# pass 102
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2602.951426

$ node check.mjs   (every generated code read back by the independent decoder jsqr 1.4.0; not part of Mimir)
{"texts":12,"readings":108,"failed":0,"versions":[1,3,3,1,2,4,5,6,7,8,9,9],"format0":"101010000010010","version7":"7c94","version9":"9a99"}

$ node qrshot.mjs b4-qr-only.png   (the code as drawn in the dialog, read back from the screenshot)
{"b4-qr-only.png":"https://example.github.io/mimir/"}

$ uddrag af asewave/evidence/38-browser-flow-b4.json
  (demo, krypteret, --front, Chrome uden skærm med en simuleret fingeraftrykslæser, åbnet på http://localhost)
"frontRows": ["Total downloads = 618", "Stars = 268", "Downloads of lantern = 581", "Downloads of quill-notes = 37", "Downloads of tidepool = 0"]
"frontHasPassField": false
"frontLeaks": false
"wrong": {"message": "That passphrase does not open the file. Check for a missing character and try again.", "stillLocked": true, "remembered": null}
"can": {"plain": true, "bio": true}
"noticeAfterBio": "✓This device now remembers your passphrase and will ask for Face ID, a fingerprint or the device PIN."
"credentials": 1
"stored": [{"kind": "bio", "keys": ["ct", "id", "iv", "kind", "salt"], "text": false}]
"webStorage": "{\"local\":{},\"session\":{}}"
"phoneAddress": "https://example.github.io/mimir/"
"qrColors": {"light": "rgb(255, 255, 255)", "dark": "rgb(7, 14, 23)"}
"badgeNames": ["Total downloads", "Stars", "Downloads of lantern", "Downloads of quill-notes", "Downloads of tidepool"]
"afterReload": {"front": false, "body": "This device remembers your passphrase. It asks for Face ID, a fingerprint or the device PIN before it opens.", "buttons": ["Open with Face ID or fingerprint", "Open with passphrase", "Forget this device"]}
"openedWithBio": "699 views and 88 clones in the last 14 days."
"refused": {"message": "!The check did not go through. Try again, or enter the passphrase.", "stillLocked": true}
"afterForget": {"message": "iThis device no longer remembers your passphrase. A passkey that was made for Mimir is still in your password manager; delete it there if you like.", "kind": null}
"plainWarningShown": "Without that check, anyone holding this unlocked device can open the figures."
"plainReload": {"openedDirectly": true}
"plainAfterLock": {"locked": true, "buttons": ["Open", "Open with passphrase", "Forget this device"]}
"noPrf": {"notice": "!This device or its password manager cannot protect a passphrase with Face ID or a fingerprint. Nothing was remembered.", "kind": null}
"numericAddress": {"can": {"plain": true, "bio": false}, "boxes": ["Passphrase", "Remember on this device"]}
"manifest": {"name": "Wi24rd Mimir", "display": "standalone", "start_url": "./", "icons": ["icons/icon-192.png 200", "icons/icon-512.png 200", "icons/icon-maskable-512.png 200", "icons/apple-touch-icon.png 200"], "linked": "manifest.webmanifest"}
"frontDa": {"title": "Tal fra GitHub", "button": "Åbn dine tal"}
"problems": []
"external": []

$ uddrag af asewave/evidence/39-browser-flow-regression.json     (det eksisterende forløb, uden --front)
"tabs": ["Overview*", "Traffic", "Downloads", "Sources", "The Well"]
"commands": ["Fetch again (primary)", "14 days (pressed)", "30 days", "90 days", "Everything", "Open on phone", "More"]
"wellStones": 90
"lockedAgain": true
"problems": []
"external": []
```

Skærmbilleder, alle med opdigtede tal: `41` forsiden, `42` låseskærmen med "husk", `43` telefon-dialogen med QR-kode, `44` badge-koderne, `45` låseskærmen på en enhed, der husker, `46` og `47` forside og låseskærm i telefonbredde på dansk, `48` app-ikonet, `49` låseskærmen i demoen. `50` er afprøvningen af den rigtige vej uden demo.

Scope: Claudes arbejdskopi er ikke et git-repo. Jans `git status` efter overførslen står i overdragelsen.

## Hvad der er bygget

| Del | Filer | Indhold |
|---|---|---|
| QR-kode | `docs/lib/qr.js`, `test/qr.test.mjs` | Egen QR-tegner uden afhængigheder: byte-tilstand, fejlretning M, version 1 til 9 (op til 180 tegn) |
| Offentlige tal | `docs/lib/public.js`, `src/collect.mjs`, `docs/lib/config.js`, `test/public.test.mjs` | Nyt valg `repo_downloads`; `public.json` på `data`-grenen; filer for fravalgte tal fjernes; badges i teal |
| Husk på enheden | `docs/lib/remember.js`, `test/remember.test.mjs` | To måder: med passkey (Face ID, fingeraftryk eller enhedens kode) og uden |
| Forside, låseskærm, telefon-dialog, badge-koder | `docs/app.js`, `docs/app.css`, `docs/lib/i18n.js` | Se nedenfor |
| App på hjemmeskærmen | `docs/manifest.webmanifest`, `docs/icons/*`, `docs/index.html`, `docs/favicon.svg` | Manifest, fire ikoner i teal, `manifest-src` i CSP |
| Lokalt dashboard | `src/dashboard.mjs`, `src/lib/data.mjs` | `/data/public`, `--front`, svarer også på `localhost`, demoen har egne indstillinger |
| Tekst | `README.md` | To nye afsnit: "On your phone" og "Badges and published figures" |

## Status pr. punkt

| Punkt | Status |
|---|---|
| QR-kode med kun adressen | Bygget som beskrevet. 108 af 108 genererede koder læst tilbage af en uafhængig læser; koden i dialogen læst tilbage fra skærmbilledet |
| Skal ligne en app | Bygget som beskrevet, uden service worker (beslutning 4). Uprøvet på telefon |
| Husk, med Face ID eller fingeraftryk | Bygget. Afprøvet med Chromes simulerede læser: opret, åbn, afvist tjek, glem, og en læser, der ikke kan |
| Husk, uden tjek | Bygget som model A i undersøgelsen |
| Offentlig forside | Bygget. Vises kun, når siden kører på Pages (eller med `--front`), tallene er krypterede, og enheden ikke husker noget |
| Kopiklare badge-koder | Bygget i indstillingerne, Markdown og HTML pr. tal |
| Teal på badges og ikon (beslutning 3) | Badges `007864`; favicon og app-ikoner i kittets `--accent-on-rail` på `--rail` |

## Deviation-liste

1. **Det lokale dashboard svarer nu også på `localhost`**, ikke kun `127.0.0.1`. Browsere afviser passkeys på en talbaseret adresse, og uden dette kunne biometrien hverken afprøves eller bruges lokalt. Serveren lytter stadig kun på denne computer.
2. **Indsamleren sletter nu badge-filer for fravalgte tal.** Før blev et fravalgt tal liggende offentligt på `data`-grenen. Det var en fejl i B1, fundet her.
3. **Demoen har fået egne indstillinger.** Før viste indstillingerne i demoen navnene fra den rigtige `mimir.json`.
4. **Kommandoen "Open on phone" har fået sin egen gruppe i båndet** efter Periode. Det står ikke i undersøgelsen.
5. **Offentlige tal vælges samlet:** `repo_downloads` udgiver ét tal for hvert repository i listen. Man kan ikke vælge enkelte repositories til og fra.
6. **Passkeyen kan ikke slettes af Mimir.** "Forget this device" fjerner det gemte; passkeyen bliver i adgangskodeprogrammet, og det siger teksten.
7. **En enhed, der husker uden tjek, åbner direkte** ved opstart og springer forsiden over. Efter "Lock" åbner den først, når man trykker.
8. **Fodlinjen siger stadig "Only in this browser"** på forsiden, selv om forsiden kun viser offentlige tal. Ikke rettet.
9. **Banneret og billederne i `assets/` er stadig cyan.** De er Jans grafik fra ChatGPT og er ikke rørt.
10. **Ny test af Mimirs egen CSS:** hver token, der bruges uden reserveværdi, skal findes. Den fangede en fejl undervejs (`--space-5` findes ikke i kittet).
11. **Demoen siger nu, at den er en demo.** Jan prøvede sin rigtige adgangsfrase i demoen, som ikke kan åbnes med den, og intet på siden afslørede forskellen. Titellinjen har fået mærket "Demo", låseskærmen en linje om det, og terminalen skriver "(demo, invented figures)". Den rigtige vej er afprøvet særskilt (`50`), skærmbillede i `49`.
12. **Det lokale dashboard svarer med en tom liste**, når intet er offentliggjort, i stedet for en 404, som gav en fejllinje i browserens konsol.
13. **Telefon-dialogen er gjort bredere** efter Jans ønske, med kittets egen brede dialog (620 px mod 480). Højden faldt til 547 px i demoen (`51`).

## Kendte begrænsninger og uprøvede antagelser

- **Intet er prøvet på en rigtig telefon eller på GitHub Pages.** Det gælder installation på hjemmeskærmen, Face ID, fingeraftryk og om appen på iPhone deler lager med Safari.
- **Biometrien er kun prøvet med Chromes simulerede læser.** Rigtige telefoner og adgangskodeprogrammer opfører sig forskelligt. Safari kan kræve, at passkeyen oprettes i direkte forlængelse af et tryk; Mimir regner først nøglen ud og opretter den derefter.
- **Badge-kæden er ubevist.** Koderne er rigtige ifølge shields.io's format, men ingen badge-fil er skrevet for alvor, og repositoryet er privat.
- **Alle Pages-sider på samme konto deler lager.** Det står i README og ved tilvalget.
- **Uden tjek** kan enhver med den oplåste enhed åbne tallene, og anden kode på samme adresse kan bruge det gemte.
- **Gættet på ejer og repository** ud fra adressen virker stadig ikke på eget domæne.
- Svagheden fra B3 (hele skallen tegnes om) gælder stadig.

## Læste regelfiler

Ingen nye. Kittets `kit.js` er læst for `afkrydsning`, `knap`, `banner` og `registrerIkoner`. Kopierne i `docs/kit/` er ikke ændret; testen, der vogter dem, består.

---

**STOP. Ingen `git commit` eller `push` er udført. Jan committer efter gennemgang.**
