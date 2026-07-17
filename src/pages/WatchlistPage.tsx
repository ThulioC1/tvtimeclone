import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToUserShows,
  removeShowFromWatchlist,
  updateShowStatus,
  markEpisodeWatched,
  subscribeToWatchedEpisodes,
  getEpisodeId,
  type UserShow,
  type ShowStatus,
} from '../lib/firestore';
import { getPosterUrl, getAllEpisodesSorted, type TVEpisode } from '../lib/tvmaze';

const STATUS_LABELS: Record<ShowStatus, string> = {
  watching: 'Assistindo',
  completed: 'Concluído',
  dropped: 'Abandonado',
  plan_to_watch: 'Quero assistir',
};

const STATUS_COLORS: Record<ShowStatus, string> = {
  watching: 'bg-brand-500/20 text-brand-400',
  completed: 'bg-green-500/20 text-green-400',
  dropped: 'bg-red-500/20 text-red-400',
  plan_to_watch: 'bg-yellow-500/20 text-yellow-400',
};

interface UpNextItem {
  show: UserShow;
  episode: TVEpisode;
}

const ShowRow = ({
  show,
  onRemove,
  onStatusChange,
}: {
  show: UserShow;
  onRemove: () => void;
  onStatusChange: (status: ShowStatus) => void;
}) => {
  const posterUrl = getPosterUrl(show.posterPath, 'w185');
  const progress = show.totalEpisodes > 0 ? (show.watchedCount / show.totalEpisodes) * 100 : 0;

  return (
    <div className="card p-4 flex gap-4 hover:border-brand-500/40 transition-colors active-show-glow">
      <Link to={`/show/${show.showId}`} className="shrink-0">
        <div className="w-14 h-20 rounded-xl overflow-hidden bg-dark-500">
          {posterUrl ? (
            <img src={posterUrl} alt={show.title} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-dark-500" />
          )}
        </div>
      </Link>

      <div className="flex-1 min-w-0">
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

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <select
            value={show.status}
            onChange={(e) => onStatusChange(e.target.value as ShowStatus)}
            className={`text-xs font-medium px-2 py-1 rounded-lg border-0 outline-none cursor-pointer ${STATUS_COLORS[show.status]} bg-transparent`}
          >
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v} className="bg-dark-700 text-white">{l}</option>
            ))}
          </select>
          <span className="text-xs text-gray-500">
            {show.watchedCount}/{show.totalEpisodes} ep.
          </span>
        </div>

        <div className="progress-bar mt-2">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
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
  const [mainTab, setMainTab] = useState<'upnext' | 'list'>('upnext');
  const [upNext, setUpNext] = useState<UpNextItem[]>([]);
  const [recentlyWatched, setRecentlyWatched] = useState<UpNextItem[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [loadingUpNext, setLoadingUpNext] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserShows(user.uid, setShows);
    return unsub;
  }, [user]);

  const loadUpNext = useCallback(async () => {
    if (!user) return;
    setLoadingUpNext(true);
    const watching = shows.filter((s) => s.status === 'watching');
    const items: UpNextItem[] = [];
    for (const show of watching) {
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
        // ignore series that fail to load
      }
    }
    setUpNext(items);
    setLoadingUpNext(false);
  }, [user, shows]);

  useEffect(() => {
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
        item.show.showId,
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

  const handleRemove = async (showId: number) => {
    if (!user) return;
    setRemovingId(showId);
    try {
      await removeShowFromWatchlist(user.uid, showId);
    } finally {
      setRemovingId(null);
    }
  };

  const handleStatusChange = async (showId: number, status: ShowStatus) => {
    if (!user) return;
    await updateShowStatus(user.uid, showId, status);
  };

  const tabs = [
    { key: 'upnext' as const, label: 'Up Next' },
    { key: 'list' as const, label: 'Minhas Séries' },
  ];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto pb-28 md:pb-0">
      <h1 className="page-title mb-6">Minhas Séries</h1>

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
              <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-purple-500/20 flex items-center justify-center">
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
      ) : (
        <div className="space-y-3 animation-fade-in">
          {shows.length > 0 ? (
            shows.map((show) => (
              <div key={show.showId} className={removingId === show.showId ? 'opacity-50 pointer-events-none' : ''}>
                <ShowRow
                  show={show}
                  onRemove={() => handleRemove(show.showId)}
                  onStatusChange={(s) => handleStatusChange(show.showId, s)}
                />
              </div>
            ))
          ) : (
            <div className="text-center py-16">
              <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-purple-500/20 flex items-center justify-center">
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
          )}
        </div>
      )}
    </div>
  );
};

export default WatchlistPage;
