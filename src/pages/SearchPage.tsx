import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { searchShows, getShowDetails, getPosterUrl, type TVShow } from '../lib/tvmaze';
import { searchMovies, type MovieDetails } from '../lib/omdb';
import { addShowToWatchlist, addMovieToWatchlist, getUserShows } from '../lib/firestore';

const useDebounce = (value: string, delay: number) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

const StarIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-yellow-400">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

type SearchMode = 'series' | 'movies';

const SearchPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('series');
  const [addedIds, setAddedIds] = useState<Set<string | number>>(new Set());
  const [addingId, setAddingId] = useState<string | number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 350);

  const seriesQuery = useQuery({
    queryKey: ['search', 'series', debouncedQuery],
    queryFn: () => searchShows(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 2 && mode === 'series',
  });

  const moviesQuery = useQuery({
    queryKey: ['search', 'movies', debouncedQuery],
    queryFn: () => searchMovies(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 2 && mode === 'movies',
  });

  const isLoading = mode === 'series' ? seriesQuery.isLoading || seriesQuery.isFetching : moviesQuery.isLoading || moviesQuery.isFetching;
  const data = mode === 'series' ? seriesQuery.data : moviesQuery.data;
  const results = mode === 'series'
    ? (data as TVShow[] | undefined) ?? []
    : (data as MovieDetails[] | undefined) ?? [];

  useEffect(() => {
    if (!user) return;
    getUserShows(user.uid)
      .then((shows) => {
        setAddedIds(new Set(shows.map((s) => s.showId)));
      })
      .catch((err) => console.error('Erro ao carregar itens adicionados:', err));
  }, [user]);

  useEffect(() => { inputRef.current?.focus(); }, [mode]);

  const handleAddShow = async (show: TVShow) => {
    if (!user || addedIds.has(show.id)) return;
    setAddingId(show.id);
    try {
      const details = await getShowDetails(show.id);
      const showToAdd = details.seasons && details.seasons.length > 0 ? details : show;
      await addShowToWatchlist(user.uid, showToAdd, 'watching');
      setAddedIds((prev) => new Set([...prev, show.id]));
      navigate(`/show/${show.id}`);
    } catch (err) {
      console.error('Erro ao adicionar série:', err);
    } finally {
      setAddingId(null);
    }
  };

  const handleAddMovie = async (movie: MovieDetails) => {
    if (!user || addedIds.has(movie.imdbID)) return;
    setAddingId(movie.imdbID);
    try {
      await addMovieToWatchlist(user.uid, movie);
      setAddedIds((prev) => new Set([...prev, movie.imdbID]));
      navigate(`/movie/${movie.imdbID}`);
    } catch (err) {
      console.error('Erro ao adicionar filme:', err);
    } finally {
      setAddingId(null);
    }
  };

  const showResults = debouncedQuery.trim().length >= 2;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto pb-28 md:pb-0">
      <h1 className="page-title mb-6">Buscar</h1>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('series')}
          className={`text-sm font-medium px-5 py-2 rounded-xl transition-all duration-200 ${
            mode === 'series'
              ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/30'
              : 'bg-dark-700 text-gray-400 hover:text-white hover:bg-dark-600'
          }`}
        >
          Séries
        </button>
        <button
          onClick={() => setMode('movies')}
          className={`text-sm font-medium px-5 py-2 rounded-xl transition-all duration-200 ${
            mode === 'movies'
              ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/30'
              : 'bg-dark-700 text-gray-400 hover:text-white hover:bg-dark-600'
          }`}
        >
          Filmes
        </button>
      </div>

      {/* Search input */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={mode === 'series' ? 'Ex: Breaking Bad, Game of Thrones...' : 'Ex: Inception, Matrix...'}
          className="input-field pl-12 pr-4 text-base"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute inset-y-0 right-4 flex items-center text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && showResults && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-4 flex gap-4 animate-pulse">
              <div className="w-16 h-24 bg-dark-500 rounded-xl" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 bg-dark-500 rounded w-3/4" />
                <div className="h-3 bg-dark-600 rounded w-1/2" />
                <div className="h-3 bg-dark-600 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results - Series */}
      {!isLoading && showResults && mode === 'series' && (results as TVShow[]).length > 0 && (
        <div className="animation-fade-in">
          <p className="text-muted mb-3">{results.length} resultados para "{debouncedQuery}"</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {(results as TVShow[]).map((show) => {
              const posterUrl = getPosterUrl(show.poster_path, 'w185');
              const isAdded = addedIds.has(show.id);
              const isAdding = addingId === show.id;
              return (
                <div key={show.id} className="card-hover group relative block">
                  <Link to={`/show/${show.id}`} className="block">
                    <div className="aspect-[2/3] rounded-xl overflow-hidden bg-dark-600 relative">
                      {posterUrl ? (
                        <img src={posterUrl} alt={show.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-dark-300">
                          <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5}>
                            <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                          </svg>
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-dark-900/80 rounded-full px-2 py-0.5">
                        <StarIcon />
                        <span className="text-[10px] text-white font-medium">{show.vote_average?.toFixed(1) ?? '–'}</span>
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-white truncate">{show.name}</p>
                      <p className="text-[10px] text-gray-500">
                        {show.first_air_date ? new Date(show.first_air_date).getFullYear() : ''}
                      </p>
                    </div>
                  </Link>
                  <button
                    onClick={() => handleAddShow(show)}
                    disabled={isAdded || isAdding}
                    className={`absolute top-2 right-2 flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 ${
                      isAdded
                        ? 'bg-green-500/90 text-white cursor-default'
                        : 'bg-brand-600/90 hover:bg-brand-500 text-white active:scale-95'
                    }`}
                    title={isAdded ? 'Adicionado' : 'Adicionar à lista'}
                  >
                    {isAdding ? (
                      <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : isAdded ? (
                      <CheckIcon />
                    ) : (
                      <PlusIcon />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results - Movies */}
      {!isLoading && showResults && mode === 'movies' && (results as MovieDetails[]).length > 0 && (
        <div className="animation-fade-in">
          <p className="text-muted mb-3">{results.length} resultados para "{debouncedQuery}"</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {(results as MovieDetails[]).map((movie) => {
              const posterUrl = movie.Poster !== 'N/A' ? movie.Poster : null;
              const isAdded = addedIds.has(movie.imdbID);
              const isAdding = addingId === movie.imdbID;
              return (
                <div key={movie.imdbID} className="card-hover group relative block">
                  <Link to={`/movie/${movie.imdbID}`} className="block">
                    <div className="aspect-[2/3] rounded-xl overflow-hidden bg-dark-600 relative">
                      {posterUrl ? (
                        <img
                          src={posterUrl}
                          alt={movie.Title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.querySelector('.fallback')?.classList.remove('hidden'); }}
                        />
                      ) : null}
                      <div className={`fallback ${posterUrl ? 'hidden' : ''} absolute inset-0 flex items-center justify-center text-dark-300 bg-dark-600`}>
                        <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5}>
                          <rect x="2" y="3" width="20" height="14" rx="2" />
                        </svg>
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-white truncate">{movie.Title}</p>
                      <p className="text-[10px] text-gray-500">
                        {movie.Year !== 'N/A' ? movie.Year : ''}
                      </p>
                    </div>
                  </Link>
                  <button
                    onClick={() => handleAddMovie(movie)}
                    disabled={isAdded || isAdding}
                    className={`absolute top-2 right-2 flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 ${
                      isAdded
                        ? 'bg-green-500/90 text-white cursor-default'
                        : 'bg-brand-600/90 hover:bg-brand-500 text-white active:scale-95'
                    }`}
                    title={isAdded ? 'Adicionado' : 'Adicionar à lista'}
                  >
                    {isAdding ? (
                      <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : isAdded ? (
                      <CheckIcon />
                    ) : (
                      <PlusIcon />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No results */}
      {!isLoading && showResults && results.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">🔍</div>
          <p className="text-white font-semibold">Nenhum resultado encontrado</p>
          <p className="text-gray-400 text-sm mt-1">Tente buscar por outro nome</p>
        </div>
      )}

      {/* Initial state */}
      {!showResults && (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">{mode === 'series' ? '🎬' : '🎥'}</div>
          <p className="text-white font-semibold">{mode === 'series' ? 'Descubra novas séries' : 'Descubra novos filmes'}</p>
          <p className="text-gray-400 text-sm mt-1">Digite ao menos 2 caracteres para buscar</p>
        </div>
      )}
    </div>
  );
};

export default SearchPage;
