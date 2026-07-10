// IDs préfixés pour ne jamais entrer en collision avec IMDB/TMDB d'autres addons.
const PREFIX = 'xtream';

// ---------- Utilitaires base64url ----------
function b64urlEncode(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}
function b64urlDecode(str) {
  try {
    return JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));
  } catch (e) {
    return { n: '', v: [] };
  }
}

// ---------- Normalisation des noms de chaînes ----------
// Table pour convertir les caractères "exposant" unicode (ᴴᴰ, ᶠʰᵈ, ˢᴰ...) en ASCII
const SUPER = {
  'ᴬ':'A','ᴮ':'B','ᴰ':'D','ᴱ':'E','ᴳ':'G','ᴴ':'H','ᴵ':'I','ᴶ':'J','ᴷ':'K','ᴸ':'L','ᴹ':'M','ᴺ':'N','ᴼ':'O','ᴾ':'P','ᴿ':'R','ᵀ':'T','ᵁ':'U','ⱽ':'V','ᵂ':'W',
  'ᵃ':'a','ᵇ':'b','ᶜ':'c','ᵈ':'d','ᵉ':'e','ᶠ':'f','ᵍ':'g','ʰ':'h','ⁱ':'i','ʲ':'j','ᵏ':'k','ˡ':'l','ᵐ':'m','ⁿ':'n','ᵒ':'o','ᵖ':'p','ʳ':'r','ˢ':'s','ᵗ':'t','ᵘ':'u','ᵛ':'v','ʷ':'w','ˣ':'x','ʸ':'y','ᶻ':'z',
  '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9'
};
function deSuper(s) {
  let out = '';
  for (const ch of s) out += (SUPER[ch] || ch);
  return out;
}

const QUALITY = [
  { re: /(^|[^a-z0-9])(4k|uhd|2160p?)([^a-z0-9]|$)/i, label: '4K', rank: 5 },
  { re: /(^|[^a-z0-9])(fhd|full ?hd|1080p?)([^a-z0-9]|$)/i, label: 'FHD', rank: 4 },
  { re: /(^|[^a-z0-9])(hevc|h\.?265|x265)([^a-z0-9]|$)/i, label: 'HEVC', rank: 3 },
  { re: /(^|[^a-z0-9])(hd|720p?)([^a-z0-9]|$)/i, label: 'HD', rank: 2 },
  { re: /(^|[^a-z0-9])(sd|480p?|360p?)([^a-z0-9]|$)/i, label: 'SD', rank: 1 }
];

const QUALITY_STRIP = /(^|[^a-z0-9])(4k|uhd|2160p?|fhd|full ?hd|1080p?|hevc|h\.?265|x265|hd|720p?|sd|480p?|360p?)([^a-z0-9]|$)/ig;
const DECO = /[|►▶◄◅★☆✦✧✩#~»«❖▪▬➤]+/g;
const COUNTRY_PREFIX = /^\s*[A-Za-z]{2,3}\s*[-|:]\s*/; // "FR - ", "FR| ", "EU: "

function normalizeChannel(rawName) {
  const raw = rawName || '';
  const s = deSuper(raw);

  let quality = null, rank = 0;
  for (const q of QUALITY) { if (q.re.test(s)) { quality = q.label; rank = q.rank; break; } }

  let display = s
    .replace(COUNTRY_PREFIX, '')
    .replace(QUALITY_STRIP, ' ')
    .replace(DECO, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!display) display = s.trim() || raw;

  const key = display.toLowerCase().replace(/\s+/g, ' ').trim();
  return { display, key, quality, rank };
}

// Nettoyage léger pour films / séries (pas de dédup, juste un nom propre)
function cleanTitle(name) {
  const s = (name || '').replace(COUNTRY_PREFIX, '').replace(DECO, ' ').replace(/\s{2,}/g, ' ').trim();
  return s || name;
}

// ---------- IDs ----------
function makeId(kind, rawId) {
  return `${PREFIX}:${kind}:${rawId}`;
}
function parseId(id) {
  const parts = id.split(':');
  if (parts[0] !== PREFIX) return null;
  return { kind: parts[1], rawId: parts.slice(2).join(':') };
}

// ---------- Regroupement des chaînes live (dédoublonnage + qualités) ----------
const MAX_VARIANTS = 12;

function groupLiveStreams(streams) {
  const map = new Map();
  for (const st of (Array.isArray(streams) ? streams : [])) {
    const n = normalizeChannel(st.name);
    if (!map.has(n.key)) {
      map.set(n.key, { name: n.display, icon: st.stream_icon || '', variants: [] });
    }
    const g = map.get(n.key);
    g.variants.push({ id: st.stream_id, q: n.quality, r: n.rank });
    if (!g.icon && st.stream_icon) g.icon = st.stream_icon;
  }
  const groups = [...map.values()];
  for (const g of groups) {
    g.variants.sort((a, b) => b.r - a.r);
    if (g.variants.length > MAX_VARIANTS) g.variants = g.variants.slice(0, MAX_VARIANTS);
  }
  return groups;
}

function liveGroupToMeta(g) {
  const payload = { n: g.name, v: g.variants.map(v => [v.id, v.r, v.q]) };
  return {
    id: `${PREFIX}:lg:${b64urlEncode(payload)}`,
    type: 'tv',
    name: g.name,
    poster: g.icon || undefined,
    posterShape: 'square'
  };
}

function decodeLiveGroup(rawId) {
  return b64urlDecode(rawId);
}

// ---------- Films / Séries (catalogues) ----------
function vodToMeta(item) {
  return {
    id: makeId('movie', item.stream_id),
    type: 'movie',
    name: cleanTitle(item.name),
    poster: item.stream_icon || item.cover || undefined,
    posterShape: 'poster',
    releaseInfo: item.year || undefined
  };
}

function seriesToMeta(item) {
  return {
    id: makeId('series', item.series_id),
    type: 'series',
    name: cleanTitle(item.name),
    poster: item.cover || undefined,
    posterShape: 'poster',
    releaseInfo: item.releaseDate || undefined,
    description: item.plot || undefined
  };
}

// ---------- Détails (meta enrichie) ----------
function vodInfoToMetaDetail(item, rawId) {
  const info = item.info || {};
  return {
    id: makeId('movie', rawId),
    type: 'movie',
    name: cleanTitle(info.name || info.o_name),
    poster: info.movie_image || info.cover_big,
    background: info.backdrop_path ? (Array.isArray(info.backdrop_path) ? info.backdrop_path[0] : info.backdrop_path) : undefined,
    description: info.plot,
    releaseInfo: info.releasedate,
    imdbRating: info.rating,
    genres: info.genre ? info.genre.split(',').map(g => g.trim()) : undefined,
    runtime: info.duration
  };
}

function seriesInfoToMetaDetail(data, rawId) {
  const info = data.info || {};
  const episodesBySeason = data.episodes || {};
  const videos = [];
  Object.keys(episodesBySeason).forEach((seasonNum) => {
    episodesBySeason[seasonNum].forEach((ep) => {
      videos.push({
        id: makeId('episode', `${rawId}:${ep.id}`),
        title: ep.title || `Episode ${ep.episode_num}`,
        season: parseInt(seasonNum, 10),
        episode: parseInt(ep.episode_num, 10),
        released: ep.info && ep.info.release_date ? ep.info.release_date : undefined,
        overview: ep.info && ep.info.plot ? ep.info.plot : undefined,
        thumbnail: ep.info && ep.info.movie_image ? ep.info.movie_image : undefined
      });
    });
  });
  return {
    id: makeId('series', rawId),
    type: 'series',
    name: cleanTitle(info.name),
    poster: info.cover,
    background: info.backdrop_path ? (Array.isArray(info.backdrop_path) ? info.backdrop_path[0] : info.backdrop_path) : undefined,
    description: info.plot,
    releaseInfo: info.releaseDate,
    imdbRating: info.rating,
    genres: info.genre ? info.genre.split(',').map(g => g.trim()) : undefined,
    videos
  };
}

module.exports = {
  makeId,
  parseId,
  cleanTitle,
  normalizeChannel,
  groupLiveStreams,
  liveGroupToMeta,
  decodeLiveGroup,
  vodToMeta,
  seriesToMeta,
  vodInfoToMetaDetail,
  seriesInfoToMetaDetail
};
