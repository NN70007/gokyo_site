/* Prépare assets/finscale.json pour la page d'accueil de GOKYO :
   les grands sujets (bases) et les invités, avec leurs sujets et leurs épisodes.
   Source : l'archive publique des épisodes (même serveur que le site Finscale).
   Lancé chaque jour par GitHub Actions (.github/workflows/finscale.yml). */
import fs from "node:fs";
import vm from "node:vm";

const API = "https://script.google.com/macros/s/AKfycbysWh2QA9HJNzd-NDM6X9kA7Rb0C9eoNY-J4OwozatsusY31Lu921dFDY-BuEyFhRca/exec";
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const dec = s => String(s || "").replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, c) =>
  c[0] === "#" ? String.fromCodePoint(c[1].toLowerCase() === "x" ? parseInt(c.slice(2), 16) : +c.slice(1)) : (ENT[c.toLowerCase()] ?? m));
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL("./invites-parse.js", import.meta.url), "utf8"), ctx);
const extraire = ctx.window.FinscaleInvites.extraire;

async function lire(a) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(API + "?a=" + a, { redirect: "follow" }); if (r.ok) return await r.json(); } catch (e) {}
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error("API indisponible : " + a);
}

const [E, C] = await Promise.all([lire("episodes"), lire("contenu")]);
const eps = E.episodes || [];
const sujets = (C.dossiers || []).filter(d => d.code).map(d => ({ c: d.code, fr: d.titre_fr, en: d.titre_en || d.titre_fr }));
const P = {};
for (const e of eps) {
  const titre = dec(e.t).replace(/^\s*(\[[^\]]*\]\s*)*/, "");
  const num = (titre.match(/#\s*(\d+)/) || [])[1] || "";
  const propre = titre.replace(/^#\s*\d+\s*[-–:]\s*/, "");
  for (const g of extraire(e.t)) {
    const k = norm(g.n); if (!k) continue;
    const p = P[k] || (P[k] = { n: dec(g.n), s: "", k: "", e: [] });
    if (g.s && !p.s) p.s = dec(g.s);
    p.k += e.k || "";
    p.e.push({ n: num, t: propre, d: String(e.d || "").slice(0, 10) });
  }
}
const invites = Object.values(P).map(p => { p.e.sort((a, b) => a.d < b.d ? 1 : -1); p.e = p.e.slice(0, 4); return p; });
const out = { maj: new Date().toISOString().slice(0, 10), sujets, invites };
fs.writeFileSync("assets/finscale.json", JSON.stringify(out));
console.log(`${sujets.length} sujets, ${invites.length} invités, ${eps.length} épisodes`);
