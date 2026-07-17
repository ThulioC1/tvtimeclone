import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import {
  getShowDetails,
  getSeasonDetails,
  getPosterUrl,
  getBackdropUrl,
  type TVSeason,
  type TVEpisode,
} from '../lib/tvmaze';
import {
  addShowToWatchlist,
  removeShowFromWatchlist,
  markEpisodeWatched,
  unmarkEpisodeWatched,
  subscribeToWatchedEpisodes,
  subscribeToUserShows,
  getEpisodeId,
  toggleFavorite,
  type UserShow,
  type ShowStatus,
  updateShowStatus,
} from '../lib/firestore';
import { getYouTubeTrailer } from '../lib/youtube';

const BackIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className={`w-5 h-5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const StarIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-yellow-400">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const STATUS_LABELS: Record<ShowStatus, string> = {
  watching: '▶ Assistindo',
  completed: '✓ Concluído',
  dropped: '✗ Abandonado',
  plan_to_watch: '⊕ Quero assistir',
};

const EpisodeRow = ({
  episode,
  watched,
  onToggle,
  toggling,
}: {
  episode: TVEpisode;
  watched: boolean;
  onToggle: () => void;
  toggling: boolean;
}) => (
  <div
    className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
      watched ? 'bg-dark-600/50 opacity-70' : 'hover:bg-dark-600/30'
    }`}
  >
    <button
      onClick={onToggle}
      disabled={toggling}
      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
        watched
          ? 'bg-brand-500 border-brand-500'
          : 'border-dark-300 hover:border-brand-400'
      } ${toggling ? 'opacity-50' : ''}`}
    >
      {watched && (
        <svg viewBox="0 0 16 16" fill="white" className="w-3 h-3">
          <path d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z" />
        </svg>
      )}
    </button>

    <div className="flex-1 min-w-0">
      <p className={`text-sm font-medium truncate ${watched ? 'line-through text-gray-500' : 'text-white'}`}>
        {episode.episode_number}. {episode.name}
      </p>
      {episode.air_date && (
        <p className="text-xs text-gray-500 mt-0.5">
          {new Date(episode.air_date).toLocaleDateString('pt-BR')}
          {episode.runtime && ` · ${episode.runtime} min`}
        </p>
      )}
    </div>

    {episode.vote_average > 0 && (
      <div className="flex items-center gap-1 shrink-0">
        <StarIcon />
        <span className="text-xs text-gray-400">{episode.vote_average.toFixed(1)}</span>
      </div>
    )}
  </div>
);

const SeasonAccordion = ({
  season,
  showId,
  watchedEpisodes,
  onToggleEpisode,
  togglingId,
}: {
  season: TVSeason;
  showId: number;
  watchedEpisodes: Set<string>;
  onToggleEpisode: (episode: TVEpisode) => void;
  togglingId: string | null;
}) => {
  const [open, setOpen] = useState(false);

  const { data: seasonData, isLoading } = useQuery({
    queryKey: ['season', showId, season.season_number],
    queryFn: () => getSeasonDetails(showId, season.season_number),
    enabled: open,
  });

  const episodes = seasonData?.episodes ?? [];
  const watchedInSeason = episodes.filter((ep) =>
    watchedEpisodes.has(getEpisodeId(ep.season_number, ep.episode_number))
  ).length;
  const progress = episodes.length > 0 ? (watchedInSeason / episodes.length) * 100 : 0;

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-dark-600/30 transition-colors"
      >
        <div className="flex-1 text-left">
          <p className="font-medium text-white">Temporada {season.season_number}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {season.episode_count} episódios
            {episodes.length > 0 && ` · ${watchedInSeason} assistidos`}
          </p>
          {episodes.length > 0 && (
            <div className="progress-bar mt-2 w-48">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="border-t border-dark-500 px-3 py-2 space-y-1 animation-fade-in">
          {isLoading ? (
            <div className="py-4 flex justify-center">
              <span className="w-5 h-5 border-2 border-dark-400 border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : (
            episodes.map((ep) => {
              const id = getEpisodeId(ep.season_number, ep.episode_number);
              return (
                <EpisodeRow
                  key={ep.id}
                  episode={ep}
                  watched={watchedEpisodes.has(id)}
                  onToggle={() => onToggleEpisode(ep)}
                  toggling={togglingId === id}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

const ShowDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const showId = Number(id);

  const [watchedEpisodes, setWatchedEpisodes] = useState<Set<string>>(new Set());
  const [userShow, setUserShow] = useState<UserShow | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [trailerId, setTrailerId] = useState<string | null>(null);
  const [isFav, setIsFav] = useState(false);

  const { data: show, isLoading } = useQuery({
    queryKey: ['show', showId],
    queryFn: () => getShowDetails(showId),
    enabled: !!showId,
  });

  useEffect(() => {
    if (!user || !showId) return;
    const unsub1 = subscribeToWatchedEpisodes(user.uid, showId, setWatchedEpisodes);
    const unsub2 = subscribeToUserShows(user.uid, (shows) => {
      const found = shows.find((s) => s.showId === showId) ?? null;
      setUserShow(found);
      setIsFav(found?.isFavorite ?? false);
    });
    return () => { unsub1(); unsub2(); };
  }, [user, showId]);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    getYouTubeTrailer(show.name).then((id) => {
      if (!cancelled) setTrailerId(id);
    });
    return () => { cancelled = true; };
  }, [show]);

  const handleAddToList = async () => {
    if (!user || !show) return;
    await addShowToWatchlist(user.uid, show, 'watching');
  };

  const handleRemoveFromList = async () => {
    if (!user || !show) return;
    await removeShowFromWatchlist(user.uid, showId);
  };

  const handleStatusChange = async (status: ShowStatus) => {
    if (!user) return;
    setStatusUpdating(true);
    try {
      await updateShowStatus(user.uid, showId, status);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleToggleFav = async () => {
    if (!user) return;
    const next = !isFav;
    setIsFav(next);
    try {
      await toggleFavorite(user.uid, showId, next);
    } catch {
      setIsFav(!next);
    }
  };

  const handleToggleEpisode = async (episode: TVEpisode) => {
    if (!user || !show) return;
    const id = getEpisodeId(episode.season_number, episode.episode_number);
    setTogglingId(id);
    try {
      // Resolve an effective runtime: episode runtime -> season average -> 30 min default.
      const season = show.seasons?.find((s) => s.season_number === episode.season_number);
      const seasonRuns = (season?.episodes ?? [])
        .map((e) => e.runtime)
        .filter((r): r is number => typeof r === 'number' && r > 0);
      const seasonAvg = seasonRuns.length
        ? Math.round(seasonRuns.reduce((a, b) => a + b, 0) / seasonRuns.length)
        : 30;
      const effectiveRuntime = episode.runtime && episode.runtime > 0 ? episode.runtime : seasonAvg;

      if (watchedEpisodes.has(id)) {
        await unmarkEpisodeWatched(user.uid, showId, episode.season_number, episode.episode_number, effectiveRuntime);
      } else {
        await markEpisodeWatched(user.uid, showId, episode.season_number, episode.episode_number, effectiveRuntime);
      }
    } finally {
      setTogglingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="w-8 h-8 border-4 border-dark-400 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!show) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Série não encontrada</p>
      </div>
    );
  }

  const backdropUrl = getBackdropUrl(show.backdrop_path, 'w1280');
  const posterUrl = getPosterUrl(show.poster_path, 'w342');
  const seasons = show.seasons?.filter((s) => s.season_number > 0) ?? [];
  const isInList = !!userShow;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Hero */}
      <div className="relative h-60 md:h-80 overflow-hidden">
        {backdropUrl ? (
          <img
            src={backdropUrl}
            alt={show.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-dark-600 to-dark-800" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-dark-900/70 to-transparent" />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 bg-dark-900/60 backdrop-blur-md p-2.5 rounded-xl text-white hover:bg-dark-800 transition-colors border border-white/10"
        >
          <BackIcon />
        </button>
      </div>

      <div className="px-4 md:px-6 pb-28 md:pb-10 -mt-20 relative">
        <div className="flex gap-4 md:gap-5">
          {/* Poster */}
          <div className="w-28 h-40 md:w-32 md:h-48 rounded-2xl overflow-hidden bg-dark-600 shrink-0 border border-white/10 shadow-2xl shadow-black/60 ring-1 ring-white/5">
            {posterUrl ? (
              <img src={posterUrl} alt={show.name} loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-dark-500" />
            )}
          </div>

          {/* Info */}
          <div className="pt-16 md:pt-20 flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-extrabold text-white leading-tight tracking-tight drop-shadow">{show.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-400">
              {show.first_air_date && <span>{new Date(show.first_air_date).getFullYear()}</span>}
              {show.number_of_seasons && <span>{show.number_of_seasons} temp.</span>}
              {show.vote_average > 0 && (
                <span className="flex items-center gap-1">
                  <StarIcon /> {show.vote_average.toFixed(1)}
                </span>
              )}
              {show.status && (
                <span className={`badge ${show.status === 'Ended' ? 'bg-gray-500/20 text-gray-400' : 'bg-green-500/20 text-green-400'}`}>
                  {show.status === 'Ended' ? 'Encerrada' : 'Em exibição'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-5 items-stretch">
          {!isInList ? (
            <button onClick={handleAddToList} className="btn-primary flex-1">
              + Adicionar à lista
            </button>
          ) : (
            <div className="flex gap-2 flex-1 flex-wrap">
              <select
                value={userShow.status}
                onChange={(e) => handleStatusChange(e.target.value as ShowStatus)}
                disabled={statusUpdating}
                className="input-field flex-1 text-sm py-2"
              >
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <button
                onClick={handleRemoveFromList}
                className="btn-ghost text-red-400 hover:text-red-300 hover:bg-red-500/10 text-sm px-4"
              >
                Remover
              </button>
            </div>
          )}

          {isInList && (
            <button
              onClick={handleToggleFav}
              className={`shrink-0 w-12 rounded-xl border transition-all duration-200 active:scale-95 flex items-center justify-center ${
                isFav
                  ? 'bg-red-500/15 border-red-500/40 text-red-400'
                  : 'bg-dark-700 border-white/10 text-gray-400 hover:text-red-400 hover:border-red-500/30'
              }`}
              title={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          )}
        </div>

        {/* Progress */}
        {isInList && (
          <div className="card p-4 mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Progresso</span>
              <span className="text-brand-400 font-semibold">
                {userShow.watchedCount}/{userShow.totalEpisodes} ep.
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${userShow.totalEpisodes > 0? (userShow.watchedCount / userShow.totalEpisodes) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Trailer */}
        {trailerId && (
          <div className="mt-5">
            <h2 className="section-title mb-2">Trailer</h2>
            <div className="relative w-full rounded-2xl overflow-hidden bg-dark-600" style={{ paddingTop: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${trailerId}`}
                title={`Trailer de ${show.name}`}
                frameBorder={0}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}

        {/* Overview */}
        {show.overview && (
          <div className="mt-5">
            <h2 className="section-title mb-2">Sinopse</h2>
            <p className="text-gray-300 text-sm leading-relaxed">{show.overview}</p>
          </div>
        )}

        {/* Seasons */}
        {seasons.length > 0 && (
          <div className="mt-6">
            <h2 className="section-title mb-3">Temporadas</h2>
            <div className="space-y-3">
              {seasons.map((season) => (
                <SeasonAccordion
                  key={season.id}
                  season={season}
                  showId={showId}
                  watchedEpisodes={watchedEpisodes}
                  onToggleEpisode={handleToggleEpisode}
                  togglingId={togglingId}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShowDetailPage;
