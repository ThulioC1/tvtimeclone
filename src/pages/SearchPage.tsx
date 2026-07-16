import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { searchShows, getShowDetails, getPosterUrl, type TVShow } from '../lib/tvmaze';
import { addShowToWatchlist, getUserShows } from '../lib/firestore';

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

const SearchPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [addingId, setAddingId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 350);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchShows(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 2,
  });

  // Load already-added shows
  useEffect(() => {
    if (!user) return;
    getUserShows(user.uid)
      .then((shows) => {
        setAddedIds(new Set(shows.map((s) => s.showId)));
      })
      .catch((err) => console.error('Erro ao carregar séries adicionadas:', err));
  }, [user]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleAdd = async (show: TVShow) => {
    if (!user || addedIds.has(show.id)) return;
    setAddingId(show.id);
    try {
      // Fetch full details (with seasons) so totalEpisodes/totalSeasons are accurate.
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

  const results = data?.results ?? [];
  const showResults = debouncedQuery.trim().length >= 2;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto pb-28 md:pb-0">
      <h1 className="page-title mb-6">Buscar Séries</h1>

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
          placeholder="Ex: Breaking Bad, Game of Thrones..."
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
      {(isLoading || isFetching) && showResults && (
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

      {/* Results */}
      {!isLoading && showResults && results.length > 0 && (
        <div className="space-y-3 animation-fade-in">
          <p className="text-muted mb-3">{data?.total_results ?? 0} resultados para "{debouncedQuery}"</p>
          {results.map((show) => {
            const posterUrl = getPosterUrl(show.poster_path, 'w185');
            const isAdded = addedIds.has(show.id);
            const isAdding = addingId === show.id;
            return (
              <div key={show.id} className="card p-4 flex gap-4 hover:border-dark-300 transition-colors">
                <Link to={`/show/${show.id}`} className="shrink-0">
                  <div className="w-16 h-24 rounded-xl overflow-hidden bg-dark-500">
                    {posterUrl ? (
                      <img src={posterUrl} alt={show.name} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-dark-300">
                        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5}>
                          <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                        </svg>
                      </div>
                    )}
                  </div>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/show/${show.id}`}>
                    <h3 className="font-semibold text-white hover:text-brand-400 transition-colors truncate">
                      {show.name}
                    </h3>
                  </Link>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    {show.first_air_date && (
                      <span>{new Date(show.first_air_date).getFullYear()}</span>
                    )}
                    {show.vote_average > 0 && (
                      <span className="flex items-center gap-1">
                        <StarIcon /> {show.vote_average.toFixed(1)}
                      </span>
                    )}
                  </div>
                  {show.overview && (
                    <p className="text-xs text-gray-400 mt-2 line-clamp-2">{show.overview}</p>
                  )}
                </div>
                <div className="shrink-0 flex items-start pt-1">
                  <button
                    onClick={() => handleAdd(show)}
                    disabled={isAdded || isAdding}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl transition-all duration-200 ${
                      isAdded
                        ? 'bg-green-500/15 text-green-400 border border-green-500/30 cursor-default'
                        : 'bg-brand-600/20 text-brand-400 border border-brand-600/30 hover:bg-brand-600 hover:text-white active:scale-95'
                    }`}
                  >
                    {isAdding ? (
                      <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    ) : isAdded ? (
                      <CheckIcon />
                    ) : (
                      <PlusIcon />
                    )}
                    {isAdded ? 'Adicionado' : 'Adicionar'}
                  </button>
                </div>
              </div>
            );
          })}
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
          <div className="text-5xl mb-3">🎬</div>
          <p className="text-white font-semibold">Descubra novas séries</p>
          <p className="text-gray-400 text-sm mt-1">Digite ao menos 2 caracteres para buscar</p>
        </div>
      )}
    </div>
  );
};

export default SearchPage;
