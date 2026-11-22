/* Wi24rd UI Kit 2 — sprog: mekanikken (window.KitSprog). Programmet ejer teksterne; kittet ejer opslaget, ental og
   flertal, udfyldningen af siden og sprogskiftet. Programmets egen fil (typisk sprog.js, lige efter denne) gør:
     window.Sprog = window.KitSprog.opret({ tekst: { da: {…}, en: {…} }, standard: 'da', titel: 'dokTitel' });
   og kit.js' elementer (data-t m.fl.) udfyldes så af Sprog.anvend(rod). Første sprog i tekst er det, alle nøgler måles mod.
   anvend(rod) udfylder:
     data-t="noegle"        → textContent
     data-t-aria="noegle"   → aria-label
     data-t-title="noegle"  → title
     data-t-ph="noegle"     → placeholder
   {v} og {w} i en tekst erstattes af elementets data-v og data-w (fx et versionsnummer eller to antal);
   {v:ental|flertal} vælger formen efter antallet (se t). saet(sprog) skifter straks uden genindlæsning, husker valget i
   localStorage[noegle] og melder haendelse på document.
   o: { tekst, standard (ellers første sprog), noegle (ellers '<præfiks>-sprog', præfikset fra <html data-kit-praefiks>,
        standard wi24rd), haendelse (ellers som noegle), titel (nøglen til document.title; udelades den, røres titlen ikke) }. */
(function () {
  'use strict';
  /* Ental og flertal. {v:ental|flertal} i en tekst vælger formen efter {v}, {w:ental|flertal} efter {w}: ental kun ved
     præcis 1, flertal ved 0, 2 og flere (og når tallet mangler, fx "…"). En form må selv indeholde {v} eller {w}. Hver
     tekst med et antal bruger mønsteret i alle sprog, også hvor formerne er ens ("{v:fund|fund}"). */
  const FORM = /\{([vw]):((?:[^{}|]|\{[vw]\})*)\|((?:[^{}|]|\{[vw]\})*)\}/g;
  const ental = x => x != null && String(x).trim() === '1';
  const ATTR = [['data-t', null], ['data-t-aria', 'aria-label'], ['data-t-title', 'title'], ['data-t-ph', 'placeholder']];

  function opret(o) {
    const TEKST = o.tekst;
    const SPROG = Object.keys(TEKST);
    const standard = o.standard || SPROG[0];
    const NOEGLE = o.noegle || (document.documentElement.getAttribute('data-kit-praefiks') || 'wi24rd') + '-sprog';
    const HAENDELSE = o.haendelse || NOEGLE;
    let lang = standard;
    try {
      const v = localStorage.getItem(NOEGLE);
      if (SPROG.includes(v)) lang = v;
    } catch (e) { /* ingen lagring: standardsproget */ }

    const t = (k, v, w) => {
      let s = TEKST[lang][k];
      if (s == null) return null;
      s = s.replace(FORM, (_, hvem, en, fler) => (ental(hvem === 'v' ? v : w) ? en : fler));
      if (v != null) s = s.replace(/\{v\}/g, String(v));
      if (w != null) s = s.replace(/\{w\}/g, String(w));
      return s;
    };

    function anvend(rod) {
      const r = rod || document;
      for (const [kilde, maal] of ATTR) {
        const liste = [...r.querySelectorAll(`[${kilde}]`)];
        if (r.nodeType === 1 && r.hasAttribute(kilde)) liste.push(r);
        for (const el of liste) {
          const tekst = t(el.getAttribute(kilde), el.getAttribute('data-v'), el.getAttribute('data-w'));
          if (tekst == null) continue;
          if (maal) el.setAttribute(maal, tekst);
          else el.textContent = tekst;
        }
      }
      document.documentElement.lang = lang;
      if (o.titel) document.title = t(o.titel);
    }

    function saet(l) {
      lang = SPROG.includes(l) ? l : standard;
      try { localStorage.setItem(NOEGLE, lang); } catch (e) { /* valget gælder kun denne gang */ }
      anvend(document);
      document.dispatchEvent(new CustomEvent(HAENDELSE));
    }

    return { TEKST, SPROG, get lang() { return lang; }, t, anvend, saet };
  }

  window.KitSprog = Object.freeze({ opret });
})();
