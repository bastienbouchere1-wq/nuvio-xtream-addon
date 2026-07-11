// Résolution des logos HD via le dépôt public tv-logos (CDN jsDelivr).
// resolveLogoSlug renvoie un "slug" (nom de fichier probable) ou null.
// Le serveur teste ensuite si le fichier existe et retombe sur le logo Xtream sinon,
// donc une supposition erronée ne casse jamais l'affichage.

const LOGO_BASE = 'https://cdn.jsdelivr.net/gh/tv-logo/tv-logos@main/countries/france/';

const MAP = [
  // Généralistes
  { re: /^tf1$/, slug: 'tf1-fr' },
  { re: /^tf1 ?\+ ?1$/, slug: 'tf1-plus-1-fr' },
  { re: /^france ?2$/, slug: 'france-2-fr' },
  { re: /^france ?3$/, slug: 'france-3-fr' },
  { re: /^france ?4$/, slug: 'france-4-fr' },
  { re: /^france ?5$/, slug: 'france-5-fr' },
  { re: /^m6$/, slug: 'm6-fr' },
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
  { re: /^paris ?premiere$/, slug: 'paris-premiere-fr' },
  { re: /^teva$/, slug: 'teva-fr' },
  // Canal+
  { re: /^canal ?\+?$/, slug: 'canal-plus-fr' },
  { re: /^canal ?\+? ?sport$/, slug: 'canal-plus-sport-fr' },
  { re: /^canal ?\+? ?foot$/, slug: 'canal-plus-foot-fr' },
  { re: /^canal ?\+? ?cinema$/, slug: 'canal-plus-cinema-fr' },
  { re: /^canal ?\+? ?series$/, slug: 'canal-plus-series-fr' },
  { re: /^canal ?\+? ?can$/, slug: 'canal-plus-fr' },
  // Info
  { re: /^cnews$/, slug: 'cnews-fr' },
  { re: /^c ?news$/, slug: 'cnews-fr' },
  { re: /^bfm ?tv$/, slug: 'bfm-tv-fr' },
  { re: /^lci$/, slug: 'lci-fr' },
  { re: /^france ?info$/, slug: 'franceinfo-fr' },
  { re: /^euronews$/, slug: 'euronews-fr' },
  // Découverte
  { re: /^rmc ?decouverte$/, slug: 'rmc-decouverte-fr' },
  { re: /^national ?geographic$/, slug: 'national-geographic-fr' },
  { re: /^ushuaia ?tv$/, slug: 'ushuaia-tv-fr' },
  { re: /^planete\+?$/, slug: 'planete-plus-fr' },
  { re: /^histoire$/, slug: 'histoire-tv-fr' },
  // Jeunesse
  { re: /^tiji$/, slug: 'tiji-fr' },
  { re: /^piwi\+?$/, slug: 'piwi-plus-fr' },
  { re: /^boomerang$/, slug: 'boomerang-fr' },
  { re: /^cartoon ?network$/, slug: 'cartoon-network-fr' },
  { re: /^disney ?channel$/, slug: 'disney-channel-fr' },
  { re: /^nickelodeon$/, slug: 'nickelodeon-fr' },
  // Sport (non numérotés)
  { re: /^l ?equipe$/, slug: 'l-equipe-fr' },
  { re: /^dazn$/, slug: 'dazn-fr' },
  { re: /^infosport\+?$/, slug: 'infosport-plus-fr' }
];

function slugKey(name) { return (name || '').toLowerCase().replace(/[^a-z0-9+]+/g, ' ').replace(/\s+/g, ' ').trim(); }

function resolveLogoSlug(name) {
  const k = slugKey(name);
  let m;
  // Chaînes numérotées : on génère le slug dynamiquement
  if ((m = k.match(/^bein sports max (\d{1,2})$/))) return `bein-sports-max-${m[1]}-fr`;
  if ((m = k.match(/^bein sports (\d{1,2})$/))) return `bein-sports-${m[1]}-fr`;
  if ((m = k.match(/^rmc sport (\d{1,2})$/))) return `rmc-sport-${m[1]}-fr`;
  if ((m = k.match(/^eurosport (\d)$/))) return `eurosport-${m[1]}-fr`;
  if ((m = k.match(/^dazn (\d{1,2})$/))) return `dazn-${m[1]}-fr`;
  for (const e of MAP) { if (e.re.test(k)) return e.slug; }
  return null;
}

module.exports = { LOGO_BASE, resolveLogoSlug };
