const express = require('express');
const cors = require('cors');
const path = require('path');

const xtream = require('./lib/xtreamClient');
const mapper = require('./lib/mapper');

const app = express();
const PORT = process.env.PORT || 7000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PAGE_SIZE = 100;

// ---------- Config (host/user/pass + sélection de catégories) encodée en base64url ----------

function encodeConfig(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}
function decodeConfig(configStr) {
  try {
    const obj = JSON.parse(Buffer.from(configStr, 'base64url').toString('utf8'));
    if (!obj.host || !obj.user || !obj.pass) return null;
    return obj;
  } catch (e) {
    return null;
  }
}
function withConfig(req, res, next) {
  const config = decodeConfig(req.params.config);
  if (!config) {
    return res.status(400).json({ error: 'Config invalide. Réinstalle l\'addon depuis la page de configuration.' });
  }
  req.xtreamConfig = config;
  next();
}

// ---------- Nettoyage des noms de catégories ----------
function cleanName(name) {
  if (!name) return 'Autre';
  const cleaned = String(name)
    .replace(/[|►▶◄◅★☆✦✧✩#~»«❖▪▬➤]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned || 'Autre';
}
function isAdultCategory(name) {
  return /(xxx|adult|porn|\bsex\b|\+18|18\+|adulte)/i.test(name || '');
}

// ---------- Page de configuration ----------
app.get('/', (req, res) => res.redirect('/configure.html'));

// Liste les catégories du serveur (pour la sélection par cases à cocher)
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
    const map = (cats) => (Array.isArray(cats) ? cats : [])
      .filter(c => !isAdultCategory(c.category_name))
      .map(c => ({ id: String(c.category_id), name: cleanName(c.category_name) }));
    res.json({ live: map(live), vod: map(vod), series: map(series) });
  } catch (e) {
    res.status(500).json({ error: 'Connexion au serveur Xtream impossible. Vérifie tes identifiants.' });
  }
});

// Génère l'URL du manifest (avec sélection de catégories)
app.post('/api/generate-url', (req, res) => {
  const { host, user, pass, cats } = req.body || {};
  if (!host || !user || !pass) return res.status(400).json({ error: 'host, user et pass sont requis' });
  const config = encodeConfig({ host, user, pass, cats: cats || undefined });
  const base = `${req.protocol}://${req.get('host')}`;
  res.json({ manifestUrl: `${base}/${config}/manifest.json` });
});
// Compat : ancienne version sans sélection
app.get('/api/generate-url', (req, res) => {
  const { host, user, pass } = req.query;
  if (!host || !user || !pass) return res.status(400).json({ error: 'host, user et pass sont requis' });
  const config = encodeConfig({ host, user, pass });
  const base = `${req.protocol}://${req.get('host')}`;
  res.json({ manifestUrl: `${base}/${config}/manifest.json` });
});

// ---------- Manifest : un dossier par catégorie sélectionnée ----------
app.get('/:config/manifest.json', withConfig, async (req, res) => {
  try {
    const config = req.xtreamConfig;
    const sel = config.cats || null;
    const totalSel = sel ? ['live', 'vod', 'series'].reduce((n, t) => n + ((sel[t] || []).length), 0) : 0;
    const keep = (type, id) => {
      if (!sel || totalSel === 0) return true;
      return (sel[type] || []).map(String).includes(String(id));
    };

    const [liveCats, vodCats, seriesCats] = await Promise.all([
      xtream.getLiveCategories(config).catch(() => []),
      xtream.getVodCategories(config).catch(() => []),
      xtream.getSeriesCategories(config).catch(() => [])
    ]);

    const catalogs = [];
    // Recherche globale (n'apparaît pas en rangée)
    catalogs.push({ type: 'tv', id: 'xtream-search-live', name: 'IPTV Live', extra: [{ name: 'search', isRequired: true }] });
    catalogs.push({ type: 'movie', id: 'xtream-search-vod', name: 'IPTV Films', extra: [{ name: 'search', isRequired: true }] });
    catalogs.push({ type: 'series', id: 'xtream-search-series', name: 'IPTV Séries', extra: [{ name: 'search', isRequired: true }] });

    const addCategoryCatalogs = (cats, type, prefix, selType) => {
      (Array.isArray(cats) ? cats : []).forEach((c) => {
        if (isAdultCategory(c.category_name)) return;
        if (!keep(selType, c.category_id)) return;
        catalogs.push({ type, id: `${prefix}-${c.category_id}`, name: cleanName(c.category_name), extra: [{ name: 'skip' }] });
      });
    };
    addCategoryCatalogs(liveCats, 'tv', 'xtream-live', 'live');
    addCategoryCatalogs(vodCats, 'movie', 'xtream-vod', 'vod');
    addCategoryCatalogs(seriesCats, 'series', 'xtream-series', 'series');

    res.json({
      id: 'community.xtream.nuvio',
      version: '1.2.0',
      name: 'IPTV Xtream',
      description: 'Ton abonnement IPTV Xtream, rangé par catégories et dédoublonné',
      logo: 'https://i.imgur.com/3rF3wZy.png',
      resources: ['catalog', 'meta', 'stream'],
      types: ['tv', 'movie', 'series'],
      idPrefixes: ['xtream:'],
      catalogs,
      behaviorHints: { configurable: true, configurationRequired: false }
    });
  } catch (err) {
    console.error('Erreur manifest:', err.message);
    res.status(500).json({ error: 'Impossible de contacter le serveur Xtream. Vérifie tes identifiants.' });
  }
});

// ---------- Catalog ----------
app.get('/:config/catalog/:type/:rest(*)', withConfig, async (req, res) => {
  try {
    const config = req.xtreamConfig;
    let rest = req.params.rest.replace(/\.json$/, '');
    const parts = rest.split('/');
    const catalogId = parts[0];

    const extra = {};
    if (parts[1]) {
      parts[1].split('&').forEach((kv) => {
        const [k, v] = kv.split('=');
        if (k) extra[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }
    const skip = parseInt(extra.skip, 10) || 0;
    const search = extra.search ? extra.search.toLowerCase() : null;

    let kind = null, catId = null;
    if (catalogId === 'xtream-search-live') { kind = 'live'; }
    else if (catalogId.startsWith('xtream-live-')) { kind = 'live'; catId = catalogId.slice('xtream-live-'.length); }
    else if (catalogId === 'xtream-search-vod') { kind = 'vod'; }
    else if (catalogId.startsWith('xtream-vod-')) { kind = 'vod'; catId = catalogId.slice('xtream-vod-'.length); }
    else if (catalogId === 'xtream-search-series') { kind = 'series'; }
    else if (catalogId.startsWith('xtream-series-')) { kind = 'series'; catId = catalogId.slice('xtream-series-'.length); }
    else { return res.json({ metas: [] }); }

    if (kind === 'live') {
      const streams = await xtream.getLiveStreams(config, catId || undefined);
      let groups = mapper.groupLiveStreams(streams);
      if (search) groups = groups.filter(g => (g.name || '').toLowerCase().includes(search));
      const page = groups.slice(skip, skip + PAGE_SIZE);
      return res.json({ metas: page.map(mapper.liveGroupToMeta) });
    }

    let items = [];
    let mapFn = null;
    if (kind === 'vod') { items = await xtream.getVodStreams(config, catId || undefined); mapFn = mapper.vodToMeta; }
    else if (kind === 'series') { items = await xtream.getSeriesList(config, catId || undefined); mapFn = mapper.seriesToMeta; }

    if (!Array.isArray(items)) items = [];
    if (search) items = items.filter((i) => (i.name || '').toLowerCase().includes(search));
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

    if (parsed.kind === 'lg') {
      const obj = mapper.decodeLiveGroup(parsed.rawId);
      return res.json({ meta: { id: req.params.id, type: 'tv', name: obj.n || 'Chaîne', posterShape: 'square' } });
    }
    if (parsed.kind === 'live') {
      return res.json({ meta: { id: req.params.id, type: 'tv', name: 'Chaîne live' } });
    }
    if (parsed.kind === 'movie') {
      const data = await xtream.getVodInfo(config, parsed.rawId);
      return res.json({ meta: mapper.vodInfoToMetaDetail(data, parsed.rawId) });
    }
    if (parsed.kind === 'series') {
      const data = await xtream.getSeriesInfo(config, parsed.rawId);
      return res.json({ meta: mapper.seriesInfoToMetaDetail(data, parsed.rawId) });
    }
    res.status(404).json({ error: 'Type inconnu' });
  } catch (err) {
    console.error('Erreur meta:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ---------- Stream ----------
app.get('/:config/stream/:type/:id.json', withConfig, async (req, res) => {
  try {
    const config = req.xtreamConfig;
    const parsed = mapper.parseId(req.params.id);
    if (!parsed) return res.status(404).json({ streams: [] });

    if (parsed.kind === 'lg') {
      const obj = mapper.decodeLiveGroup(parsed.rawId);
      const streams = (obj.v || [])
        .slice()
        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
        .map((v) => ({
          url: xtream.buildStreamUrl(config, 'live', v[0]),
          title: v[2] || 'Live',
          name: `IPTV • ${v[2] || 'Auto'}`
        }));
      return res.json({ streams });
    }

    if (parsed.kind === 'live') {
      const url = xtream.buildStreamUrl(config, 'live', parsed.rawId);
      return res.json({ streams: [{ url, title: 'Live', name: 'IPTV Xtream' }] });
    }

    if (parsed.kind === 'movie') {
      const data = await xtream.getVodInfo(config, parsed.rawId);
      const ext = (data.movie_data && data.movie_data.container_extension) || 'mp4';
      const url = xtream.buildStreamUrl(config, 'movie', parsed.rawId, ext);
      return res.json({ streams: [{ url, title: 'Film', name: 'IPTV Xtream' }] });
    }

    if (parsed.kind === 'episode') {
      const [seriesId, episodeId] = parsed.rawId.split(':');
      const data = await xtream.getSeriesInfo(config, seriesId);
      let ext = 'mp4';
      Object.values(data.episodes || {}).forEach((list) => {
        const ep = list.find((e) => String(e.id) === String(episodeId));
        if (ep) ext = ep.container_extension || ext;
      });
      const url = xtream.buildStreamUrl(config, 'series', episodeId, ext);
      return res.json({ streams: [{ url, title: 'Episode', name: 'IPTV Xtream' }] });
    }

    res.json({ streams: [] });
  } catch (err) {
    console.error('Erreur stream:', err.message);
    res.status(500).json({ streams: [] });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Addon Xtream lancé sur le port ${PORT}`);
  console.log(`Page de config : /configure.html`);
});
