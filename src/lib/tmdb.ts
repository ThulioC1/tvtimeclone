const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/';
const ACCESS_TOKEN = import.meta.env.VITE_TMDB_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4MTdjMTg0MGQyOWNkZTFjNjI0NDhlYWVhNTYzMTk3ZCIsIm5iZiI6MTc4NDEzOTQ3Mi41ODQsInN1YiI6IjZhNTdjZWQwNDliMDNkMjllNWQ2MjFmZiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.idDdHydn8lcyn5ZBIrIsSz0i9hEN5kLl3U4adpeWPzA';

async function fetchTMDB<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`TMDB request failed (${res.status})`);
  return res.json() as Promise<T>;
}

interface RawTVCreator { name: string }
interface RawNetwork { id: number; name: string }
interface RawSeason {
  id: number;
  season_number: number;
  episode_count: number;
  poster_path: string | null;
  air_date: string | null;
  overview: string;
  name?: string;
}
interface RawEpisode {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string | null;
  runtime: number | null;
  vote_average: number;
}
interface RawGenre { id: number; name: string }
interface RawTVShow {
  id: number;
  name: string;
  original_name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids?: number[];
  genres?: RawGenre[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  networks?: RawNetwork[];
  seasons?: RawSeason[];
  created_by?: RawTVCreator[];
}
interface RawMovie {
  id: number;
  title: string;
  original_title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids?: number[];
  genres?: RawGenre[];
  runtime: number;
  imdb_id: string | null;
  production_companies?: { name: string }[];
  budget?: number;
  revenue?: number;
  status?: string;
  tagline?: string;
}
interface RawCredits {
  crew: { known_for_department: string; name: string; job: string }[];
  cast: { name: string; character: string; order: number }[];
}
interface RawVideo {
  key: string;
  site: string;
  type: string;
  official: boolean;
}
interface RawSearchResult<T> {
  results: T[];
  total_results: number;
  total_pages: number;
  page: number;
}

export interface TVSeason {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  poster_path: string | null;
  air_date: string | null;
  overview: string;
  episodes?: TVEpisode[];
}

export interface TVEpisode {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string | null;
  runtime: number | null;
  vote_average: number;
}

export interface TVShow {
  id: number;
  name: string;
  original_name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  networks?: { id: number; name: string }[];
  seasons?: TVSeason[];
}

export interface TMDBMovieSimple {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  genre_ids: number[];
  overview: string;
}

export interface TMDBMovieDetail {
  id: number;
  title: string;
  release_date: string;
  runtime: number | null;
  genres: { id: number; name: string }[];
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  imdb_id: string | null;
  director: string;
  writers: string[];
  actors: { name: string; character: string }[];
  production_companies: string[];
  tagline: string;
  status: string;
  budget: number;
  revenue: number;
}

export const formatGenres = (genres: { id: number; name: string }[]): string =>
  genres.map((g) => g.name).join(', ');

const normalizeSeason = (s: RawSeason): TVSeason => ({
  id: s.id,
  season_number: s.season_number,
  name: s.name || `Temporada ${s.season_number}`,
  episode_count: s.episode_count,
  poster_path: s.poster_path,
  air_date: s.air_date,
  overview: s.overview || '',
});

const normalizeEpisode = (e: RawEpisode): TVEpisode => ({
  id: e.id,
  episode_number: e.episode_number,
  season_number: e.season_number,
  name: e.name,
  overview: e.overview || '',
  still_path: e.still_path,
  air_date: e.air_date,
  runtime: e.runtime,
  vote_average: e.vote_average || 0,
});

export const getPosterUrl = (path: string | null, size = 'w342'): string | null => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${IMG_BASE}${size}${path}`;
};

export const getBackdropUrl = (path: string | null, size = 'w1280'): string | null => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${IMG_BASE}${size}${path}`;
};

export const searchTVShows = async (query: string): Promise<TVShow[]> => {
  if (!query.trim()) return [];
  try {
    const data = await fetchTMDB<RawSearchResult<RawTVShow>>(`/search/tv`, { query, language: 'pt-BR' });
    return data.results.map(normalizeTVShow);
  } catch { return []; }
};

export const searchMovies = async (query: string): Promise<TMDBMovieSimple[]> => {
  if (!query.trim()) return [];
  try {
    const data = await fetchTMDB<RawSearchResult<RawMovie>>(`/search/movie`, { query, language: 'pt-BR' });
    return data.results.map(normalizeMovieSimple);
  } catch { return []; }
};

export const getTVShowDetails = async (showId: number): Promise<TVShow> => {
  const raw = await fetchTMDB<RawTVShow>(`/tv/${showId}`, { language: 'pt-BR' });
  return normalizeTVShow(raw);
};

export const getTVSeason = async (showId: number, seasonNumber: number): Promise<TVSeason> => {
  const raw = await fetchTMDB<RawSeason & { episodes: RawEpisode[] }>(`/tv/${showId}/season/${seasonNumber}`, { language: 'pt-BR' });
  return {
    ...normalizeSeason(raw),
    episodes: (raw.episodes ?? []).map(normalizeEpisode),
  };
};

export const getMovieDetails = async (movieId: number): Promise<TMDBMovieDetail> => {
  const [movie, credits] = await Promise.all([
    fetchTMDB<RawMovie>(`/movie/${movieId}`, { language: 'pt-BR' }),
    fetchTMDB<RawCredits>(`/movie/${movieId}/credits`, { language: 'pt-BR' }),
  ]);
  const director = credits.crew.find((c) => c.job === 'Director')?.name || '';
  const writers = credits.crew
    .filter((c) => c.job === 'Writer' || c.job === 'Screenplay' || c.job === 'Story')
    .map((c) => c.name)
    .filter((v, i, a) => a.indexOf(v) === i);
  const actors = credits.cast
    .sort((a, b) => a.order - b.order)
    .slice(0, 20)
    .map((c) => ({ name: c.name, character: c.character }));
  return {
    id: movie.id,
    title: movie.title,
    release_date: movie.release_date || '',
    runtime: movie.runtime || null,
    genres: movie.genres || [],
    overview: movie.overview || '',
    poster_path: movie.poster_path,
    backdrop_path: movie.backdrop_path,
    vote_average: movie.vote_average || 0,
    vote_count: movie.vote_count || 0,
    imdb_id: movie.imdb_id || null,
    director,
    writers,
    actors,
    production_companies: (movie.production_companies || []).map((c) => c.name),
    tagline: movie.tagline || '',
    status: movie.status || '',
    budget: movie.budget || 0,
    revenue: movie.revenue || 0,
  };
};

export const getTrendingTVShows = async (page = 1): Promise<TVShow[]> => {
  try {
    const data = await fetchTMDB<RawSearchResult<RawTVShow>>(`/trending/tv/week`, { page: String(page), language: 'pt-BR' });
    return data.results.map(normalizeTVShow);
  } catch { return []; }
};

export const getTrendingMovies = async (page = 1): Promise<TMDBMovieSimple[]> => {
  try {
    const data = await fetchTMDB<RawSearchResult<RawMovie>>(`/trending/movie/week`, { page: String(page), language: 'pt-BR' });
    return data.results.slice(0, 20).map(normalizeMovieSimple);
  } catch { return []; }
};

export const getRecommendedTVShows = async (_preferredGenres: string[]): Promise<TVShow[]> => {
  return getTrendingTVShows();
};

export const getAllEpisodes = async (showId: number): Promise<TVEpisode[]> => {
  const show = await fetchTMDB<{ seasons: RawSeason[] }>(`/tv/${showId}`, { language: 'pt-BR' });
  const seasons = (show.seasons ?? []).filter((s) => s.season_number > 0);
  const episodes = await Promise.all(
    seasons.map(async (s) => {
      try {
        const seasonData = await fetchTMDB<{ episodes: RawEpisode[] }>(`/tv/${showId}/season/${s.season_number}`, { language: 'pt-BR' });
        return (seasonData.episodes ?? []).map(normalizeEpisode);
      } catch { return []; }
    })
  );
  return episodes.flat().sort((a, b) => a.season_number - b.season_number || a.episode_number - b.episode_number);
};

export const getTVVideos = async (showId: number): Promise<{ key: string; site: string }[]> => {
  try {
    const data = await fetchTMDB<{ results: RawVideo[] }>(`/tv/${showId}/videos`, { language: 'pt-BR' });
    return (data.results ?? []).filter((v) => v.site === 'YouTube').map((v) => ({ key: v.key, site: v.site }));
  } catch { return []; }
};

export const getMovieVideos = async (movieId: number): Promise<{ key: string; site: string }[]> => {
  try {
    const data = await fetchTMDB<{ results: RawVideo[] }>(`/movie/${movieId}/videos`, { language: 'pt-BR' });
    return (data.results ?? []).filter((v) => v.site === 'YouTube').map((v) => ({ key: v.key, site: v.site }));
  } catch { return []; }
};

const normalizeTVShow = (raw: RawTVShow): TVShow => ({
  id: raw.id,
  name: raw.name,
  original_name: raw.original_name,
  poster_path: raw.poster_path,
  backdrop_path: raw.backdrop_path,
  overview: raw.overview || '',
  first_air_date: raw.first_air_date || '',
  vote_average: raw.vote_average || 0,
  vote_count: raw.vote_count || 0,
  genre_ids: raw.genre_ids,
  genres: raw.genres || [],
  number_of_seasons: raw.number_of_seasons,
  number_of_episodes: raw.number_of_episodes,
  status: raw.status,
  networks: raw.networks,
  seasons: (raw.seasons ?? []).filter((s) => s.season_number > 0).map(normalizeSeason),
});

const normalizeMovieSimple = (raw: RawMovie): TMDBMovieSimple => ({
  id: raw.id,
  title: raw.title,
  release_date: raw.release_date || '',
  poster_path: raw.poster_path,
  backdrop_path: raw.backdrop_path,
  vote_average: raw.vote_average || 0,
  genre_ids: raw.genre_ids || [],
  overview: raw.overview || '',
});
