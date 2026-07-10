// Préfixe utilisé pour tous les IDs générés par cet addon, afin de ne jamais
// entrer en collision avec les IDs IMDB/TMDB d'autres addons.
const PREFIX = 'xtream';

function makeId(kind, rawId) {
  return `${PREFIX}:${kind}:${rawId}`;
}

function parseId(id) {
  // ex: "xtream:movie:12345" -> { kind: 'movie', rawId: '12345' }
  const parts = id.split(':');
  if (parts[0] !== PREFIX) return null;
  return { kind: parts[1], rawId: parts.slice(2).join(':') };
}

function liveToMeta(item) {
  return {
    id: makeId('live', item.stream_id),
    type: 'tv',
    name: item.name,
    poster: item.stream_icon || undefined,
    posterShape: 'square',
    genres: item.category_name ? [item.category_name] : undefined
  };
}

function vodToMeta(item) {
  return {
    id: makeId('movie', item.stream_id),
    type: 'movie',
    name: item.name,
    poster: item.stream_icon || item.cover || undefined,
    posterShape: 'poster',
    releaseInfo: item.year || undefined,
    genres: item.category_name ? [item.category_name] : undefined
  };
}

function seriesToMeta(item) {
  return {
    id: makeId('series', item.series_id),
    type: 'series',
    name: item.name,
    poster: item.cover || undefined,
    posterShape: 'poster',
    releaseInfo: item.releaseDate || undefined,
    genres: item.category_name ? [item.category_name] : undefined,
    description: item.plot || undefined
  };
}

function vodInfoToMetaDetail(item, rawId) {
  const info = item.info || {};
  return {
    id: makeId('movie', rawId),
    type: 'movie',
    name: info.name || info.o_name,
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
        thumbnail: ep.info && ep.info.movie_image ? ep.info.movie_image : undefined,
        // on planque l'extension du fichier + l'id xtream réel pour la résolution du stream
        xtreamEpisodeId: ep.id,
        xtreamContainerExt: ep.container_extension
      });
    });
  });

  return {
    id: makeId('series', rawId),
    type: 'series',
    name: info.name,
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
  liveToMeta,
  vodToMeta,
  seriesToMeta,
  vodInfoToMetaDetail,
  seriesInfoToMetaDetail
};
