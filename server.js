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

// Middleware: décode la config présente dans le premier segment de l'URL
function withConfig(req, res, next) {
  const config = decodeConfig(req.params.config);
  if (!config) {
    return res.status(400).json({ error: 'Config invalide. Réinstalle l\'addon depuis la page de configuration.' });
  }
  req.xtreamConfig = config;
  next();
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

// ---------- Manifest ----------

app.get('/:config/manifest.json', withConfig, async (req, res) => {
  try {
    const config = req.xtreamConfig;

    // On récupère les catégories pour générer les filtres "genre" dans Nuvio/Stremio
    const [liveCats, vodCats, seriesCats] = await Promise.all([
      xtream.getLiveCategories(config).catch(() => []),
      xtream.getVodCategories(config).catch(() => []),
      xtream.getSeriesCategories(config).catch(() => [])
    ]);

    const toGenreOptions = (cats) => (Array.isArray(cats) ? cats.map(c => c.category_name) : []);

    const manifest = {
      id: 'community.xtream.nuvio',
      version: '1.0.0',
      name: 'IPTV Xtream',
      description: 'Accède à ton abonnement IPTV Xtream Codes (live TV, films, séries)',
      logo: 'https://i.imgur.com/3rF3wZy.png',
      resources: ['catalog', 'meta', 'stream'],
      types: ['tv', 'movie', 'series'],
      idPrefixes: ['xtream:'],
      catalogs: [
        {
          type: 'tv',
          id: 'xtream-live',
          name: 'IPTV - Live TV',
          extra: [
            { name: 'search' },
            { name: 'genre', options: toGenreOptions(liveCats) },
            { name: 'skip' }
          ]
        },
        {
          type: 'movie',
          id: 'xtream-vod',
          name: 'IPTV - Films',
          extra: [
            { name: 'search' },
            { name: 'genre', options: toGenreOptions(vodCats) },
            { name: 'skip' }
          ]
        },
        {
          type: 'series',
          id: 'xtream-series',
          name: 'IPTV - Séries',
          extra: [
            { name: 'search' },
            { name: 'genre', options: toGenreOptions(seriesCats) },
            { name: 'skip' }
          ]
        }
      ],
      behaviorHints: { configurable: true, configurationRequired: false }
    };

    res.json(manifest);
  } catch (err) {
    console.error('Erreur manifest:', err.message);
    res.status(500).json({ error: 'Impossible de contacter le serveur Xtream. Vérifie tes identifiants.' });
  }
});

// ---------- Catalog ----------

function categoryIdFromName(cats, name) {
  const found = (cats || []).find(c => c.category_name === name);
  return found ? found.category_id : undefined;
}

function filterAndPaginate(items, { search, skip }) {
  let list = items;
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(i => (i.name || '').toLowerCase().includes(s));
  }
  const skipNum = parseInt(skip, 10) || 0;
  return list.slice(skipNum, skipNum + PAGE_SIZE);
}

app.get('/:config/catalog/:type/:rest(*)', withConfig, async (req, res) => {
  try {
    const config = req.xtreamConfig;
    const { type } = req.params;
    let rest = req.params.rest.replace(/\.json$/, '');
    const parts = rest.split('/');
    const catalogId = parts[0];

    const extra = { ...req.query };
    if (parts[1]) {
      parts[1].split('&').forEach(kv => {
        const [k, v] = kv.split('=');
        if (k) extra[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }

    let metas = [];

    if (catalogId === 'xtream-live' && type === 'tv') {
      const cats = await xtream.getLiveCategories(config);
      const categoryId = extra.genre ? categoryIdFromName(cats, extra.genre) : undefined;
      const streams = await xtream.getLiveStreams(config, categoryId);
      const page = filterAndPaginate(streams, extra);
      metas = page.map(mapper.liveToMeta);
    } else if (catalogId === 'xtream-vod' && type === 'movie') {
      const cats = await xtream.getVodCategories(config);
      const categoryId = extra.genre ? categoryIdFromName(cats, extra.genre) : undefined;
      const streams = await xtream.getVodStreams(config, categoryId);
      const page = filterAndPaginate(streams, extra);
      metas = page.map(mapper.vodToMeta);
    } else if (catalogId === 'xtream-series' && type === 'series') {
      const cats = await xtream.getSeriesCategories(config);
      const categoryId = extra.genre ? categoryIdFromName(cats, extra.genre) : undefined;
      const list = await xtream.getSeriesList(config, categoryId);
      const page = filterAndPaginate(list, extra);
      metas = page.map(mapper.seriesToMeta);
    }

    res.json({ metas });
  } catch (err) {
    console.error('Erreur catalog:', err.message);
    res.status(500).json({ metas: [] });
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
      // on retire les champs internes non standards avant renvoi
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
      // rawId = "seriesId:episodeId"
      const [seriesId, episodeId] = parsed.rawId.split(':');
      const data = await xtream.getSeriesInfo(config, seriesId);
      let ext = 'mp4';
      Object.values(data.episodes || {}).forEach(list => {
        const ep = list.find(e => String(e.id) === String(episodeId));
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

app.listen(PORT, () => {
  console.log(`Addon Xtream lancé sur http://localhost:${PORT}`);
  console.log(`Page de config : http://localhost:${PORT}/configure.html`);
});
