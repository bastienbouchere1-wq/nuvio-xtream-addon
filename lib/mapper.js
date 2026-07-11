// IDs préfixés pour ne jamais entrer en collision avec IMDB/TMDB d'autres addons.
const PREFIX = 'xtream';
const MAX_VARIANTS = 12;

// ---------- base64url ----------
function b64urlEncode(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}
function b64urlDecode(str) {
  try { return JSON.parse(Buffer.from(str, 'base64url').toString('utf8')); }
  catch (e) { return { n: '', v: [] }; }
}

// ---------- Exposants unicode -> ASCII (ᴴᴰ, ᶠʰᵈ, ˢᴰ ...) ----------
const SUPER = {
  'ᴬ':'A','ᴮ':'B','ᴰ':'D','ᴱ':'E','ᴳ':'G','ᴴ':'H','ᴵ':'I','ᴶ':'J','ᴷ':'K','ᴸ':'L','ᴹ':'M','ᴺ':'N','ᴼ':'O','ᴾ':'P','ᴿ':'R','ᵀ':'T','ᵁ':'U','ⱽ':'V','ᵂ':'W',
  'ᵃ':'a','ᵇ':'b','ᶜ':'c','ᵈ':'d','ᵉ':'e','ᶠ':'f','ᵍ':'g','ʰ':'h','ⁱ':'i','ʲ':'j','ᵏ':'k','ˡ':'l','ᵐ':'m','ⁿ':'n','ᵒ':'o','ᵖ':'p','ʳ':'r','ˢ':'s','ᵗ':'t','ᵘ':'u','ᵛ':'v','ʷ':'w','ˣ':'x','ʸ':'y','ᶻ':'z',
  '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9'
};
function deSuper(s) { let o = ''; for (const ch of s) o += (SUPER[ch] || ch); return o; }

// ---------- Tags de qualité / format (deviennent les labels de sources) ----------
const TAGS = [
  { re: /(^|[^a-z0-9])(4k|uhd|2160p?)([^a-z0-9]|$)/i, label: '4K', rank: 6 },
  { re: /(^|[^a-z0-9])(fhd|full ?hd|1080p?)([^a-z0-9]|$)/i, label: 'FHD', rank: 5 },
  { re: /(^|[^a-z0-9])(hd|720p?)([^a-z0-9]|$)/i, label: 'HD', rank: 3 },
  { re: /(^|[^a-z0-9])(sd|480p?|360p?)([^a-z0-9]|$)/i, label: 'SD', rank: 1 },
  { re: /(^|[^a-z0-9])(hevc|h\.?265|x265)([^a-z0-9]|$)/i, label: 'HEVC', rank: 0 },
  { re: /(^|[^a-z0-9])(h\.?264|x264)([^a-z0-9]|$)/i, label: 'H264', rank: 0 },
  { re: /(^|[^a-z0-9])(vip)([^a-z0-9]|$)/i, label: 'VIP', rank: 0 },
  { re: /(^|[^a-z0-9])(backup|bkp)([^a-z0-9]|$)/i, label: 'Backup', rank: 0 },
  { re: /(^|[^a-z0-9])(multi)([^a-z0-9]|$)/i, label: 'Multi', rank: 0 },
  { re: /(^|[^a-z0-9])(raw)([^a-z0-9]|$)/i, label: 'Raw', rank: 0 }
];
const STRIP = /(^|[^a-z0-9])(4k|uhd|2160p?|fhd|full ?hd|1080p?|hd|720p?|sd|480p?|360p?|hevc|h\.?265|x265|h\.?264|x264|vip|backup|bkp|multi|raw)([^a-z0-9]|$)/ig;
const DECO = /[|►▶◄◅★☆✦✧✩#~»«❖▪▬➤]+/g;
const COUNTRY_PREFIX = /^\s*[A-Za-z]{2,3}\s*[-|:]\s*/;

function normalizeChannel(raw0) {
  const raw = raw0 || '';
  const s = deSuper(raw);

  const found = [];
  let mrank = 0;
  for (const t of TAGS) {
    if (t.re.test(s)) { found.push({ label: t.label, rank: t.rank }); if (t.rank > mrank) mrank = t.rank; }
  }
  found.sort((a, b) => b.rank - a.rank);
  const label = found.map(f => f.label).join(' • ');

  let display = s.replace(COUNTRY_PREFIX, '');
  let prev;
  do { prev = display; display = display.replace(STRIP, ' '); } while (display !== prev);
  display = display.replace(DECO, ' ').replace(/\(\s*\)/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (!display) display = s.replace(COUNTRY_PREFIX, '').replace(DECO, ' ').replace(/\s{2,}/g, ' ').trim() || raw;

  const key = display.toLowerCase().replace(/\s+/g, ' ').trim();
  return { display, key, rank: mrank, label };
}

function isJunkName(raw) {
  const s = (raw || '').trim();
  if (!s) return true;
  if (/^[\W_]+$/.test(s)) return true;                 // que des symboles
  if (/[#=~\-–—_.*•]{3,}/.test(s)) return true;         // 3+ symboles = séparateur provider
  return false;
}

function cleanTitle(name) {
  const s = (name || '').replace(COUNTRY_PREFIX, '').replace(DECO, ' ').replace(/\s{2,}/g, ' ').trim();
  return s || name;
}

// ---------- Logos HD (best-effort, repo tv-logos via CDN jsDelivr) ----------
const LOGO_BASE = 'https://cdn.jsdelivr.net/gh/tv-logo/tv-logos@main/countries/france/';
const LOGO_MAP = [
  { re: /^tf1$/, slug: 'tf1-fr' },
  { re: /^france ?2$/, slug: 'france-2-fr' },
  { re: /^france ?3$/, slug: 'france-3-fr' },
  { re: /^france ?4$/, slug: 'france-4-fr' },
  { re: /^france ?5$/, slug: 'france-5-fr' },
  { re: /^m6$/, slug: 'm6-fr' },
  { re: /^arte$/, slug: 'arte-fr' },
  { re: /^canal$/, slug: 'canal-plus-fr' },
  { re: /^canal ?sport$/, slug: 'canal-plus-sport-fr' },
  { re: /^canal ?cinema$/, slug: 'canal-plus-cinema-fr' },
  { re: /^c8$/, slug: 'c8-fr' },
  { re: /^w9$/, slug: 'w9-fr' },
  { re: /^tmc$/, slug: 'tmc-fr' },
  { re: /^tfx$/, slug: 'tfx-fr' },
  { re: /^nrj ?12$/, slug: 'nrj-12-fr' },
  { re: /^cnews$/, slug: 'cnews-fr' },
  { re: /^cstar$/, slug: 'cstar-fr' },
  { re: /^bfm ?tv$/, slug: 'bfm-tv-fr' },
  { re: /^lci$/, slug: 'lci-fr' },
  { re: /^france ?info$/, slug: 'franceinfo-fr' },
  { re: /^gulli$/, slug: 'gulli-fr' },
  { re: /^6ter$/, slug: '6ter-fr' },
  { re: /^rmc ?story$/, slug: 'rmc-story-fr' },
  { re: /^rmc ?decouverte$/, slug: 'rmc-decouverte-fr' },
  { re: /^l ?equipe$/, slug: 'l-equipe-fr' }
];
function slugKey(name) { return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function resolveLogo(displayName, xtreamIcon, useHd) {
  if (useHd) {
    const k = slugKey(displayName);
    let m;
    if ((m = k.match(/^bein sports max (\d{1,2})$/))) return LOGO_BASE + `bein-sports-max-${m[1]}-fr.png`;
    if ((m = k.match(/^bein sports (\d{1,2})$/))) return LOGO_BASE + `bein-sports-${m[1]}-fr.png`;
    if ((m = k.match(/^rmc sport (\d{1,2})$/))) return LOGO_BASE + `rmc-sport-${m[1]}-fr.png`;
    if ((m = k.match(/^eurosport (\d)$/))) return LOGO_BASE + `eurosport-${m[1]}-fr.png`;
    for (const e of LOGO_MAP) { if (e.re.test(k)) return LOGO_BASE + e.slug + '.png'; }
  }
  return xtreamIcon || undefined;
}

// ---------- IDs ----------
function makeId(kind, rawId) { return `${PREFIX}:${kind}:${rawId}`; }
function parseId(id) {
  const parts = id.split(':');
  if (parts[0] !== PREFIX) return null;
  return { kind: parts[1], rawId: parts.slice(2).join(':') };
}

// ---------- Chaînes live : regroupement + labels distincts + logos ----------
function groupLiveStreams(streams, opts) {
  opts = opts || {};
  const list = (Array.isArray(streams) ? streams : [])
    .filter(st => !(opts.hideJunk && isJunkName(st.name)));

  const map = new Map();
  for (const st of list) {
    const n = normalizeChannel(st.name);
    const dispName = opts.cleanNames ? n.display : (st.name || n.display);
    const gkey = opts.group ? n.key : ('id' + st.stream_id); // group off => aucune fusion
    if (!map.has(gkey)) map.set(gkey, { name: dispName, icon: st.stream_icon || '', variants: [] });
    const g = map.get(gkey);
    g.variants.push({ id: st.stream_id, r: n.rank, label: n.label || '' });
    if (!g.icon && st.stream_icon) g.icon = st.stream_icon;
  }

  const groups = [...map.values()];
  for (const g of groups) {
    if (opts.sortSources) g.variants.sort((a, b) => b.r - a.r);
    // Labels uniques : si deux sources ont le même label, on suffixe (FHD, FHD 2, ...)
    const seen = {};
    g.variants.forEach((v) => {
      let lbl = v.label || 'Source';
      if (seen[lbl] != null) { seen[lbl]++; lbl = lbl + ' ' + seen[lbl]; }
      else seen[lbl] = 1;
      v.label = lbl;
    });
    if (g.variants.length > MAX_VARIANTS) g.variants = g.variants.slice(0, MAX_VARIANTS);
    g.icon = resolveLogo(g.name, g.icon, opts.logos);
  }
  return groups;
}

function liveGroupToMeta(g) {
  const payload = { n: g.name, v: g.variants.map(v => [v.id, v.r, v.label]) };
  return {
    id: `${PREFIX}:lg:${b64urlEncode(payload)}`,
    type: 'tv',
    name: g.name,
    poster: g.icon || undefined,
    posterShape: 'square'
  };
}
function decodeLiveGroup(rawId) { return b64urlDecode(rawId); }

// ---------- Films / Séries ----------
function vodToMeta(item, opts) {
  const clean = !opts || opts.cleanNames !== false;
  return {
    id: makeId('movie', item.stream_id),
    type: 'movie',
    name: clean ? cleanTitle(item.name) : item.name,
    poster: item.stream_icon || item.cover || undefined,
    posterShape: 'poster',
    releaseInfo: item.year || undefined
  };
}
function seriesToMeta(item, opts) {
  const clean = !opts || opts.cleanNames !== false;
  return {
    id: makeId('series', item.series_id),
    type: 'series',
    name: clean ? cleanTitle(item.name) : item.name,
    poster: item.cover || undefined,
    posterShape: 'poster',
    releaseInfo: item.releaseDate || undefined,
    description: item.plot || undefined
  };
}

// ---------- Détails ----------
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
  makeId, parseId, cleanTitle, normalizeChannel, isJunkName, resolveLogo,
  groupLiveStreams, liveGroupToMeta, decodeLiveGroup,
  vodToMeta, seriesToMeta, vodInfoToMetaDetail, seriesInfoToMetaDetail
};
