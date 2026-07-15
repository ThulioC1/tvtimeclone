import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { subscribeToUserShows, UserShow } from '../lib/firestore';
import { getTrendingShows, getPosterUrl, type TMDBShow } from '../lib/tmdb';

const StarIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-yellow-400">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const ShowCard = ({ show }: { show: TMDBShow }) => {
  const posterUrl = getPosterUrl(show.poster_path);
  return (
    <Link to={`/show/${show.id}`} className="card-hover flex-shrink-0 w-36 group">
      <div className="aspect-[2/3] rounded-xl overflow-hidden bg-dark-600 relative">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={show.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1}>
              <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
            </svg>
          </div>
        )}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-dark-900/80 rounded-full px-2 py-0.5">
          <StarIcon />
          <span className="text-[10px] text-white font-medium">
            {show.vote_average?.toFixed(1) ?? '–'}
          </span>
        </div>
      </div>
      <div className="p-2">
        <p className="text-xs font-medium text-white truncate">{show.name}</p>
        <p className="text-[10px] text-gray-500">
          {show.first_air_date ? new Date(show.first_air_date).getFullYear() : ''}
        </p>
      </div>
    </Link>
  );
};

const WatchingCard = ({ show }: { show: UserShow }) => {
  const progress = show.totalEpisodes > 0 ? (show.watchedCount / show.totalEpisodes) * 100 : 0;
  const posterUrl = getPosterUrl(show.posterPath);
  return (
    <Link to={`/show/${show.showId}`} className="card-hover flex items-center gap-4 p-4">
      <div className="w-12 h-16 rounded-lg overflow-hidden bg-dark-500 shrink-0">
        {posterUrl ? (
          <img src={posterUrl} alt={show.title} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-dark-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{show.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {show.watchedCount}/{show.totalEpisodes} episódios
        </p>
        <div className="progress-bar mt-2">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <span className="text-xs text-brand-400 font-medium shrink-0">{Math.round(progress)}%</span>
    </Link>
  );
};

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const [userShows, setUserShows] = useState<UserShow[]>([]);

  const { data: trending, isLoading: trendingLoading } = useQuery({
    queryKey: ['trending'],
    queryFn: getTrendingShows,
  });

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserShows(user.uid, setUserShows);
    return unsub;
  }, [user]);

  const watchingShows = userShows.filter((s) => s.status === 'watching');
  const tmdbApiMissing = import.meta.env.VITE_TMDB_API_KEY === 'YOUR_TMDB_API_KEY_HERE' ||
    !import.meta.env.VITE_TMDB_API_KEY;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Olá, <span className="gradient-text">{user?.displayName?.split(' ')[0] || 'Usuário'}</span> 👋
        </h1>
        <p className="text-gray-400 mt-1">Veja o que está rolando no momento</p>
      </div>

      {/* TMDB warning */}
      {tmdbApiMissing && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 mb-6">
          <p className="text-yellow-400 text-sm font-medium">⚠️ Chave da API TMDB não configurada</p>
          <p className="text-yellow-400/70 text-xs mt-1">
            Adicione sua chave em <code className="bg-dark-600 px-1 rounded">.env.local</code> →{' '}
            <code className="bg-dark-600 px-1 rounded">VITE_TMDB_API_KEY</code>
          </p>
        </div>
      )}

      {/* Currently Watching */}
      {watchingShows.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Assistindo agora</h2>
            <Link to="/watchlist" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
              Ver tudo →
            </Link>
          </div>
          <div className="space-y-2">
            {watchingShows.slice(0, 5).map((show) => (
              <WatchingCard key={show.showId} show={show} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {watchingShows.length === 0 && (
        <div className="card p-8 text-center mb-8">
          <div className="text-5xl mb-3">📺</div>
          <p className="text-white font-semibold mb-1">Sua lista está vazia</p>
          <p className="text-gray-400 text-sm mb-4">Busque séries e adicione à sua lista para começar!</p>
          <Link to="/search" className="btn-primary inline-flex">
            Descobrir séries
          </Link>
        </div>
      )}

      {/* Trending */}
      {!tmdbApiMissing && (
        <section>
          <h2 className="section-title mb-4">Em alta esta semana</h2>
          {trendingLoading ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="w-36 flex-shrink-0 rounded-xl overflow-hidden animate-pulse">
                  <div className="aspect-[2/3] bg-dark-600" />
                  <div className="p-2 space-y-1">
                    <div className="h-3 bg-dark-500 rounded w-3/4" />
                    <div className="h-2 bg-dark-600 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {trending?.results.slice(0, 10).map((show: TMDBShow) => (
                <ShowCard key={show.id} show={show} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default HomePage;
