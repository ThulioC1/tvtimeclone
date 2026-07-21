import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToUserShows,
  removeShowFromWatchlist,
  markEpisodeWatched,
  subscribeToWatchedEpisodes,
  getEpisodeId,
  type UserShow,
  type ShowStatus,
} from '../lib/firestore';
import { getPosterUrl, getAllEpisodes as tmdbGetAllEpisodes, type TVEpisode } from '../lib/tmdb';
import { getAllEpisodesSorted as tvmazeGetAllEpisodes } from '../lib/tvmaze';

const STATUS_LABELS: Record<ShowStatus, string> = {
  watching: 'Assistindo',
  completed: 'Concluído',
  dropped: 'Abandonado',
  plan_to_watch: 'Quero assistir',
};

const MOVIE_STATUS_LABELS: Record<ShowStatus, string> = {
  watching: 'Assistindo',
  completed: 'Concluído',
  dropped: 'Abandonado',
  plan_to_watch: 'Quero assistir',
};

const STATUS_SOLID: Record<ShowStatus, string> = {
  watching: 'bg-brand-600 text-white',
  completed: 'bg-green-600 text-white',
  dropped: 'bg-red-600 text-white',
  plan_to_watch: 'bg-yellow-500 text-dark-900',
};

type StatusFilter = 'all' | ShowStatus | 'up_to_date';

const SERIES_FILTER_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'watching', label: 'Assistindo' },
  { key: 'up_to_date', label: 'Em dia' },
  { key: 'completed', label: 'Concluído' },
  { key: 'dropped', label: 'Abandonado' },
  { key: 'plan_to_watch', label: 'Quero assistir' },
];

const MOVIE_FILTER_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'up_to_date', label: 'Assistido' },
  { key: 'watching', label: 'Assistindo' },
  { key: 'completed', label: 'Concluído' },
  { key: 'dropped', label: 'Abandonado' },
  { key: 'plan_to_watch', label: 'Quero assistir' },
];

const isUpToDate = (show: UserShow): boolean =>
  show.status === 'watching' && show.watchedCount > 0 && show.watchedCount >= show.totalEpisodes;

interface UpNextItem {
  show: UserShow;
  episode: TVEpisode;
}

const ShowCard = ({
  show,
  onRemove,
}: {
  show: UserShow;
  onRemove: () => void;
}) => {
  const posterUrl = getPosterUrl(show.posterPath, 'w342');
  const displayLabel = isUpToDate(show) ? 'Em dia' : STATUS_LABELS[show.status];
  const displayStyle = isUpToDate(show)
    ? 'bg-teal-600 text-white'
    : STATUS_SOLID[show.status];

  return (
    <div className="card overflow-hidden group hover:border-brand-500/40 transition-colors active-show-glow relative">
      <Link to={`/show/${show.showId}`} className="block relative">
        <div className="aspect-[2/3] w-full bg-dark-500 overflow-hidden">
          {posterUrl ? (
            <img src={posterUrl} alt={show.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full bg-dark-500" />
          )}
        </div>

        {/* Status banner at the bottom of the poster (solid color) */}
        <div className={`absolute inset-x-0 bottom-0 px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide ${displayStyle}`}>
          {displayLabel}
        </div>
      </Link>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/show/${show.showId}`}>
            <h3 className="font-semibold text-white hover:text-brand-400 transition-colors truncate text-sm">
              {show.title}
            </h3>
          </Link>
          <button
            onClick={onRemove}
            className="text-gray-600 hover:text-red-400 transition-colors shrink-0 text-lg leading-none"
            title="Remover da lista"
          >
            ×
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {show.watchedCount}/{show.totalEpisodes} ep.
        </p>
      </div>
    </div>
  );
};

const MovieCard = ({
  show,
  onRemove,
}: {
  show: UserShow;
  onRemove: () => void;
}) => {
  const posterUrl = getPosterUrl(show.posterPath, 'w342');
  const isWatched = show.watchedCount > 0 && show.watchedCount >= show.totalEpisodes;
  const displayLabel = isWatched && show.status === 'watching' ? 'Assistido' : MOVIE_STATUS_LABELS[show.status];
  const displayStyle = isWatched && show.status === 'watching'
    ? 'bg-teal-600 text-white'
    : STATUS_SOLID[show.status];

  return (
    <div className="card overflow-hidden group hover:border-brand-500/40 transition-colors active-show-glow relative">
      <Link to={`/movie/${show.showId}`} className="block relative">
        <div className="aspect-[2/3] w-full bg-dark-500 overflow-hidden">
          {posterUrl ? (
            <img src={posterUrl} alt={show.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full bg-dark-500" />
          )}
        </div>

        <div className={`absolute inset-x-0 bottom-0 px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide ${displayStyle}`}>
          {displayLabel}
        </div>
      </Link>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/movie/${show.showId}`}>
            <h3 className="font-semibold text-white hover:text-brand-400 transition-colors truncate text-sm">
              {show.title}
            </h3>
          </Link>
          <button
            onClick={onRemove}
            className="text-gray-600 hover:text-red-400 transition-colors shrink-0 text-lg leading-none"
            title="Remover da lista"
          >
            ×
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {isWatched ? 'Assistido' : 'Não assistido'}
        </p>
      </div>
    </div>
  );
};

const UpNextCard = ({
  item,
  onMarkWatched,
  marking,
}: {
  item: UpNextItem;
  onMarkWatched: (item: UpNextItem) => void;
  marking: boolean;
}) => {
  const posterUrl = getPosterUrl(item.show.posterPath, 'w185');
  const ep = item.episode;
  return (
    <div className="card p-4 flex gap-4 hover:border-brand-500/40 transition-colors">
      <Link to={`/show/${item.show.showId}`} className="shrink-0">
        <div className="w-14 h-20 rounded-xl overflow-hidden bg-dark-500">
          {posterUrl ? (
            <img src={posterUrl} alt={item.show.title} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-dark-500" />
          )}
        </div>
      </Link>
      <div className="flex-1 min-w-0">
        <Link to={`/show/${item.show.showId}`} className="hover:text-brand-400 transition-colors">
          <h3 className="font-semibold text-white truncate text-sm">{item.show.title}</h3>
        </Link>
        <p className="text-xs text-gray-400 mt-0.5 truncate">
          T{ep.season_number} · E{ep.episode_number} — {ep.name}
        </p>
        <button
          onClick={() => onMarkWatched(item)}
          disabled={marking}
          className="btn-primary text-xs py-1.5 px-3 mt-2 disabled:opacity-50"
        >
          {marking ? 'Marcando...' : 'Marquei como assistido'}
        </button>
      </div>
    </div>
  );
};

const WatchlistPage: React.FC = () => {
  const { user } = useAuth();
  const [shows, setShows] = useState<UserShow[]>([]);
  const [mainTab, setMainTab] = useState<'upnext' | 'series' | 'movies'>('upnext');
  const [upNext, setUpNext] = useState<UpNextItem[]>([]);
  const [recentlyWatched, setRecentlyWatched] = useState<UpNextItem[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [loadingUpNext, setLoadingUpNext] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserShows(user.uid, setShows);
    return unsub;
  }, [user]);

  const loadUpNext = useCallback(async () => {
    if (!user) return;
    setLoadingUpNext(true);
    const watching = shows.filter((s) => s.status === 'watching' && s.mediaType !== 'movie');
    const items: UpNextItem[] = [];
    for (const show of watching) {
      try {
        const watched = await new Promise<Set<string>>((resolve) => {
          const unsub = subscribeToWatchedEpisodes(user.uid, Number(show.showId), (ids) => {
            resolve(ids);
            unsub();
          });
        });
        const all = show.source === 'tmdb'
          ? await tmdbGetAllEpisodes(Number(show.showId)).catch(() => tvmazeGetAllEpisodes(Number(show.showId)))
          : await tvmazeGetAllEpisodes(Number(show.showId));
        const next = all.find((e) => !watched.has(getEpisodeId(e.season_number, e.episode_number)));
        if (next) items.push({ show, episode: next });
      } catch {
        // ignore series that fail to load
      }
    }
    setUpNext(items);
    setLoadingUpNext(false);
  }, [user, shows]);

  useEffect(() => {
    setStatusFilter('all');
    if (mainTab === 'upnext') loadUpNext();
  }, [mainTab, loadUpNext]);

  const handleMarkWatched = async (item: UpNextItem) => {
    if (!user) return;
    const id = getEpisodeId(item.episode.season_number, item.episode.episode_number);
    setMarkingId(id);
    try {
      const runtime = item.episode.runtime && item.episode.runtime > 0 ? item.episode.runtime : 30;
      await markEpisodeWatched(
        user.uid,
        Number(item.show.showId),
        item.episode.season_number,
        item.episode.episode_number,
        runtime
      );
      setUpNext((prev) => prev.filter((i) => i !== item));
      setRecentlyWatched((prev) => [item, ...prev]);
      setShowRecent(true);
    } finally {
      setMarkingId(null);
    }
  };

  const handleRemove = async (showId: string | number) => {
    if (!user) return;
    setRemovingId(showId);
    try {
      await removeShowFromWatchlist(user.uid, showId);
    } finally {
      setRemovingId(null);
    }
  };

  const tabs = [
    { key: 'upnext' as const, label: 'Up Next' },
    { key: 'series' as const, label: 'Minhas Séries' },
    { key: 'movies' as const, label: 'Filmes' },
  ];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto pb-28 md:pb-0">
      <h1 className="page-title mb-6">Minha Lista</h1>

      {/* Main tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setMainTab(key)}
            className={`text-sm font-medium px-5 py-2.5 rounded-xl transition-all duration-200 ${
              mainTab === key
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/30'
                : 'bg-dark-700 text-gray-400 hover:text-white hover:bg-dark-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mainTab === 'upnext' ? (
        <div className="space-y-6 animation-fade-in">
          {/* Up Next feed */}
          {loadingUpNext ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="card p-4 flex gap-4 animate-pulse">
                  <div className="w-14 h-20 rounded-xl bg-dark-600" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-dark-500 rounded w-3/4" />
                    <div className="h-3 bg-dark-600 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : upNext.length > 0 ? (
            <div className="space-y-3">
              {upNext.map((item) => {
                const id = getEpisodeId(item.episode.season_number, item.episode.episode_number);
                return (
                  <UpNextCard
                    key={`${item.show.showId}-${id}`}
                    item={item}
                    onMarkWatched={handleMarkWatched}
                    marking={markingId === id}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-500/20 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-brand-400" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-semibold">Tudo em dia! 🎉</p>
              <p className="text-gray-400 text-sm mt-1">Não há episódios pendentes nas séries que você assiste.</p>
            </div>
          )}

          {/* Recently watched (hidden until revealed) */}
          {recentlyWatched.length > 0 && (
            <div>
              <button
                onClick={() => setShowRecent((v) => !v)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mx-auto"
              >
                {showRecent ? 'Ocultar assistidos recentemente ↑' : `Ver assistidos recentemente (${recentlyWatched.length}) ↓`}
              </button>
              {showRecent && (
                <div className="mt-3 space-y-3">
                  {recentlyWatched.map((item) => {
                    const id = getEpisodeId(item.episode.season_number, item.episode.episode_number);
                    return (
                      <div key={`recent-${item.show.showId}-${id}`} className="card p-4 flex gap-4 opacity-70">
                        <Link to={`/show/${item.show.showId}`} className="shrink-0">
                          <div className="w-14 h-20 rounded-xl overflow-hidden bg-dark-500">
                            {getPosterUrl(item.show.posterPath, 'w185') ? (
                              <img src={getPosterUrl(item.show.posterPath, 'w185')!} alt={item.show.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-dark-500" />
                            )}
                          </div>
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link to={`/show/${item.show.showId}`} className="hover:text-brand-400 transition-colors">
                            <h3 className="font-semibold text-white truncate text-sm line-through">{item.show.title}</h3>
                          </Link>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            T{item.episode.season_number} · E{item.episode.episode_number} — {item.episode.name}
                          </p>
                          <span className="inline-flex items-center gap-1 text-xs text-green-400 mt-2">
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Assistido
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : mainTab === 'series' ? (
        <div className="animation-fade-in">
          {/* Status filter */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {SERIES_FILTER_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 ${
                  statusFilter === key
                    ? key === 'up_to_date'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-brand-600 text-white shadow-sm'
                    : 'bg-dark-700 text-gray-400 hover:text-white hover:bg-dark-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {(() => {
              const series = shows.filter((s) => s.mediaType !== 'movie');
              if (series.length === 0) {
                return (
                  <div className="col-span-full text-center py-16">
                    <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-500/20 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-8 h-8 text-brand-400" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                      </svg>
                    </div>
                    <p className="text-white font-semibold">Sua lista está vazia</p>
                    <p className="text-gray-400 text-sm mt-1">Busque séries para começar a adicionar!</p>
                    <Link to="/search" className="btn-primary inline-flex mt-4">
                      Buscar séries
                    </Link>
                  </div>
                );
              }
              const sortPriority = (s: UserShow): number => {
                if (s.status === 'completed') return 4;
                if (s.status === 'watching' && isUpToDate(s)) return 1;
                if (s.status === 'watching') return 0;
                if (s.status === 'plan_to_watch') return 2;
                if (s.status === 'dropped') return 3;
                return 99;
              };
              const sorted = statusFilter === 'all' ? [...series].sort((a, b) => sortPriority(a) - sortPriority(b)) : series;
              const filtered = statusFilter === 'all'
                ? sorted
                : statusFilter === 'up_to_date'
                  ? sorted.filter(isUpToDate)
                  : sorted.filter((s) => s.status === statusFilter);
              return filtered.length > 0 ? (
                filtered.map((show) => (
                  <div key={show.showId} className={removingId === show.showId ? 'opacity-50 pointer-events-none' : ''}>
                    <ShowCard
                      show={show}
                      onRemove={() => handleRemove(show.showId)}
                    />
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-16">
                  <p className="text-gray-400 text-sm">Nenhuma série encontrada com este filtro.</p>
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="animation-fade-in">
          {/* Status filter */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {MOVIE_FILTER_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 ${
                  statusFilter === key
                    ? key === 'up_to_date'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-brand-600 text-white shadow-sm'
                    : 'bg-dark-700 text-gray-400 hover:text-white hover:bg-dark-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {(() => {
              const movies = shows.filter((s) => s.mediaType === 'movie');
              if (movies.length === 0) {
                return (
                  <div className="col-span-full text-center py-16">
                    <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-500/20 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-8 h-8 text-brand-400" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                      </svg>
                    </div>
                    <p className="text-white font-semibold">Nenhum filme na lista</p>
                    <p className="text-gray-400 text-sm mt-1">Busque filmes para começar a adicionar!</p>
                    <Link to="/search" className="btn-primary inline-flex mt-4">
                      Buscar filmes
                    </Link>
                  </div>
                );
              }
              const isMovieWatched = (s: UserShow): boolean =>
                s.watchedCount > 0 && s.watchedCount >= s.totalEpisodes;
              const sortPriority = (s: UserShow): number => {
                if (s.status === 'completed') return 5;
                if (isMovieWatched(s)) return 0;
                if (s.status === 'watching') return 1;
                if (s.status === 'plan_to_watch') return 2;
                if (s.status === 'dropped') return 3;
                return 99;
              };
              const sorted = statusFilter === 'all' ? [...movies].sort((a, b) => sortPriority(a) - sortPriority(b)) : movies;
              const filtered = statusFilter === 'all'
                ? sorted
                : statusFilter === 'up_to_date'
                  ? sorted.filter(isMovieWatched)
                  : sorted.filter((s) => s.status === statusFilter);
              return filtered.length > 0 ? (
                filtered.map((show) => (
                  <div key={show.showId} className={removingId === show.showId ? 'opacity-50 pointer-events-none' : ''}>
                    <MovieCard
                      show={show}
                      onRemove={() => handleRemove(show.showId)}
                    />
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-16">
                  <p className="text-gray-400 text-sm">Nenhum filme encontrado com este filtro.</p>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default WatchlistPage;
