// Classement des chaînes par THÈME (au lieu des catégories redondantes du fournisseur).
// On classe d'abord sur le NOM de la chaîne (fort), puis sur les noms de catégories
// où elle apparaît (faible), sinon "Autres".

const order = ['generalistes', 'sport', 'cinema', 'info', 'jeunesse', 'decouverte', 'musique', 'autres'];

const labels = {
  generalistes: 'Généralistes',
  sport: 'Sport',
  cinema: 'Cinéma & Séries',
  info: 'Info',
  jeunesse: 'Jeunesse',
  decouverte: 'Découverte',
  musique: 'Musique',
  autres: 'Autres chaînes'
};

// Mots-clés testés sur le NOM de la chaîne (priorité haute)
const NAME_KW = {
  sport: ['bein', 'rmc sport', 'canal+ sport', 'canal sport', 'canal+ foot', 'canal foot', 'canal+ can', 'canal can', 'eurosport', 'dazn', 'ligue1', 'ligue 1', 'l equipe', 'lequipe', 'infosport', 'sport en france', 'golf', 'automoto', 'extreme sport', 'rmc decouverte sport', 'onzeo', 'olympique', ' foot'],
  info: ['bfm', 'cnews', 'c news', 'lci', 'franceinfo', 'france info', 'euronews', 'i24', 'public senat', 'lcp', 'africa24', 'cgtn', 'al jazeera', 'news 24'],
  jeunesse: ['gulli', 'tiji', 'piwi', 'boomerang', 'cartoon', 'boing', 'disney', 'nickelodeon', 'nick jr', 'canal j', 'teletoon', 'junior', 'enfant', 'kids', 'baby tv', 'mangas'],
  decouverte: ['decouverte', 'découverte', 'discovery', 'national geographic', 'nat geo', 'histoire', 'science', 'ushuaia', 'planete', 'planète', 'animaux', 'animal planet', 'seasons', 'chasse', 'peche', 'investigation', 'crime district', 'toute l histoire', 'rmc story'],
  cinema: ['cinema', 'ciné', 'cine+', 'cine ', 'ocs', 'tcm', 'syfy', 'warner', 'paramount', 'canal+ cinema', 'canal cinema', 'polar', 'frisson', 'emotion', 'comedie', 'action', 'altice studio', 'benshi', 'famiz'],
  musique: ['mtv', 'mcm', 'trace', 'nrj hits', 'm6 music', 'clubbing', 'musique', 'music', 'rfm', 'virgin radio', 'melody', 'djazz', 'stingray', 'trace urban'],
  generalistes: ['tf1', 'france 2', 'france 3', 'france 4', 'france 5', 'france2', 'france3', 'france4', 'france5', 'm6', 'w9', 'tmc', 'tfx', 'c8', 'cstar', 'nrj 12', 'nrj12', '6ter', 'arte', 'canal+', 'canal +', 'rmc story', 'paris premiere', 'teva', 'cherie 25', 'chérie 25', 'france o']
};

// Mots-clés testés sur les noms de CATÉGORIES (priorité basse, si le nom n'a rien donné)
const CAT_KW = {
  sport: ['sport', 'bein', 'dazn', 'ligue', 'foot', 'eurosport', 'equipe', 'rmc sport'],
  info: ['info', 'news'],
  jeunesse: ['jeunesse', 'enfant', 'kids', 'junior'],
  decouverte: ['decouverte', 'découverte', 'documentaire', 'discovery'],
  cinema: ['cinema', 'ciné', 'film', 'series', 'séries'],
  musique: ['musique', 'music'],
  generalistes: ['general', 'général', 'generaliste', 'généraliste', 'france', 'tnt', '4k', 'hevc', 'fhd', 'canal']
};

// Ordre de CLASSEMENT (différent de l'ordre d'affichage) : les thèmes spécifiques
// passent avant "généralistes", sinon "Canal+ Sport" serait classé Généralistes.
const CLASSIFY_ORDER = ['sport', 'info', 'jeunesse', 'decouverte', 'cinema', 'musique', 'generalistes'];

function matchIn(hay, kwByTheme) {
  for (const theme of CLASSIFY_ORDER) {
    const kws = kwByTheme[theme];
    if (!kws) continue;
    for (const kw of kws) { if (hay.includes(kw)) return theme; }
  }
  return null;
}

function classify(name, catNames) {
  const n = ' ' + (name || '').toLowerCase().replace(/\s+/g, ' ').trim() + ' ';
  const byName = matchIn(n, NAME_KW);
  if (byName) return byName;
  const cats = ' ' + (Array.isArray(catNames) ? catNames.join(' ') : '').toLowerCase() + ' ';
  const byCat = matchIn(cats, CAT_KW);
  if (byCat) return byCat;
  return 'autres';
}

module.exports = { order, labels, classify };
