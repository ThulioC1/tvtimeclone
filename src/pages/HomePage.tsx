import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToUserShows,
  subscribeToWatchedEpisodes,
  getEpisodeId,
  UserShow,
} from '../lib/firestore';
import {
  getTrendingShows,
  getPosterUrl,
  getAllEpisodesSorted,
  type TVShow,
  type TVEpisode,
} from '../lib/tvmaze';

const StarIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-yellow-400">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

interface UpNextItem {
  show: UserShow;
  episode: TVEpisode;
}

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

const UpNextRow = ({ item }: { item: UpNextItem }) => {
  const posterUrl = getPosterUrl(item.show.posterPath);
  const ep = item.episode;
  return (
    <Link to={`/show/${item.show.showId}`} className="card-hover flex items-center gap-3 p-3">
      <div className="w-10 h-14 rounded-lg overflow-hidden bg-dark-500 shrink-0">
        {posterUrl ? (
          <img src={posterUrl} alt={item.show.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-dark-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{item.show.title}</p>
        <p className="text-xs text-gray-400 truncate">
          T{ep.season_number} · E{ep.episode_number} — {ep.name}
        </p>
      </div>
      <span className="text-xs text-brand-400 font-medium shrink-0">Assistir →</span>
    </Link>
  );
};

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const [userShows, setUserShows] = useState<UserShow[]>([]);
  const [upNext, setUpNext] = useState<UpNextItem[]>([]);
  const [loadingUpNext, setLoadingUpNext] = useState(true);

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

  const loadUpNext = useCallback(async () => {
    if (!user) return;
    setLoadingUpNext(true);
    const items: UpNextItem[] = [];
    for (const show of watchingShows) {
      try {
        const watched = await new Promise<Set<string>>((resolve) => {
          const unsub = subscribeToWatchedEpisodes(user.uid, show.showId, (ids) => {
            resolve(ids);
            unsub();
          });
        });
        const all = await getAllEpisodesSorted(show.showId);
        const next = all.find((e) => !watched.has(getEpisodeId(e.season_number, e.episode_number)));
        if (next) items.push({ show, episode: next });
      } catch {
        // ignore
      }
    }
    setUpNext(items);
    setLoadingUpNext(false);
  }, [user, watchingShows]);

  useEffect(() => {
    loadUpNext();
  }, [loadUpNext]);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-28 md:pb-0">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Olá, <span className="gradient-text">{user?.displayName?.split(' ')[0] || 'Usuário'}</span> 👋
        </h1>
        <p className="text-gray-400 mt-1">Veja o que está rolando no momento</p>
      </div>

      {/* Up Next (destaque estilo TV Time) */}
      {watchingShows.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Up Next</h2>
            <Link to="/watchlist" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
              Ver tudo →
            </Link>
          </div>
          {loadingUpNext ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="card p-3 flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-14 rounded-lg bg-dark-600" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-dark-500 rounded w-1/2" />
                    <div className="h-2 bg-dark-600 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : upNext.length > 0 ? (
            <div className="space-y-2">
              {upNext.slice(0, 6).map((item) => (
                <UpNextRow key={`${item.show.showId}-${item.episode.season_number}-${item.episode.episode_number}`} item={item} />
              ))}
            </div>
          ) : (
            <div className="card p-5 text-center">
              <p className="text-white font-semibold">Tudo em dia! 🎉</p>
              <p className="text-gray-400 text-sm mt-1">Você está sem episódios pendentes.</p>
            </div>
          )}
        </section>
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
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-purple-500/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-brand-400" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
            </svg>
          </div>
          <p className="text-white font-semibold mb-1">Sua lista está vazia</p>
          <p className="text-gray-400 text-sm mb-4">Busque séries e adicione à sua lista para começar!</p>
          <Link to="/search" className="btn-primary inline-flex">
            Descobrir séries
          </Link>
        </div>
      )}

      {/* Trending */}
      <section>
        <h2 className="section-title mb-4">Em alta esta semana</h2>
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
