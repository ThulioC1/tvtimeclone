import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { subscribeToUserShows, type UserShow } from '../lib/firestore';
import { getTrendingShows, getPosterUrl, type TVShow } from '../lib/tvmaze';

const StarIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-yellow-400">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const ShowCard = ({ show }: { show: TVShow }) => {
  const posterUrl = getPosterUrl(show.poster_path);
  return (
    <Link to={`/show/${show.id}`} className="card-hover group block">
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

const ListShowRow = ({ show }: { show: UserShow }) => {
  const posterUrl = getPosterUrl(show.posterPath);
  const progress = show.totalEpisodes > 0 ? (show.watchedCount / show.totalEpisodes) * 100 : 0;
  return (
    <Link to={`/show/${show.showId}`} className="card-hover flex items-center gap-3 p-3">
      <div className="w-10 h-14 rounded-lg overflow-hidden bg-dark-500 shrink-0">
        {posterUrl ? (
          <img src={posterUrl} alt={show.title} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-dark-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{show.title}</p>
        <p className="text-xs text-gray-400 truncate">
          {show.watchedCount}/{show.totalEpisodes} eps
        </p>
      </div>
      <div className="w-16 shrink-0">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </Link>
  );
};

const StatCard = ({ value, label }: { value: number | string; label: string }) => (
  <div className="card p-4 text-center">
    <p className="text-2xl font-extrabold gradient-text">{value}</p>
    <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{label}</p>
  </div>
);

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

  const lists = userShows.filter((s) => s.status !== 'plan_to_watch');
  const favorites = userShows.filter((s) => s.status === 'plan_to_watch');
  const totalWatched = userShows.reduce((sum, s) => sum + s.watchedCount, 0);
  const totalMinutes = (user as any)?.totalWatchMinutes ?? 0;
  const totalHours = Math.floor(totalMinutes / 60);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-28 md:pb-0">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Olá, <span className="gradient-text">{user?.displayName?.split(' ')[0] || 'Usuário'}</span> 👋
        </h1>
        <p className="text-gray-400 mt-1">Acompanhe suas séries e descubra novidades</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        <StatCard value={userShows.length} label="Na lista" />
        <StatCard value={totalWatched} label="Ep. assistidos" />
        <StatCard value={`${totalHours}h`} label="Assistidas" />
        <StatCard value={userShows.filter((s) => s.status === 'completed').length} label="Concluídas" />
      </div>

      {/* Lists */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Minhas Listas</h2>
          <Link to="/watchlist" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
            Ver tudo →
          </Link>
        </div>
        {lists.length > 0 ? (
          <div className="space-y-2">
            {lists.slice(0, 6).map((show) => (
              <ListShowRow key={show.showId} show={show} />
            ))}
          </div>
        ) : (
          <div className="card p-6 text-center">
            <p className="text-gray-400 text-sm">Você ainda não adicionou séries à sua lista.</p>
            <Link to="/search" className="btn-primary inline-flex mt-3 text-sm">
              Buscar séries
            </Link>
          </div>
        )}
      </section>

      {/* Favorites */}
      {favorites.length > 0 && (
        <section className="mb-8">
          <h2 className="section-title mb-4">Favoritas</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {favorites.map((show) => (
              <Link key={show.showId} to={`/show/${show.showId}`} className="card-hover group block">
                <div className="aspect-[2/3] rounded-xl overflow-hidden bg-dark-600">
                  {getPosterUrl(show.posterPath) ? (
                    <img src={getPosterUrl(show.posterPath)!} alt={show.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full bg-dark-500" />
                  )}
                </div>
                <p className="text-xs font-medium text-white truncate p-2">{show.title}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recommended */}
      <section>
        <h2 className="section-title mb-4">Recomendadas para você</h2>
        {trendingLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden animate-pulse">
                <div className="aspect-[2/3] bg-dark-600" />
                <div className="p-2 space-y-1">
                  <div className="h-3 bg-dark-500 rounded w-3/4" />
                  <div className="h-2 bg-dark-600 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {trending?.results.slice(0, 10).map((show: TVShow) => (
              <ShowCard key={show.id} show={show} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default HomePage;
