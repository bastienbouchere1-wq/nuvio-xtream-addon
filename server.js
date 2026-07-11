const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const xtream = require('./lib/xtreamClient');
const mapper = require('./lib/mapper');
const themes = require('./lib/themes');
const logos = require('./lib/logos');
const cache = require('./lib/cache');

const app = express();
const PORT = process.env.PORT || 7000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PAGE_SIZE = 100;

// ---------- Config { host, user, pass, cats, opts } ----------
function encodeConfig(obj) { return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url'); }
function decodeConfig(str) { try { const o = JSON.parse(Buffer.from(str, 'base64url').toString('utf8')); if (!o.host || !o.user || !o.pass) return null; return o; } catch (e) { return null; } }
function withConfig(req, res, next) { const c = decodeConfig(req.params.config); if (!c) return res.status(400).json({ error: 'Config invalide.' }); req.xtreamConfig = c; next(); }

function getOpts(config) {
  const o = config.opts || {};
  const t = o.types || {};
  return {
    logos: o.logos !== false,
    group: o.group !== false,
    sortSources: o.sortSources !== false,
    cleanNames: o.cleanNames !== false,
    hideJunk: o.hideJunk !== false,
    hideAdult: o.hideAdult !== false,
    format: (o.format === 'ts' ? 'ts' : 'm3u8'),
    liveOrg: (o.liveOrg === 'category' ? 'category' : 'theme'),
    types: { live: t.live !== false, vod: t.vod !== false, series: t.series !== false }
  };
}

function cleanName(name) { if (!name) return 'Autre'; const c = String(name).replace(/[|►▶◄◅★☆✦✧✩#~»«❖▪▬➤]+/g, ' ').replace(/\s{2,}/g, ' ').trim(); return c || 'Autre'; }
function isAdultCategory(name) { return /(xxx|adult|porn|\bsex\b|\+18|18\+|adulte)/i.test(name || ''); }
function baseUrl(req) { return `${req.protocol}://${req.get('host')}`; }

function metaFromGroup(g, base, opts) {
  let poster;
  if (opts.logos && g.slug) {
    const fb = g.xtreamIcon ? Buffer.from(g.xtreamIcon, 'utf8').toString('base64url') : '_';
    poster = `${base}/l/${g.slug}/${fb}.png`;
  } else {
    poster = g.xtreamIcon || undefined;
  }
  return { id: mapper.liveGroupId(g), type: 'tv', name: g.name, poster, posterShape: 'square' };
}

// ---------- Proxy logo : teste le logo HD, retombe sur le logo Xtream sinon ----------
app.get('/l/:slug/:fb.png', async (req, res) => {
  const slug = req.params.slug;
  const fbEnc = req.params.fb;
  let fallback = null;
  if (fbEnc && fbEnc !== '_') { try { fallback = Buffer.from(fbEnc, 'base64url').toString('utf8'); } catch (e) {} }

  if (slug === '_') { if (fallback) return res.redirect(302, fallback); return res.status(204).end(); }

  const url = logos.LOGO_BASE + slug + '.png';
  const ck = 'logook:' + slug;
  let ok = cache.get(ck);
  if (ok === undefined) {
    try { const r = await axios.head(url, { timeout: 6000, validateStatus: s => s >= 200 && s < 500 }); ok = (r.status === 200); }
    catch (e) { ok = false; }
    cache.set(ck, ok, 86400);
  }
  if (ok) return res.redirect(302, url);
  if (fallback) return res.redirect(302, fallback);
  return res.status(204).end();
});

// ---------- Index thème (mis en cache) ----------
async function getThemeIndex(config, opts) {
  const key = `themeidx:${config.host}:${config.user}:${opts.cleanNames}:${opts.hideJunk}:${opts.logos}:${opts.hideAdult}`;
  let idx = cache.get(key);
  if (idx) return idx;
  const [cats, streams] = await Promise.all([
    xtream.getLiveCategories(config).catch(() => []),
    xtream.getLiveStreams(config).catch(() => [])
  ]);
  const adult = new Set();
  const catNameById = {};
  (cats || []).forEach(c => { const id = String(c.category_id); catNameById[id] = cleanName(c.category_name); if (opts.hideAdult && isAdultCategory(c.category_name)) adult.add(id); });
  const filtered = (streams || []).filter(st => !adult.has(String(st.category_id)));
  idx = mapper.buildLiveThemes(filtered, opts, catNameById);
  cache.set(key, idx, 3600);
  return idx;
}

// ---------- Page de config ----------
app.get('/', (req, res) => res.redirect('/configure.html'));

app.get('/api/categories', async (req, res) => {
  const { host, user, pass } = req.query;
  if (!host || !user || !pass) return res.status(400).json({ error: 'host, user et pass sont requis' });
  const config = { host, user, pass };
  try {
    const [live, vod, series] = await Promise.all([
      xtream.getLiveCategories(config).catch(() => []),
      xtream.getVodCategories(config).catch(() => []),
      xtream.getSeriesCategories(config).catch(() => [])
    ]);
    const map = (cats) => (Array.isArray(cats) ? cats : []).filter(c => !isAdultCategory(c.category_name)).map(c => ({ id: String(c.category_id), name: cleanName(c.category_name) }));
    res.json({ live: map(live), vod: map(vod), series: map(series) });
  } catch (e) { res.status(500).json({ error: 'Connexion au serveur Xtream impossible. Vérifie tes identifiants.' }); }
});

app.post('/api/generate-url', (req, res) => {
  const { host, user, pass, cats, opts } = req.body || {};
  if (!host || !user || !pass) return res.status(400).json({ error: 'host, user et pass sont requis' });
  const config = encodeConfig({ host, user, pass, cats: cats || undefined, opts: opts || undefined });
  res.json({ manifestUrl: `${baseUrl(req)}/${config}/manifest.json` });
});

// ---------- Manifest ----------
app.get('/:config/manifest.json', withConfig, async (req, res) => {
  try {
    const config = req.xtreamConfig;
    const opts = getOpts(config);
    const sel = config.cats || null;
    const totalSel = sel ? ['vod', 'series'].reduce((n, t) => n + ((sel[t] || []).length), 0) + ((sel.live || []).length) : 0;
    const keep = (type, id) => { if (!sel || totalSel === 0) return true; return (sel[type] || []).map(String).includes(String(id)); };

    const catalogs = [];
    if (opts.types.live) catalogs.push({ type: 'tv', id: 'xtream-search-live', name: 'IPTV Live', extra: [{ name: 'search', isRequired: true }] });
    if (opts.types.vod) catalogs.push({ type: 'movie', id: 'xtream-search-vod', name: 'IPTV Films', extra: [{ name: 'search', isRequired: true }] });
    if (opts.types.series) catalogs.push({ type: 'series', id: 'xtream-search-series', name: 'IPTV Séries', extra: [{ name: 'search', isRequired: true }] });

    // LIVE
    if (opts.types.live) {
      if (opts.liveOrg === 'theme') {
        const idx = await getThemeIndex(config, opts);
        themes.order.forEach(k => { if ((idx[k] || []).length) catalogs.push({ type: 'tv', id: 'xtream-theme-' + k, name: themes.labels[k], extra: [{ name: 'skip' }] }); });
      } else {
        const liveCats = await xtream.getLiveCategories(config).catch(() => []);
        (liveCats || []).forEach(c => {
          if (opts.hideAdult && isAdultCategory(c.category_name)) return;
          if (!keep('live', c.category_id)) return;
          catalogs.push({ type: 'tv', id: 'xtream-live-' + c.category_id, name: cleanName(c.category_name), extra: [{ name: 'skip' }] });
        });
      }
    }
    // VOD & SÉRIES (toujours par catégories)
    const addCats = async (getter, type, prefix, selType) => {
      const cats = await getter.catch(() => []);
      (cats || []).forEach(c => {
        if (opts.hideAdult && isAdultCategory(c.category_name)) return;
        if (!keep(selType, c.category_id)) return;
        catalogs.push({ type, id: `${prefix}-${c.category_id}`, name: cleanName(c.category_name), extra: [{ name: 'skip' }] });
      });
    };
    if (opts.types.vod) await addCats(xtream.getVodCategories(config), 'movie', 'xtream-vod', 'vod');
    if (opts.types.series) await addCats(xtream.getSeriesCategories(config), 'series', 'xtream-series', 'series');

    res.json({
      id: 'community.xtream.nuvio',
      version: '1.4.0',
      name: 'IPTV Xtream',
      description: 'Ton abonnement IPTV Xtream, réorganisé par thème et épuré',
      logo: 'https://i.imgur.com/3rF3wZy.png',
      resources: ['catalog', 'meta', 'stream'],
      types: ['tv', 'movie', 'series'],
      idPrefixes: ['xtream:'],
      catalogs,
      behaviorHints: { configurable: true, configurationRequired: false }
    });
  } catch (err) {
    console.error('Erreur manifest:', err.message);
    res.status(500).json({ error: 'Impossible de contacter le serveur Xtream.' });
  }
});

// ---------- Catalog ----------
app.get('/:config/catalog/:type/:rest(*)', withConfig, async (req, res) => {
  try {
    const config = req.xtreamConfig;
    const opts = getOpts(config);
    const base = baseUrl(req);
    let rest = req.params.rest.replace(/\.json$/, '');
    const parts = rest.split('/');
    const catalogId = parts[0];
    const extra = {};
    if (parts[1]) parts[1].split('&').forEach((kv) => { const [k, v] = kv.split('='); if (k) extra[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
    const skip = parseInt(extra.skip, 10) || 0;
    const search = extra.search ? extra.search.toLowerCase() : null;

    // Catalogue thème
    if (catalogId.startsWith('xtream-theme-')) {
      const themeKey = catalogId.slice('xtream-theme-'.length);
      const idx = await getThemeIndex(config, opts);
      let list = idx[themeKey] || [];
      if (search) list = list.filter(g => (g.name || '').toLowerCase().includes(search));
      const page = list.slice(skip, skip + PAGE_SIZE);
      return res.json({ metas: page.map(g => metaFromGroup(g, base, opts)) });
    }

    // Recherche live globale
    if (catalogId === 'xtream-search-live') {
      let groups;
      if (opts.liveOrg === 'theme') { const idx = await getThemeIndex(config, opts); groups = [].concat.apply([], themes.order.map(k => idx[k] || [])); }
      else { const streams = await xtream.getLiveStreams(config); groups = mapper.groupStreams(streams, opts); }
      if (search) groups = groups.filter(g => (g.name || '').toLowerCase().includes(search));
      const page = groups.slice(skip, skip + PAGE_SIZE);
      return res.json({ metas: page.map(g => metaFromGroup(g, base, opts)) });
    }

    // Live par catégorie
    if (catalogId.startsWith('xtream-live-')) {
      const catId = catalogId.slice('xtream-live-'.length);
      const streams = await xtream.getLiveStreams(config, catId || undefined);
      let groups = mapper.groupStreams(streams, opts);
      if (search) groups = groups.filter(g => (g.name || '').toLowerCase().includes(search));
      const page = groups.slice(skip, skip + PAGE_SIZE);
      return res.json({ metas: page.map(g => metaFromGroup(g, base, opts)) });
    }

    // VOD / Séries
    let kind = null, catId = null;
    if (catalogId === 'xtream-search-vod') kind = 'vod';
    else if (catalogId.startsWith('xtream-vod-')) { kind = 'vod'; catId = catalogId.slice('xtream-vod-'.length); }
    else if (catalogId === 'xtream-search-series') kind = 'series';
    else if (catalogId.startsWith('xtream-series-')) { kind = 'series'; catId = catalogId.slice('xtream-series-'.length); }
    else return res.json({ metas: [] });

    let items = [];
    let mapFn = null;
    if (kind === 'vod') { items = await xtream.getVodStreams(config, catId || undefined); mapFn = (i) => mapper.vodToMeta(i, opts); }
    else if (kind === 'series') { items = await xtream.getSeriesList(config, catId || undefined); mapFn = (i) => mapper.seriesToMeta(i, opts); }
    if (!Array.isArray(items)) items = [];
    if (opts.hideJunk) items = items.filter(i => !mapper.isJunkName(i.name));
    if (search) items = items.filter(i => (i.name || '').toLowerCase().includes(search));
    const page = items.slice(skip, skip + PAGE_SIZE);
    res.json({ metas: page.map(mapFn) });
  } catch (err) {
    console.error('Erreur catalog:', err.message);
    res.json({ metas: [] });
  }
});

// ---------- Meta ----------
app.get('/:config/meta/:type/:id.json', withConfig, async (req, res) => {
  try {
    const config = req.xtreamConfig;
    const parsed = mapper.parseId(req.params.id);
    if (!parsed) return res.status(404).json({ error: 'ID inconnu' });
    if (parsed.kind === 'lg') { const obj = mapper.decodeLiveGroup(parsed.rawId); return res.json({ meta: { id: req.params.id, type: 'tv', name: obj.n || 'Chaîne', posterShape: 'square' } }); }
    if (parsed.kind === 'live') return res.json({ meta: { id: req.params.id, type: 'tv', name: 'Chaîne live' } });
    if (parsed.kind === 'movie') { const data = await xtream.getVodInfo(config, parsed.rawId); return res.json({ meta: mapper.vodInfoToMetaDetail(data, parsed.rawId) }); }
    if (parsed.kind === 'series') { const data = await xtream.getSeriesInfo(config, parsed.rawId); return res.json({ meta: mapper.seriesInfoToMetaDetail(data, parsed.rawId) }); }
    res.status(404).json({ error: 'Type inconnu' });
  } catch (err) { console.error('Erreur meta:', err.message); res.status(500).json({ error: 'Erreur serveur' }); }
});

// ---------- Stream ----------
app.get('/:config/stream/:type/:id.json', withConfig, async (req, res) => {
  try {
    const config = req.xtreamConfig;
    const opts = getOpts(config);
    const parsed = mapper.parseId(req.params.id);
    if (!parsed) return res.status(404).json({ streams: [] });
    if (parsed.kind === 'lg') {
      const obj = mapper.decodeLiveGroup(parsed.rawId);
      const streams = (obj.v || []).slice().sort((a, b) => (b[1] || 0) - (a[1] || 0)).map((v) => ({ url: xtream.buildStreamUrl(config, 'live', v[0], opts.format), name: 'IPTV Xtream', title: v[2] || 'Live' }));
      return res.json({ streams });
    }
    if (parsed.kind === 'live') { const url = xtream.buildStreamUrl(config, 'live', parsed.rawId, opts.format); return res.json({ streams: [{ url, title: 'Live', name: 'IPTV Xtream' }] }); }
    if (parsed.kind === 'movie') { const data = await xtream.getVodInfo(config, parsed.rawId); const ext = (data.movie_data && data.movie_data.container_extension) || 'mp4'; const url = xtream.buildStreamUrl(config, 'movie', parsed.rawId, ext); return res.json({ streams: [{ url, title: 'Film', name: 'IPTV Xtream' }] }); }
    if (parsed.kind === 'episode') {
      const [seriesId, episodeId] = parsed.rawId.split(':');
      const data = await xtream.getSeriesInfo(config, seriesId);
      let ext = 'mp4';
      Object.values(data.episodes || {}).forEach((list) => { const ep = list.find((e) => String(e.id) === String(episodeId)); if (ep) ext = ep.container_extension || ext; });
      const url = xtream.buildStreamUrl(config, 'series', episodeId, ext);
      return res.json({ streams: [{ url, title: 'Episode', name: 'IPTV Xtream' }] });
    }
    res.json({ streams: [] });
  } catch (err) { console.error('Erreur stream:', err.message); res.status(500).json({ streams: [] }); }
});

app.listen(PORT, '0.0.0.0', () => { console.log(`Addon Xtream lancé sur le port ${PORT}`); console.log('Page de config : /configure.html'); });
