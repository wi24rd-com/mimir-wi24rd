# Changelog

What each version of Wi24rd Mimir holds. Versions follow
[semantic versioning](https://semver.org): within 1.x, a newer version reads the
`mimir.json` and the `data` branch of an older one with nothing for you to do.
Take a newer version with `node src/update.mjs`.

## 1.0.1 (2026-11-22)

- Fixed: the tests required the README to state the version. A copy keeps its
  own README through an update, so its tests would fail after the next one.
  The check now applies to this repository only.
- The README links to a live example: Wi24rd's own figures.

## 1.0.0 (2026-11-22)

The first release.

### Collecting

- Views, clones, referrers and popular pages for the repositories you choose,
  twice a day, before GitHub's 14 days run out. Release downloads and stars as well.
- Stored in a `data` branch of your own copy, in one of three modes: `encrypted`
  (AES-256-GCM under a passphrase), `public` or `private`.
- Read with a GitHub App of your own that has one read permission, through a
  token that lives for one hour.
- Commits on the `data` branch carry the day only, not the time.
- A failed collection opens an issue; the next good one closes it.

### Setting up

- `install.sh`, or two lines with the GitHub CLI, or "Use this template".
- A guided setup: pick repositories from a list, choose how the figures are
  stored and what is published, and it writes `mimir.json`, creates the app,
  switches GitHub Pages on and follows the first collection to its end.
- Setup can be run again; what is done is skipped.

### Seeing

- A dashboard in English and Danish, light and dark, for computer and phone,
  served on your own computer or on GitHub Pages. The start page has the totals
  in a sentence, The Well with the figures beside it, and a chart for each
  repository. Three more views hold the details: Traffic, Downloads and Sources.
- A summary in the terminal (`node src/show.mjs`).
- A demo with invented figures: add `?demo` to the address.
- "Remember on this device", with or without a passkey.

### Publishing

- Badges for downloads and stars, and The Well on a public front page. Nothing
  is published unless you choose it.

### Keeping it running

- `node src/update.mjs` takes a newer version without touching your settings or
  your figures.
- A guard against GitHub pausing the schedule after 60 days without activity:
  the workflow switches itself on again at every run, an issue warns after 45
  quiet days, and the dashboard says why when collection has stopped.

### Known limits

- Whether the guard prevents the pause has not been proven over a full 60 days.
- Not tried on Android, in Safari itself, or as a home-screen app.
- All followed repositories must belong to one account, and at most 100.
- Solo-maintained in spare time. No support promise, no response times.
