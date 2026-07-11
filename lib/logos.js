const axios = require('axios');
const cache = require('./cache');

// Base de logos HD open-source, organisée par pays.
const RAW_BASE = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/';
const TREE_API = 'https://api.github.com/repos/tv-logo/tv-logos/git/trees/main?recursive=1';

const COUNTRY_CODES = new Set(['fr','uk','us','de','es','it','be','ca','pt','nl','ch','ie','pl','ar','br','mx','tr','ru','se','no','dk','fi','gr','ro','at','au','in','ma','dz','tn','qa','sa','ae']);

let INDEX = null; // array of { path, slug, core, country, tokens }

function deaccent(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function slugify(name) {
  return deaccent(name)
    .toLowerCase()
    .replace(/\b(4k|uhd|2160p?|fhd|full ?hd|1080p?|hevc|h\.?265|x265|hd|720p?|sd|480p?|360p?)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function stripCountry(slug) {
  const parts = slug.split('-');
  if (parts.length > 1 && COUNTRY_CODES.has(parts[parts.length - 1])) {
    parts.pop();
  }
  return parts.join('-');
}

async function ensureIndex() {
  if (INDEX) return INDEX;
  const cached = cache.get('logo-index');
  if (cached) { INDEX = cached; return INDEX; }
  try {
    const { data } = await axios.get(TREE_API, {
      timeout: 15000,
      headers: { 'User-Agent': 'nuvio-xtream-addon', Accept: 'application/vnd.github+json' }
    });
    const tree = (data && data.tree) || [];
    const idx = [];
    for (const node of tree) {
      if (node.type !== 'blob') continue;
      if (!/\.(png|svg)$/i.test(node.path)) continue;
      const segs = node.path.split('/');
      const file = segs[segs.length - 1].replace(/\.(png|svg)$/i, '');
      const country = segs.length > 1 ? segs[segs.length - 2] : '';
      const slug = slugify(file);
      const core = stripCountry(slug);
      idx.push({ path: node.path, slug, core, country, tokens: core.split('-').filter(Boolean) });
    }
    INDEX = idx;
    cache.set('logo-index', idx, 86400); // 24h
    return idx;
  } catch (e) {
    INDEX = [];
    cache.set('logo-index', [], 1800); // réessaie dans 30 min si échec
    return [];
  }
}

function score(qCore, qTokens, entry) {
  if (entry.core === qCore) return 100 + (entry.country === 'france' ? 5 : 0);
  if (entry.slug === qCore) return 95;
  if (entry.core.startsWith(qCore) || qCore.startsWith(entry.core)) {
    const diff = Math.abs(entry.core.length - qCore.length);
    return 78 - Math.min(diff, 20) + (entry.country === 'france' ? 3 : 0);
  }
  if (qTokens.length && entry.tokens.length) {
    const set = new Set(entry.tokens);
    let inter = 0;
    for (const t of qTokens) if (set.has(t)) inter++;
    const union = new Set([...qTokens, ...entry.tokens]).size;
    const jac = inter / union;
    return jac * 70 + (entry.country === 'france' ? 2 : 0);
  }
  return 0;
}

async function findLogo(name) {
  try {
    const idx = await ensureIndex();
    if (!idx.length) return null;
    const q = slugify(name);
    if (!q) return null;
    const qCore = stripCountry(q);
    const qTokens = qCore.split('-').filter(Boolean);

    const cacheKey = 'logo-match:' + qCore;
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;

    let best = null, bestScore = 0;
    for (const entry of idx) {
      const s = score(qCore, qTokens, entry);
      if (s > bestScore) { bestScore = s; best = entry; }
    }
    const result = bestScore >= 48 ? RAW_BASE + best.path : null;
    cache.set(cacheKey, result, 86400);
    return result;
  } catch (e) {
    return null;
  }
}

// Pour les tests hors-ligne
function _setIndexForTest(entries) {
  INDEX = entries.map(e => {
    const slug = slugify(e.file);
    const core = stripCountry(slug);
    return { path: e.path, slug, core, country: e.country || '', tokens: core.split('-').filter(Boolean) };
  });
}

module.exports = { findLogo, ensureIndex, slugify, _setIndexForTest };
