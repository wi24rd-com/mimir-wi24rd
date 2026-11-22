# WALKTHROUGH B8: guidet installation, `install.sh` og `gh repo create`

Executor: Claude (Fable 5.2), 2026-11-22. Jan spurgte før prøven fra bunden, om installationen kan guides fra et script, og bad om, at folk får valget mellem en `install.sh` og `gh repo create`. Udgangspunkt: commit `6bf03eb` på `main`.

## §C.0 Evidence

```
$ node --test     (asewave/evidence/79-npm-test-b8.txt, Node v22)
# tests 145
# pass 145
# fail 0

$ shellcheck -s sh install.sh ; sh -n install.sh     (80, shellcheck 0.11.0)
exit code: 0
exit code: 0

$ actionlint .github/workflows/collect.yml .github/workflows/test.yml     (80, nu med shellcheck)
exit code: 0

$ node src/setup.mjs i en skrabet kopi med stedfortrædere for gh, "git push" og browseren     (78)
Question 1 of 3: which repositories should Mimir follow?
...
gh repo list octo --source --no-archived --limit 200 --json nameWithOwner,visibility
git push --quiet
gh api --method POST repos/octo/mimir/pages -f source[branch]=main -f source[path]=/docs --jq .html_url
gh workflow run collect.yml
commit: "Follow my repositories", 1 fil ændret (mimir.json)
```

## Hvad der er bygget

| Fil | Ændring |
|---|---|
| `install.sh` | Nyt. Tjekker git, gh, Node 20 og at man er logget ind. Spørger om navn og offentlig eller privat, viser hvad der bliver oprettet, og opretter først efter et ja. Kører `gh repo create --template wi24rd-com/mimir --clone`, venter på at GitHub har fyldt kopien, og starter setup i den. Installerer intet. I en eksisterende kopi starter den kun setup |
| `src/guide.mjs` | Nyt. De tre spørgsmål: hvilke repositories (valgt fra en liste over ens egne), hvordan tallene gemmes, og om noget udgives. Viser den `mimir.json`, der kommer ud af det, og gemmer, committer og pusher først efter et ja |
| `src/setup.mjs` | En frisk kopi med eksemplet i `mimir.json` afvises ikke længere; setup spørger. Efter appen slår setup Pages til (`main`, `/docs`) og skriver adressen. Til sidst en kort status. Kan køres igen: det, der er gjort, springes over |
| `README.md` | "Setup" skrevet om: tre veje ind (installer, GitHub CLI, i hånden) og de syv trin, setup tager én igennem |
| `SECURITY.md` | En linje om, hvad `install.sh` gør, og at den bør læses før brug |
| `src/update-paths.json` | `install.sh` er med i de filer, en opdatering erstatter |
| `test/guide.test.mjs`, `test/install.test.mjs`, `test/setup.test.mjs`, `test/config.test.mjs` | 18 nye tests |

## Sådan er det afprøvet

**Spørgsmålene** er prøvet med indtastede svar og en stedfortræder for `gh`: standardsvarene giver en krypteret opsætning, der intet udgiver; private repositories er mærket; et privat navn kommer ikke i en offentlig `mimir.json` uden et tydeligt ja; et ulæseligt svar spørges om igen, og fem i træk stopper.

**`install.sh`** er kørt for alvor i 12 forløb med stedfortrædere for `gh`, `git`, `node` og `sleep` på stien: standardsvarene, eget navn og privat, nej til oprettelsen, et optaget navn, et navn med mellemrum og semikolon, et navn der begynder med bindestreg, en mappe der findes i forvejen, ikke logget ind, for gammel Node, filer der kommer sent, filer der aldrig kommer, og kørsel inde i en eksisterende kopi.

**Hele setup** er kørt én gang fra ende til anden i en skrabet kopi (`78`): spørgsmål, `mimir.json`, commit, adgangsfrase, Pages og første indsamling, i den rækkefølge.

## Fund undervejs

1. **Et navn, der begynder med en bindestreg**, slap igennem navnetjekket og ville være blevet læst som et tilvalg af de næste kommandoer. Testen fangede det; sådanne navne afvises nu.

## Deviation-liste

1. **Ingen særskilt undersøgelse (Fase A).** Jan fik beskrevet, hvad der findes, og hvad der kunne bygges, og bad om begge veje.
2. **README viser `install.sh` som hent, læs, kør**, ikke som én linje med et rør ind i en shell. Scriptet virker også gennem et rør, fordi det spørger ved terminalen, men README anbefaler det ikke.
3. **`install.sh` hentes fra `main`**, fordi der ingen tags er. Når 1.0.0 er tagget, bør README pege på tagget.
4. **Tilbuddet om fast klokkeslæt på commits** står i guiden, fordi værktøjet følger med Mimir. Det er slået fra, medmindre man siger ja, og dets egen tekst er på dansk.
5. **Det repository, Mimir selv ligger i, tilbydes ikke i listen.** Det kan tilføjes i `mimir.json`.

## Kendte begrænsninger og uprøvet

- **Intet af dette har talt med GitHub.** `gh repo create --template`, `gh repo list`, kaldet der slår Pages til, og ventetiden på at kopien bliver fyldt, er kun prøvet mod stedfortrædere. Første rigtige prøve er Jans.
- **Oprettelsen af appen i browseren** er ikke rørt i denne runde og ikke prøvet igen.
- **Kun ens egen konto.** Listen hentes for den konto, kopien ligger på. En organisation er ikke prøvet.
- **Flere end 200 repositories** på en konto vises ikke alle i listen.
- **Windows:** `install.sh` kræver en POSIX-shell (Git Bash eller WSL). De to linjer med `gh` virker uden. Ingen af delene er prøvet på Windows.
- **Pages kan tage et par minutter**, før adressen svarer, og setup venter ikke på det.

## Tillæg: fund fra Jans første prøve

Jan kørte `sh install.sh` for alvor samme dag og kaldte kopien `mimir-proeve`. Det virkede mod det rigtige GitHub: `gh repo create --template` oprettede og klonede kopien, filerne var der, setup startede, og listen viste hans 18 repositories med de private mærket. Han svarede nej til at gemme, så intet blev committet, og ingen app blev oprettet.

| Fund | Rettelse |
|---|---|
| Spørgsmål 3 sagde ikke, om tallene skulle skrives med mellemrum, komma eller som `1234` | Teksten siger nu "Numbers with spaces between them (1 2 4)". Med færre end ti valg læses cifre skrevet sammen ét ad gangen, så `1234` også virker. Et ulæseligt svar får et eksempel med i beskeden |
| Advarslen om private navne i en offentlig `mimir.json` stod som én lang linje, og eneste vej videre var ja eller stop | Ét navn pr. linje, og tre valg: lad de private ude (standard), følg dem alligevel, eller stop |
| Efter et stop stod terminalen i mappen over kopien, og intet sagde, hvor setup skulle startes igen | Stop-beskeden slutter med kommandoen, mappen medregnet |

```
$ node --test     (asewave/evidence/82-npm-test-b8-tillaeg.txt)
# tests 145
# pass 145
# fail 0
```

`81` er setup kørt igen i en skrabet kopi med Jans svar ("all", Enter, Enter, "1234", "n"): det private navn er udeladt, `1234` er læst som fire valg, og efter nejet er `mimir.json` urørt.

Stadig uprøvet for alvor efter første prøve: at gemme og pushe `mimir.json`, appen, adgangsfrasen, Pages, første indsamling og badges.

---

**STOP. Ingen `git commit` eller `push` er udført. Jan kører blokkene.**
