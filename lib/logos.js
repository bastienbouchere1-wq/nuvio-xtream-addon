// Résolution des logos HD (dépôt public tv-logos, CDN jsDelivr).
// candidates(name) renvoie PLUSIEURS noms de fichiers probables ; le serveur teste
// lesquels existent réellement et garde le premier valide (sinon logo Xtream).
// Cette approche multi-candidats contourne le fait qu'on ne peut pas deviner le nom exact.

const LOGO_BASE = 'https://cdn.jsdelivr.net/gh/tv-logo/tv-logos@main/countries/france/';

const MAP = [
  { re: /^tf1$/, slug: 'tf1-fr' },
  { re: /^tf1 ?\+ ?1$/, slug: 'tf1-plus-1-fr' },
  { re: /^france ?2$/, slug: 'france-2-fr' },
  { re: /^france ?3$/, slug: 'france-3-fr' },
  { re: /^france ?4$/, slug: 'france-4-fr' },
  { re: /^france ?5$/, slug: 'france-5-fr' },
  { re: /^m6$/, slug: 'm6-fr' },
  { re: /^m6 ?music$/, slug: 'm6-music-fr' },
  { re: /^w9$/, slug: 'w9-fr' },
  { re: /^tmc$/, slug: 'tmc-fr' },
  { re: /^tfx$/, slug: 'tfx-fr' },
  { re: /^c8$/, slug: 'c8-fr' },
  { re: /^cstar$/, slug: 'cstar-fr' },
  { re: /^nrj ?12$/, slug: 'nrj-12-fr' },
  { re: /^6ter$/, slug: '6ter-fr' },
  { re: /^arte$/, slug: 'arte-fr' },
  { re: /^gulli$/, slug: 'gulli-fr' },
  { re: /^cherie ?25$/, slug: 'cherie-25-fr' },
  { re: /^rmc ?story$/, slug: 'rmc-story-fr' },
  { re: /^rmc ?decouverte$/, slug: 'rmc-decouverte-fr' },
  { re: /^paris ?premiere$/, slug: 'paris-premiere-fr' },
  { re: /^canal ?\+? ?sport$/, slug: 'canal-plus-sport-fr' },
  { re: /^canal ?\+? ?foot$/, slug: 'canal-plus-foot-fr' },
  { re: /^canal ?\+? ?cinema$/, slug: 'canal-plus-cinema-fr' },
  { re: /^canal ?\+? ?docs?$/, slug: 'canal-plus-docs-fr' },
  { re: /^canal ?\+? ?kids$/, slug: 'canal-plus-kids-fr' },
  { re: /^canal ?\+? ?series$/, slug: 'canal-plus-series-fr' },
  { re: /^cnews$/, slug: 'cnews-fr' },
  { re: /^c ?news$/, slug: 'cnews-fr' },
  { re: /^bfm ?tv$/, slug: 'bfm-tv-fr' },
  { re: /^lci$/, slug: 'lci-fr' },
  { re: /^france ?info$/, slug: 'franceinfo-fr' },
  { re: /^euronews$/, slug: 'euronews-fr' },
  { re: /^national ?geographic$/, slug: 'national-geographic-fr' },
  { re: /^ushuaia ?tv$/, slug: 'ushuaia-tv-fr' },
  { re: /^planete\+?$/, slug: 'planete-plus-fr' },
  { re: /^histoire$/, slug: 'histoire-tv-fr' },
  { re: /^ocs.*/, slug: 'ocs-max-fr' },
  { re: /^tiji$/, slug: 'tiji-fr' },
  { re: /^piwi\+?$/, slug: 'piwi-plus-fr' },
  { re: /^boomerang$/, slug: 'boomerang-fr' },
  { re: /^disney ?channel$/, slug: 'disney-channel-fr' },
  { re: /^nickelodeon$/, slug: 'nickelodeon-fr' },
  { re: /^l ?equipe$/, slug: 'l-equipe-fr' },
  { re: /^dazn$/, slug: 'dazn-fr' },
  { re: /^bsmart|^b ?smart$/, slug: 'bsmart-fr' }
];

function slugKey(name) {
  return (name || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // enlève les accents (é -> e)
    .replace(/[^a-z0-9+]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Renvoie une liste de slugs candidats (le serveur testera lesquels existent).
function candidates(name) {
  const k = slugKey(name);
  const out = [];
  const push = (s) => { if (s && !out.includes(s)) out.push(s); };

  let m;
  if ((m = k.match(/^bein sports max (\d{1,2})$/))) { push(`bein-sports-max-${m[1]}-fr`); push(`bein-sports-max-${m[1]}`); }
  else if ((m = k.match(/^bein sports (\d{1,2})$/))) { push(`bein-sports-${m[1]}-fr`); push(`bein-sports-${m[1]}`); }
  else if ((m = k.match(/^rmc sport (\d{1,2})$/))) { push(`rmc-sport-${m[1]}-fr`); push(`rmc-sport-${m[1]}`); }
  else if ((m = k.match(/^eurosport (\d)$/))) { push(`eurosport-${m[1]}-fr`); push(`eurosport-${m[1]}`); }
  else if ((m = k.match(/^dazn (\d{1,2})$/))) { push(`dazn-${m[1]}-fr`); push(`dazn-${m[1]}`); }

  for (const e of MAP) if (e.re.test(k)) push(e.slug);

  // Variantes génériques : on slugifie le nom nettoyé
  const b = k.replace(/\+/g, '-plus').trim().replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (b) { push(b + '-fr'); push(b); push(b.replace(/-plus/g, 'plus') + '-fr'); }

  return out.slice(0, 6);
}

module.exports = {
  LOGO_BASE,
  candidates,
  resolveLogoCandidates: candidates,
  resolveLogoSlug: (name) => { const c = candidates(name); return c.length ? c[0] : null; }
};
