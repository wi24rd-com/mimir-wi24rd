/* Wi24rd UI Kit 2 — tema (window.Tema). localStorage['<præfiks>-tema'] = lys | moerk | system (standard: system) →
   <html data-tema>, som vælger farverne i tokens.css. Står uden defer i <head>, så temaet er sat, før siden tegnes første
   gang (intet hvidt blink i mørkt tema). Et skift melder '<præfiks>-tema' på document.
   Præfikset er programmets eget og står på <html data-kit-praefiks="…"> (standard: wi24rd), så to programmer i samme
   webvisning aldrig deler valg. Mønsteret er Huginn and Muninns (ui/assets/tema.js).
   Fra 2.3.0 også tekststørrelsen i tre trin (window.Tekst), efter samme mønster: localStorage['<præfiks>-tekst'] = lille |
   normal | stor (standard: normal) → <html data-tekst="lille | stor">, som kit.css skalerer hele fladen efter (én fælles
   skala: zoom på roden). Normal sætter ingen attribut, så et program, der ikke bruger valget, er præcis som før. Sat før
   første tegning (intet hop); et skift melder '<præfiks>-tekst'. Genvejene (⌘+ ⌘− ⌘0) er programmets; større, mindre og
   nulstil er funktionerne til dem. */
(function () {
  'use strict';
  const NOEGLE = (document.documentElement.getAttribute('data-kit-praefiks') || 'wi24rd') + '-tema';
  const VALG = ['lys', 'moerk', 'system'];
  let valg = 'system';
  try {
    const v = localStorage.getItem(NOEGLE);
    if (VALG.includes(v)) valg = v;
  } catch (e) { /* ingen lagring (fx privat tilstand): temaet følger systemet */ }
  document.documentElement.setAttribute('data-tema', valg);
  window.Tema = {
    VALG,
    get valg() { return valg; },
    saet(v) {
      valg = VALG.includes(v) ? v : 'system';
      try { localStorage.setItem(NOEGLE, valg); } catch (e) { /* valget gælder kun denne gang */ }
      document.documentElement.setAttribute('data-tema', valg);
      document.dispatchEvent(new CustomEvent(NOEGLE));
    },
  };

  const TEKST_NOEGLE = (document.documentElement.getAttribute('data-kit-praefiks') || 'wi24rd') + '-tekst';
  const TRIN = ['lille', 'normal', 'stor'];
  let tekst = 'normal';
  try {
    const v = localStorage.getItem(TEKST_NOEGLE);
    if (TRIN.includes(v)) tekst = v;
  } catch (e) { /* ingen lagring: normal */ }
  function tegnTekst() {
    if (tekst === 'normal') document.documentElement.removeAttribute('data-tekst');
    else document.documentElement.setAttribute('data-tekst', tekst);
  }
  tegnTekst();
  function saetTekst(v) {
    tekst = TRIN.includes(v) ? v : 'normal';
    try { localStorage.setItem(TEKST_NOEGLE, tekst); } catch (e) { /* valget gælder kun denne gang */ }
    tegnTekst();
    document.dispatchEvent(new CustomEvent(TEKST_NOEGLE));
  }
  window.Tekst = {
    TRIN,
    get valg() { return tekst; },
    saet: saetTekst,
    større() { saetTekst(TRIN[Math.min(TRIN.length - 1, TRIN.indexOf(tekst) + 1)]); },
    mindre() { saetTekst(TRIN[Math.max(0, TRIN.indexOf(tekst) - 1)]); },
    nulstil() { saetTekst('normal'); },
  };
})();
