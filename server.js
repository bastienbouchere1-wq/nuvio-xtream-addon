const express = require('express');
const cors = require('cors');
const path = require('path');

const xtream = require('./lib/xtreamClient');
const mapper = require('./lib/mapper');
const cache = require('./lib/cache');

const app = express();
const PORT = process.env.PORT || 7000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const PAGE_SIZE = 100;

// ---------- Gestion de la config (host/user/pass) encodée en base64url dans l'URL ----------

function encodeConfig({ host, user, pass }) {
  const json = JSON.stringify({ host, user, pass });
  return Buffer.from(json, 'utf8').toString('base64url');
}

function decodeConfig(configStr) {
  try {
    const json = Buffer.from(configStr, 'base64url').toString('utf8');
    const obj = JSON.parse(json);
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

app.get('/', (req, res) => {
  res.redirect('/configure.html');
});

app.get('/api/generate-url', (req, res) => {
  const { host, user, pass } = req.query;
  if (!host || !user || !pass) {
    return res.status(400).json({ error: 'host, user et pass sont requis' });
  }
  const config = encodeConfig({ host, user, pass });
  const base = `${req.protocol}://${req.get('host')}`;
  res.json({
    manifestUrl: `${base}/${config}/manifest.json`
  });
});

// ---------- Manifest : un catalogue (dossier) par catégorie Xtream ----------

app.get('/:config/manifest.json', withConfig, async (req, res) => {
  try {
    const config = req.xtreamConfig;

    const [liveCats, vodCats, seriesCats] = await Promise.all([
      xtream.getLiveCategories(config).catch(() => []),
      xtream.getVodCategories(config).catch(() => []),
      xtream.getSeriesCategories(config).catch(() => [])
    ]);

    const catalogs = [];

    // Catalogues de recherche globale : n'apparaissent PAS comme des rangées sur l'accueil,
    // ils servent uniquement à la recherche transversale (toutes catégories confondues).
    catalogs.push({ type: 'tv', id: 'xtream-search-live', name: 'IPTV Live', extra: [{ name: 'search', isRequired: true }] });
    catalogs.push({ type: 'movie', id: 'xtream-search-vod', name: 'IPTV Films', extra: [{ name: 'search', isRequired: true }] });
    catalogs.push({ type: 'series', id: 'xtream-search-series', name: 'IPTV Séries', extra: [{ name: 'search', isRequired: true }] });

    // Un catalogue par catégorie -> Nuvio affiche une rangée / un dossier distinct par thème
    const addCategoryCatalogs = (cats, type, prefix) => {
      (Array.isArray(cats) ? cats : []).forEach((c) => {
        if (isAdultCategory(c.category_name)) return; // masqué par défaut
        catalogs.push({
          type,
          id: `${prefix}-${c.category_id}`,
          name: cleanName(c.category_name),
          extra: [{ name: 'skip' }]
        });
      });
    };

    addCategoryCatalogs(liveCats, 'tv', 'xtream-live');
    addCategoryCatalogs(vodCats, 'movie', 'xtream-vod');
    addCategoryCatalogs(seriesCats, 'series', 'xtream-series');

    const manifest = {
      id: 'community.xtream.nuvio',
      version: '1.1.0',
      name: 'IPTV Xtream',
      description: 'Accède à ton abonnement IPTV Xtream Codes (live TV, films, séries), rangé par catégories',
      logo: 'https://i.imgur.com/3rF3wZy.png',
      resources: ['catalog', 'meta', 'stream'],
      types: ['tv', 'movie', 'series'],
      idPrefixes: ['xtream:'],
      catalogs,
      behaviorHints: { configurable: true, configurationRequired: false }
    };

    res.json(manifest);
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

    // extra props éventuels : "search=batman", "skip=100", "genre=x&skip=100"
    const extra = {};
    if (parts[1]) {
      parts[1].split('&').forEach((kv) => {
        const [k, v] = kv.split('=');
        if (k) extra[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }
    const skip = parseInt(extra.skip, 10) || 0;
    const search = extra.search ? extra.search.toLowerCase() : null;

    // Détermine le type (live/vod/series) + l'éventuel id de catégorie
    let kind = null;
    let catId = null;
    if (catalogId === 'xtream-search-live') { kind = 'live'; }
    else if (catalogId.startsWith('xtream-live-')) { kind = 'live'; catId = catalogId.slice('xtream-live-'.length); }
    else if (catalogId === 'xtream-search-vod') { kind = 'vod'; }
    else if (catalogId.startsWith('xtream-vod-')) { kind = 'vod'; catId = catalogId.slice('xtream-vod-'.length); }
    else if (catalogId === 'xtream-search-series') { kind = 'series'; }
    else if (catalogId.startsWith('xtream-series-')) { kind = 'series'; catId = catalogId.slice('xtream-series-'.length); }
    else { return res.json({ metas: [] }); }

    let items = [];
    let mapFn = null;

    if (kind === 'live') {
      items = await xtream.getLiveStreams(config, catId || undefined);
      mapFn = mapper.liveToMeta;
    } else if (kind === 'vod') {
      items = await xtream.getVodStreams(config, catId || undefined);
      mapFn = mapper.vodToMeta;
    } else if (kind === 'series') {
      items = await xtream.getSeriesList(config, catId || undefined);
      mapFn = mapper.seriesToMeta;
    }

    if (!Array.isArray(items)) items = [];

    if (search) {
      items = items.filter((i) => (i.name || '').toLowerCase().includes(search));
    }

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

    if (parsed.kind === 'movie') {
      const data = await xtream.getVodInfo(config, parsed.rawId);
      return res.json({ meta: mapper.vodInfoToMetaDetail(data, parsed.rawId) });
    }

    if (parsed.kind === 'series') {
      const data = await xtream.getSeriesInfo(config, parsed.rawId);
      const meta = mapper.seriesInfoToMetaDetail(data, parsed.rawId);
      meta.videos = meta.videos.map(({ xtreamEpisodeId, xtreamContainerExt, ...v }) => v);
      return res.json({ meta });
    }

    if (parsed.kind === 'live') {
      return res.json({ meta: { id: req.params.id, type: 'tv', name: 'Chaîne live' } });
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
