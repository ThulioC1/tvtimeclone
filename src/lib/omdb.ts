const BASE_URL = 'https://www.omdbapi.com';
const API_KEY = import.meta.env.VITE_OMDB_API_KEY || 'e03b856b';

export interface MovieDetails {
  Title: string;
  Year: string;
  Rated: string;
  Released: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Writer: string;
  Actors: string;
  Plot: string;
  Language: string;
  Country: string;
  Awards: string;
  Poster: string;
  Ratings: { Source: string; Value: string }[];
  Metascore: string;
  imdbRating: string;
  imdbVotes: string;
  imdbID: string;
  Type: string;
  DVD: string;
  BoxOffice: string;
  Production: string;
  Website: string;
}

interface SearchItem {
  Title: string;
  Year: string;
  imdbID: string;
  Type: string;
  Poster: string;
}

interface SearchResponse {
  Search: SearchItem[];
  totalResults: string;
  Response: string;
}

const fetchJson = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OMDb request failed (${res.status})`);
  return res.json() as Promise<T>;
};

export const searchMovies = async (query: string): Promise<MovieDetails[]> => {
  if (!query.trim()) return [];
  try {
    const data = await fetchJson<SearchResponse>(
      `${BASE_URL}?s=${encodeURIComponent(query)}&type=movie&apikey=${API_KEY}`
    );
    if (data.Response === 'False' || !data.Search) return [];
    const results = await Promise.allSettled(
      data.Search.map((item) => getMovieDetails(item.imdbID))
    );
    return results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<MovieDetails>).value);
  } catch {
    return [];
  }
};

export const getMovieDetails = async (imdbId: string): Promise<MovieDetails> => {
  const data = await fetchJson<MovieDetails>(
    `${BASE_URL}?i=${imdbId}&plot=full&apikey=${API_KEY}`
  );
  if ((data as any).Error) throw new Error((data as any).Error);
  return data;
};
