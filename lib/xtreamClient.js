const axios = require('axios');
const cache = require('./cache');

/**
 * Construit l'URL de base propre (sans slash final) à partir du host fourni.
 * Accepte "monserveur.com:8080", "http://monserveur.com:8080", etc.
 */
function normalizeHost(host) {
  let h = host.trim();
  if (!/^https?:\/\//i.test(h)) {
    h = 'http://' + h;
  }
  return h.replace(/\/+$/, '');
}

function apiUrl(config, action, extraParams = {}) {
  const base = normalizeHost(config.host);
  const params = new URLSearchParams({
    username: config.user,
    password: config.pass,
    action,
    ...extraParams
  });
  return `${base}/player_api.php?${params.toString()}`;
}

async function callApi(config, action, extraParams = {}, ttlSeconds = 3600) {
  const cacheKey = `api:${config.host}:${config.user}:${action}:${JSON.stringify(extraParams)}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url = apiUrl(config, action, extraParams);
  const { data } = await axios.get(url, { timeout: 15000 });
  cache.set(cacheKey, data, ttlSeconds);
  return data;
}

async function authenticate(config) {
  // Sans action, player_api.php renvoie les infos du compte + du serveur
  const base = normalizeHost(config.host);
  const url = `${base}/player_api.php?username=${encodeURIComponent(config.user)}&password=${encodeURIComponent(config.pass)}`;
  const { data } = await axios.get(url, { timeout: 15000 });
  return data;
}

const getLiveCategories = (config) => callApi(config, 'get_live_categories', {}, 21600);
const getVodCategories = (config) => callApi(config, 'get_vod_categories', {}, 21600);
const getSeriesCategories = (config) => callApi(config, 'get_series_categories', {}, 21600);

const getLiveStreams = (config, categoryId) =>
  callApi(config, 'get_live_streams', categoryId ? { category_id: categoryId } : {}, 3600);
const getVodStreams = (config, categoryId) =>
  callApi(config, 'get_vod_streams', categoryId ? { category_id: categoryId } : {}, 3600);
const getSeriesList = (config, categoryId) =>
  callApi(config, 'get_series', categoryId ? { category_id: categoryId } : {}, 3600);

const getVodInfo = (config, vodId) =>
  callApi(config, 'get_vod_info', { vod_id: vodId }, 21600);
const getSeriesInfo = (config, seriesId) =>
  callApi(config, 'get_series_info', { series_id: seriesId }, 21600);

const getShortEpg = (config, streamId, limit = 4) =>
  callApi(config, 'get_short_epg', { stream_id: streamId, limit }, 300);

function buildStreamUrl(config, kind, streamId, extension) {
  const base = normalizeHost(config.host);
  if (kind === 'live') {
    const fmt = extension || 'm3u8';
    return `${base}/live/${config.user}/${config.pass}/${streamId}.${fmt}`;
  }
  if (kind === 'movie') {
    return `${base}/movie/${config.user}/${config.pass}/${streamId}.${extension || 'mp4'}`;
  }
  if (kind === 'series') {
    return `${base}/series/${config.user}/${config.pass}/${streamId}.${extension || 'mp4'}`;
  }
  throw new Error('kind inconnu: ' + kind);
}

module.exports = {
  normalizeHost,
  authenticate,
  getLiveCategories,
  getVodCategories,
  getSeriesCategories,
  getLiveStreams,
  getVodStreams,
  getSeriesList,
  getVodInfo,
  getSeriesInfo,
  getShortEpg,
  buildStreamUrl
};
