import axios from 'axios';

const BASE_URL = 'https://api.themoviedb.org/3';
const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
export const getPosterUrl = (path: string | null, size = 'w342') =>
  path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null;
export const getBackdropUrl = (path: string | null, size = 'w1280') =>
  path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null;

const tmdb = axios.create({
  baseURL: BASE_URL,
  params: { api_key: API_KEY, language: 'pt-BR' },
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TMDBShow {
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
  networks?: { id: number; name: string; logo_path: string }[];
  seasons?: TMDBSeason[];
}

export interface TMDBSeason {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  poster_path: string | null;
  air_date: string | null;
  overview: string;
  episodes?: TMDBEpisode[];
}

export interface TMDBEpisode {
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

export interface TMDBSearchResult {
  results: TMDBShow[];
  total_results: number;
  total_pages: number;
  page: number;
}

// ── API Functions ─────────────────────────────────────────────────────────────

export const searchShows = async (query: string, page = 1): Promise<TMDBSearchResult> => {
  const { data } = await tmdb.get('/search/tv', { params: { query, page } });
  return data;
};

export const searchMulti = async (query: string): Promise<{ results: TMDBShow[] }> => {
  const { data } = await tmdb.get('/search/multi', { params: { query } });
  // Filter only TV shows
  return { ...data, results: data.results.filter((r: any) => r.media_type === 'tv') };
};

export const getShowDetails = async (showId: number): Promise<TMDBShow> => {
  const { data } = await tmdb.get(`/tv/${showId}`, {
    params: { append_to_response: 'seasons' },
  });
  return data;
};

export const getSeasonDetails = async (showId: number, seasonNumber: number): Promise<TMDBSeason> => {
  const { data } = await tmdb.get(`/tv/${showId}/season/${seasonNumber}`);
  return data;
};

export const getTrendingShows = async (): Promise<TMDBSearchResult> => {
  const { data } = await tmdb.get('/trending/tv/week');
  return data;
};

export const getPopularShows = async (): Promise<TMDBSearchResult> => {
  const { data } = await tmdb.get('/tv/popular');
  return data;
};

export const getEpisodeDetails = async (
  showId: number,
  seasonNumber: number,
  episodeNumber: number
): Promise<TMDBEpisode> => {
  const { data } = await tmdb.get(`/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}`);
  return data;
};
