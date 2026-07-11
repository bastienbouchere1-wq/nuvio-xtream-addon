// Filtrage par langue/pays : on ne garde que les catégories des langues choisies.
// Une catégorie sans indicateur de pays reconnu est gardée (bénéfice du doute),
// ce qui évite de perdre des catégories FR mal nommées (ex: "EU LIGUE 1+").

const order = ['fr', 'en', 'ar', 'es', 'pt', 'it', 'de', 'nl', 'tr'];
const labels = {
  fr: 'Français', en: 'Anglais', ar: 'Arabe', es: 'Espagnol',
  pt: 'Portugais', it: 'Italien', de: 'Allemand', nl: 'Néerlandais', tr: 'Turc'
};

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

function detect(catName) {
  const s = ' ' + (catName || '').toLowerCase().replace(/\s+/g, ' ').trim() + ' ';
  const out = [];
  for (const l of order) { for (const kw of KW[l]) { if (s.includes(kw)) { out.push(l); break; } } }
  return out;
}

function categoryAllowed(catName, selected) {
  const sel = (selected && selected.length) ? selected : ['fr'];
  const det = detect(catName);
  if (!det.length) return true;           // pas de pays identifié -> on garde
  return det.some(l => sel.includes(l));
}

module.exports = { order, labels, detect, categoryAllowed };
