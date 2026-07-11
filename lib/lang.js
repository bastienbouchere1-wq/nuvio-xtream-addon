// Filtrage par langue. On détecte la langue en priorité sur le PRÉFIXE de la chaîne
// (ex: "FR - TF1", "NL - RTL 4", "US - ABC"), puis sur la catégorie, sinon ambigu.

const order = ['fr', 'en', 'ar', 'es', 'pt', 'it', 'de', 'nl', 'tr'];
const labels = {
  fr: 'Français', en: 'Anglais', ar: 'Arabe', es: 'Espagnol',
  pt: 'Portugais', it: 'Italien', de: 'Allemand', nl: 'Néerlandais', tr: 'Turc'
};

// Mots-clés dans les noms de CATÉGORIES
const KW = {
  fr: ['france', 'french', 'français', 'francais', ' fr ', 'vf ', 'tnt fr', 'belgique', 'suisse'],
  en: ['united kingdom', 'england', 'british', ' uk ', 'usa', ' us ', 'american', 'english', 'ireland', ' au ', 'canada eng'],
  ar: ['arab', 'arabic', 'arabe', 'maghreb', 'morocco', 'maroc', 'algeria', 'algerie', 'algérie', 'tunisia', 'tunisie', 'egypt', 'egypte', ' ar '],
  es: ['spain', 'espana', 'españa', 'espagne', 'spanish', 'español', 'latino', 'mexico', 'argentina', ' es '],
  pt: ['portugal', 'portuguese', 'brasil', 'brazil', 'bresil', ' pt '],
  it: ['italy', 'italia', 'italie', 'italian', ' it '],
  de: ['germany', 'deutschland', 'german', 'deutsch', 'allemagne', ' de '],
  nl: ['netherlands', 'holland', 'dutch', 'nederland', 'pays-bas', ' nl '],
  tr: ['turkey', 'turkiye', 'türkiye', 'turkish', 'turc', ' tr ']
};

// Codes / pays en PRÉFIXE de chaîne -> langue
const PREFIX_LANG = {
  fr:'fr', fra:'fr', france:'fr', french:'fr', vf:'fr', be:'fr', bel:'fr', belgique:'fr', mc:'fr', monaco:'fr', lu:'fr', qc:'fr', qbc:'fr', suisse:'fr', ch:'fr',
  en:'en', uk:'en', gb:'en', gbr:'en', us:'en', usa:'en', ca:'en', au:'en', aus:'en', ie:'en', irl:'en', nz:'en', english:'en', eng:'en',
  ar:'ar', ara:'ar', arb:'ar', ma:'ar', mar:'ar', dz:'ar', dza:'ar', tn:'ar', tun:'ar', eg:'ar', egy:'ar', sa:'ar', ksa:'ar', qa:'ar', ae:'ar', uae:'ar', arabic:'ar', maghreb:'ar', mbc:'ar',
  es:'es', esp:'es', spain:'es', mx:'es', mex:'es', co:'es', cl:'es', pe:'es', latino:'es', spanish:'es',
  pt:'pt', por:'pt', prt:'pt', portugal:'pt', br:'pt', bra:'pt', brasil:'pt', brazil:'pt',
  it:'it', ita:'it', italy:'it', italia:'it',
  de:'de', deu:'de', ger:'de', germany:'de', at:'de', aut:'de', dach:'de', german:'de',
  nl:'nl', nld:'nl', netherlands:'nl', holland:'nl', dutch:'nl', ned:'nl',
  tr:'tr', tur:'tr', turkey:'tr', turkiye:'tr', turkish:'tr',
  // autres langues -> catégorie "other" (jamais dans la liste FR par défaut donc filtrées)
  pl:'other', ru:'other', ro:'other', gr:'other', grc:'other', ex:'other', yu:'other', in:'other', ind:'other', pk:'other', al:'other', alb:'other', mk:'other', rs:'other', srb:'other', hr:'other', ba:'other', se:'other', no:'other', dk:'other', fi:'other', cz:'other', hu:'other', bg:'other', ua:'other', afg:'other', afr:'other'
};

function detectCategory(catName) {
  const s = ' ' + (catName || '').toLowerCase().replace(/\s+/g, ' ').trim() + ' ';
  const out = [];
  for (const l of order) { for (const kw of KW[l]) { if (s.includes(kw)) { out.push(l); break; } } }
  return out;
}

// Langue d'après le préfixe du nom de chaîne, ou null si indéterminé
function detectChannel(name) {
  const s = (name || '').trim();
  const m = s.match(/^([A-Za-zÀ-ÿ0-9 ]{1,16}?)\s*[-|:]/);
  if (!m) return null;
  const head = m[1].toLowerCase().replace(/[^a-z]/g, '');
  if (head && PREFIX_LANG[head]) return PREFIX_LANG[head];
  const first = m[1].toLowerCase().split(/\s+/)[0].replace(/[^a-z]/g, '');
  if (first && PREFIX_LANG[first]) return PREFIX_LANG[first];
  return null;
}

// Décision pour une chaîne : préfixe (fiable) > catégorie > ambigu
function channelAllowed(name, catName, selected, strict) {
  const sel = (selected && selected.length) ? selected : ['fr'];
  const ch = detectChannel(name);
  if (ch) return sel.includes(ch);
  const cat = detectCategory(catName);
  if (cat.length) return cat.some(l => sel.includes(l));
  return !strict; // aucune info : gardé sauf mode strict
}

function categoryAllowed(catName, selected) {
  const sel = (selected && selected.length) ? selected : ['fr'];
  const det = detectCategory(catName);
  if (!det.length) return true;
  return det.some(l => sel.includes(l));
}

module.exports = { order, labels, detectCategory, detectChannel, channelAllowed, categoryAllowed };
