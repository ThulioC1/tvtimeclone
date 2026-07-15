const BASE_URL = 'https://api.tvmaze.com';

const stripHtml = (html: string): string =>
  html.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, '').trim();

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`TVMaze request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

// ── Raw TVMaze shapes ─────────────────────────────────────────────────────────

interface RawImage {
  medium: string;
  original: string;
}

interface RawSeason {
  id: number;
  number: number;
  name: string;
  episodeOrder: number | null;
  premiereDate: string | null;
  endDate: string | null;
  image: RawImage | null;
  summary: string | null;
}

interface RawEpisode {
  id: number;
  name: string;
  season: number;
  number: number;
  airdate: string;
  airtime: string;
  runtime: number | null;
  rating: { average: number | null };
  image: RawImage | null;
  summary: string | null;
}

interface RawShow {
  id: number;
  name: string;
  premiered: string | undefined;
  ended: string | undefined;
  status: string;
  rating: { average: number | null };
  genres: string[];
  image: RawImage | null;
  summary: string | undefined;
  _embedded?: { seasons?: RawSeason[] };
}

// ── Normalized shapes (compatible with app usage) ──────────────────────────────

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

export interface TVSearchResult {
  results: TVShow[];
  total_results: number;
  total_pages: number;
  page: number;
}

// ── Normalizers ────────────────────────────────────────────────────────────────

const normalizeSeason = (s: RawSeason): TVSeason => ({
  id: s.id,
  season_number: s.number,
  name: s.name,
  episode_count: s.episodeOrder ?? 0,
  poster_path: s.image?.medium ?? null,
  air_date: s.premiereDate ?? null,
  overview: stripHtml(s.summary ?? ''),
});

const normalizeEpisode = (e: RawEpisode): TVEpisode => ({
  id: e.id,
  episode_number: e.number,
  season_number: e.season,
  name: e.name,
  overview: stripHtml(e.summary ?? ''),
  still_path: e.image?.medium ?? null,
  air_date: e.airdate || null,
  runtime: e.runtime ?? null,
  vote_average: e.rating?.average ?? 0,
});

const normalizeShow = (raw: RawShow): TVShow => {
  const seasons = (raw._embedded?.seasons ?? [])
    .filter((s) => s.number > 0)
    .map(normalizeSeason);
  return {
    id: raw.id,
    name: raw.name,
    original_name: raw.name,
    poster_path: raw.image?.medium ?? null,
    backdrop_path: raw.image?.original ?? null,
    overview: stripHtml(raw.summary ?? ''),
    first_air_date: raw.premiered ?? '',
    vote_average: raw.rating?.average ?? 0,
    vote_count: 0,
    genres: (raw.genres ?? []).map((g, i) => ({ id: i, name: g })),
    number_of_seasons: seasons.length,
    number_of_episodes: seasons.reduce((sum, s) => sum + s.episode_count, 0),
    status: raw.status,
    networks: [],
    seasons,
  };
};

// ── Image helpers ──────────────────────────────────────────────────────────────
// TVMaze already returns absolute image URLs, so these just pass them through.

export const getPosterUrl = (path: string | null, _size?: string): string | null =>
  path ?? null;

export const getBackdropUrl = (path: string | null, _size?: string): string | null =>
  path ?? null;

// ── API functions ──────────────────────────────────────────────────────────────

export const searchShows = async (
  query: string,
  page = 1
): Promise<TVSearchResult> => {
  const data = await fetchJson<{ score: number; show: RawShow }[]>(
    `/search/shows?q=${encodeURIComponent(query)}`
  );
  const results = data.map((d) => normalizeShow(d.show));
  return { results, total_results: results.length, total_pages: 1, page };
};

export const getShowDetails = async (showId: number): Promise<TVShow> => {
  const raw = await fetchJson<RawShow & { _embedded?: { seasons?: RawSeason[] } }>(
    `/shows/${showId}?embed=seasons`
  );
  return normalizeShow(raw);
};

export const getSeasonDetails = async (
  showId: number,
  seasonNumber: number
): Promise<TVSeason> => {
  const episodes = await fetchJson<RawEpisode[]>(`/shows/${showId}/episodes`);
  const seasonEpisodes = episodes
    .filter((e) => e.season === seasonNumber)
    .sort((a, b) => a.number - b.number)
    .map(normalizeEpisode);
  return {
    id: 0,
    season_number: seasonNumber,
    name: `Temporada ${seasonNumber}`,
    episode_count: seasonEpisodes.length,
    poster_path: null,
    air_date: null,
    overview: '',
    episodes: seasonEpisodes,
  };
};

export const getTrendingShows = async (): Promise<TVSearchResult> => {
  const data = await fetchJson<RawShow[]>(`/shows?page=0`);
  const results = data.map(normalizeShow);
  return { results, total_results: results.length, total_pages: 1, page: 1 };
};

export const getPopularShows = async (): Promise<TVSearchResult> => {
  return getTrendingShows();
};
