/* Finscale — extraction des invités et des sociétés à partir des titres d'épisodes.
   Exemple : « #367 - David Djaïz (Ascend Partners) - La tech n'est pas de la plomberie » → David Djaïz · Ascend Partners. */
(function (root) {
  "use strict";
  var tx = typeof document !== "undefined" ? document.createElement("textarea") : null;
  function dec(s) { if (!tx) return String(s || ""); tx.innerHTML = String(s || ""); return tx.value; }
  var EXCLUS = /^(solenne niedercorn|solenne|finscale)$/i;
  var TITRES = /^(ministre|minister|ambassador|ambassadrice|général|general|dr\.?|docteur)\s+/i;
  var CORRECTIONS = { "Seb Couasnon": "Sébastien Couasnon", "JB Graftieaux": "Jean-Baptiste Graftieaux", "F. Carbone": "Frédéric Carbone", "A. Dubois": "Arnaud Dubois", "C. Serpagli": "C. Serpagli", "P. Mollard": "Patrick Mollard", "G. Andrieu": "Grégoire Andrieu" };
  var SOC_CORR = { "Rothschild Co": "Rothschild & Co", "Gimar Co": "Gimar & Co", "Alice Bob": "Alice & Bob", "Banque Postale": "La Banque Postale", "Paypal Ventures": "PayPal Ventures", "ADYEN": "Adyen", "FEI / EIF": "Fonds européen d'investissement", "BEI": "Banque européenne d'investissement", "Groupe Foyer": "Foyer", "Lux SE": "Luxembourg Stock Exchange", "Gimar&Co": "Gimar & Co", "Bpi France": "Bpifrance", "NeuroProfiler": "Neuroprofiler", "YCombinator": "Y Combinator", "AA&Sons": "AA&Sons", "Cap Gemini": "Capgemini", "ADYEN": "Adyen", "EIF": "Fonds européen d'investissement", "Ancien député de Paris": "", "NED": "" };

  function nettoyer(t) {
    return dec(t).replace(/\[[^\]]*\]/g, " ").replace(/📢/g, " ")
      .replace(/(special edition|[ée]dition sp[ée]ciale|hors[- ]s[ée]rie|teaser|replay|best[- ]of)\s*(#\s*[\d-]+)?/gi, " ")
      .replace(/episode\s*"?from within"?/gi, " ").replace(/"from within"/gi, " ")
      .replace(/money\s*20\/20/gi, " ").replace(/#\s*\d+(-\d+)?/g, " ").replace(/\s+/g, " ").trim().replace(/^[-–:\s]+/, "");
  }
  function estNom(s) {
    s = s.trim(); if (!s || s.length > 60) return false;
    var mots = s.split(/\s+/); if (mots.length < 2 || mots.length > 5) return false;
    return mots.every(function (m) { return /^(de|du|des|d'|la|le|van|von|den|der|da|el|alias|"[^"]+")$/i.test(m) || /^d['’][A-ZÀ-Þ]/.test(m) || /^[A-ZÀ-ÖØ-Þ][\wÀ-ÿ'’.-]*$/.test(m) || /^[A-Z]\.$/.test(m); });
  }
  function noms(s) {
    return s.split(/\s+(?:et|and|&)\s+|,\s*/i).map(function (n) {
      n = n.replace(TITRES, "").replace(/\s+alias\s+"[^"]*"/i, "").replace(/^(avec|with)\s+/i, "").replace(/^entretien avec\s+/i, "").replace(/^my discussion with\s+/i, "").trim();
      return CORRECTIONS[n] || n;
    }).filter(function (n) { return n && !EXCLUS.test(n) && estNom(n); });
  }
  function societe(s) { s = s.trim().replace(/\s+/g, " "); return SOC_CORR.hasOwnProperty(s) ? SOC_CORR[s] : s; }

  /* Titres que la règle générale lit mal : corrigés à la main */
  var MAIN = [
    [/Catherine Barba/, [["Catherine Barba", "Envi"]]],
    [/Pauline Boucon Duval/, [["Pauline Boucon Duval", ""]]],
    [/Simon Taylor/, [["Simon Taylor", "Sardine"]]],
    [/Thibault de Barsy \(Payment/, [["Thibault de Barsy", "Payments Association EU"]]],
    [/Patrick Gauthier - Convera/, [["Patrick Gauthier", "Convera"]]],
    [/Emmanuel Delaveau/, [["Emmanuel Delaveau", "Partech"], ["Geoffroy De Cooman", "Clariteer"], ["Ludovic Phalippou", "Université d'Oxford"]]],
    [/Sébastien Beyet/, [["Sébastien Beyet", "Agicap"], ["Philippe Collombel", "Partech"], ["Gabrielle Thomas", "BlackFin Tech"]]],
    [/Tatiana Jama/, [["Tatiana Jama", "Sista Fund"], ["Laetitia Vitaud", ""]]],
    [/Luc Falempin/, [["Luc Falempin", "Tokeny"], ["Cyril Lamorlette", ""]]],
    [/Pascal Denis - Alex Panican/, [["Pascal Denis", ""], ["Alex Panican", ""]]],
    [/Béatrice Collot/, [["Béatrice Collot", "La Banque Postale"], ["Ana Catalina Macaya Vargas", "La Banque Postale"]]],
    [/Stacey Feinberg/, [["Stacey Feinberg", "Ambassade des États-Unis"]]],
    [/Gilles Roth/, [["Gilles Roth", "Gouvernement du Luxembourg"]]],
    [/Yuriko Backes/, [["Yuriko Backes", "Gouvernement du Luxembourg"]]],
    [/Andrea Monteleone/, [["Andrea Monteleone", "Banque mondiale"]]]
  ];
  function extraire(titre) {
    var t0 = dec(titre);
    for (var z = 0; z < MAIN.length; z++) if (MAIN[z][0].test(t0)) return MAIN[z][1].map(function (p) { return { n: p[0], s: p[1] }; });
    var t = nettoyer(titre), out = [];
    // 1) « Nom (Société) » éventuellement plusieurs fois
    var re = /([^()]+?)\s*\(([^)]+)\)/g, m, vu = false, debut = t.split(/\s[-–]\s/)[0];
    var zone = /\(/.test(debut) ? debut : t.split(/\s[-–]\s/).slice(0, 2).join(" - ");
    zone = zone.replace(/^.*?(avec|with)\s+/i, function (x, a) { return /\(/.test(x) ? x : ""; });
    while ((m = re.exec(zone))) {
      var gauche = m[1].replace(/^[-–:,&\s]+|[-–:,&\s]+$/g, "").replace(/^(et|and|&)\s+/i, ""), soc = m[2];
      var parts = gauche.split(/\s[-–]\s/); gauche = parts[parts.length - 1];
      var socs = soc.split(/\s+(?:et|and)\s+/i);
      var ns = noms(gauche);
      ns.forEach(function (n, i) { out.push({ n: n, s: societe(socs[Math.min(i, socs.length - 1)] || soc) }); vu = true; });
    }
    if (!vu) {
      // 2) « Nom - titre » (sans société)
      var seg = t.split(/\s[-–:]\s/);
      for (var i = 0; i < Math.min(2, seg.length); i++) {
        var cand = seg[i].replace(/^.*?\b(avec|with)\s+/i, "");
        var ns2 = noms(cand); if (ns2.length) { ns2.forEach(function (n) { out.push({ n: n, s: "" }); }); break; }
      }
      if (!out.length) { var mm = t.match(/\b(?:avec|with)\s+([A-ZÀ-Þ][^,(]+?)(?:\s*\(([^)]+)\))?$/); if (mm) noms(mm[1]).forEach(function (n) { out.push({ n: n, s: mm[2] ? societe(mm[2]) : "" }); }); }
    }
    return out;
  }
  root.FinscaleInvites = { extraire: extraire };
})(typeof window !== "undefined" ? window : this);
