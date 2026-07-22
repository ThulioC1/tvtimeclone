import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import {
  getTVShowDetails as tmdbGetShowDetails,
  getTVSeason as tmdbGetSeason,
  getPosterUrl,
  getBackdropUrl,
  getTVVideos,
  type TVSeason,
  type TVEpisode,
} from '../lib/tmdb';
import { getShowDetails as tvmazeGetShowDetails, getSeasonDetails as tvmazeGetSeason } from '../lib/tvmaze';
import {
  addShowToWatchlist,
  removeShowFromWatchlist,
  markEpisodeWatched,
  unmarkEpisodeWatched,
  markAllEpisodesWatched,
  unmarkAllEpisodesWatched,
  markSeasonWatched,
  unmarkSeasonWatched,
  setEpisodeWatchedAt,
  subscribeToWatchedEpisodeDocs,
  subscribeToUserShows,
  getEpisodeId,
  toggleFavorite,
  type UserShow,
  type ShowStatus,
  updateShowStatus,
  submitRating,
  getUserRating,
  subscribeToMediaRatings,
} from '../lib/firestore';
import DisqusComments from '../components/DisqusComments';
import RatingStars from '../components/RatingStars';


const BackIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
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
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
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
  watchedAt,
  onToggle,
  onOpen,
  toggling,
}: {
  episode: TVEpisode;
  watched: boolean;
  watchedAt?: Date | null;
  onToggle: () => void;
  onOpen: () => void;
  toggling: boolean;
}) => (
  <div
    onClick={onOpen}
    className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 cursor-pointer ${
      watched ? 'bg-dark-600/50 opacity-70' : 'hover:bg-dark-600/30'
    }`}
  >
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
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
      <p className="text-xs text-gray-500 mt-0.5">
        {episode.air_date && (
          <span>
            {new Date(episode.air_date).toLocaleDateString('pt-BR')}
            {episode.runtime ? ` · ${episode.runtime} min` : ''}
          </span>
        )}
        {watched && watchedAt && (
          <span className="text-brand-400/80">
            {episode.air_date ? ' · ' : ''}Assistido em {watchedAt.getDate().toString().padStart(2, '0')}/{(
              watchedAt.getMonth() + 1
            )
              .toString()
              .padStart(2, '0')}/{watchedAt.getFullYear()}
          </span>
        )}
      </p>
    </div>

    {episode.vote_average > 0 && (
      <div className="flex items-center gap-1 shrink-0">
        <StarIcon />
        <span className="text-xs text-gray-400">{episode.vote_average.toFixed(1)}</span>
      </div>
    )}
  </div>
);

const toDateInputValue = (d: Date | null | undefined): string => {
  if (!d) return '';
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const EpisodeModal = ({
  episode,
  watched,
  watchedAt,
  onClose,
  onToggle,
  onSaveDate,
}: {
  episode: TVEpisode;
  watched: boolean;
  watchedAt?: Date | null;
  onClose: () => void;
  onToggle: () => void;
  onSaveDate?: (date: Date) => void;
}) => {
  const stillUrl = episode.still_path
    ? getPosterUrl(episode.still_path)
    : null;
  const [dateValue, setDateValue] = useState<string>(toDateInputValue(watchedAt) || toDateInputValue(new Date()));
  const [savingDate, setSavingDate] = useState(false);

  const handleSaveDate = async () => {
    if (!dateValue || !onSaveDate) return;
    const [y, m, d] = dateValue.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0);
    setSavingDate(true);
    try {
      onSaveDate(date);
    } finally {
      setSavingDate(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animation-fade-in"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {stillUrl && (
          <div className="relative h-44 sm:h-52 w-full bg-dark-600 overflow-hidden">
            <img src={stillUrl} alt={episode.name} className="w-full h-full object-cover" />
            <button
              onClick={onClose}
              className="absolute top-3 right-3 bg-dark-900/70 backdrop-blur-md p-2 rounded-xl text-white hover:bg-dark-800 transition-colors border border-white/10"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-5">
          {!stillUrl && (
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-bold text-white pr-2">
                {episode.episode_number}. {episode.name}
              </h3>
              <button
                onClick={onClose}
                className="shrink-0 bg-dark-700 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-dark-600 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          {stillUrl && (
            <h3 className="text-lg font-bold text-white mb-2">
              {episode.episode_number}. {episode.name}
            </h3>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 mb-3">
            {episode.air_date && (
              <span>{new Date(episode.air_date).toLocaleDateString('pt-BR')}</span>
            )}
            {episode.runtime ? <span>{episode.runtime} min</span> : null}
            {episode.vote_average > 0 && (
              <span className="flex items-center gap-1">
                <StarIcon /> {episode.vote_average.toFixed(1)}
              </span>
            )}
            {watched && watchedAt && (
              <span className="text-brand-400/80">
                Assistido em {watchedAt.getDate().toString().padStart(2, '0')}/{(
                  watchedAt.getMonth() + 1
                )
                  .toString()
                  .padStart(2, '0')}/{watchedAt.getFullYear()}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">
            {episode.overview ? episode.overview : 'Sem sinopse disponível para este episódio.'}
          </p>

          {watched && (
            <div className="mt-4 p-3 rounded-xl bg-dark-600/40 border border-dark-500">
              <label className="text-xs text-gray-400 block mb-1.5">Data em que assistiu</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dateValue}
                  max={toDateInputValue(new Date())}
                  onChange={(e) => setDateValue(e.target.value)}
                  className="input-field flex-1 text-sm py-2"
                />
                <button
                  onClick={handleSaveDate}
                  disabled={savingDate || !dateValue || !onSaveDate}
                  className="btn-secondary text-sm px-4 disabled:opacity-50 shrink-0"
                >
                  {savingDate ? '...' : 'Salvar'}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              onToggle();
              onClose();
            }}
            className={`btn-primary w-full text-sm mt-5 ${watched ? 'bg-dark-600 hover:bg-dark-500' : ''}`}
          >
            {watched ? 'Desmarcar como assistido' : '✓ Marcar como assistido'}
          </button>
        </div>
      </div>
    </div>
  );
};

const SeasonEpisodes = ({
  showId,
  season,
  watchedEpisodes,
  watchedDocs,
  onToggleEpisode,
  onOpenEpisode,
  togglingId,
  onMarkSeason,
  onUnmarkSeason,
}: {
  showId: number;
  season: TVSeason;
  watchedEpisodes: Set<string>;
  watchedDocs: Map<string, { watchedAt: Date | null; runtime?: number }>;
  onToggleEpisode: (episode: TVEpisode) => void;
  onOpenEpisode: (episode: TVEpisode) => void;
  onMarkSeason: (seasonNumber: number) => void;
  onUnmarkSeason: (seasonNumber: number) => void;
  togglingId: string | null;
}) => {
  const { data: seasonData, isLoading } = useQuery({
    queryKey: ['season', showId, season.season_number],
    queryFn: async () => {
      try { return await tmdbGetSeason(showId, season.season_number); }
      catch { return tvmazeGetSeason(showId, season.season_number); }
    },
  });

  const episodes = seasonData?.episodes ?? [];
  const watchedInSeason = episodes.filter((ep) =>
    watchedEpisodes.has(getEpisodeId(ep.season_number, ep.episode_number))
  ).length;
  const seasonComplete = episodes.length > 0 && watchedInSeason === episodes.length;
  const progress = episodes.length > 0 ? (watchedInSeason / episodes.length) * 100 : 0;

  return (
    <div className="mt-3 card overflow-hidden">
      <div className="px-4 py-3 border-b border-dark-500">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-white">Temporada {season.season_number}</p>
            <span className="text-xs text-gray-400">
              {watchedInSeason}/{episodes.length} assistidos
            </span>
          </div>
          <button
            onClick={() =>
              seasonComplete
                ? onUnmarkSeason(season.season_number)
                : onMarkSeason(season.season_number)
            }
            disabled={episodes.length === 0}
            className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 disabled:opacity-40 ${
              seasonComplete
                ? 'bg-dark-600 text-gray-300 hover:bg-dark-500'
                : 'bg-brand-500/15 text-brand-400 hover:bg-brand-500/25'
            }`}
          >
            {seasonComplete ? 'Desmarcar temp.' : '✓ Marcar temp.'}
          </button>
        </div>
        <div className="progress-bar mt-2">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="px-3 py-2 space-y-1 animation-fade-in">
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
                watchedAt={watchedDocs.get(id)?.watchedAt ?? null}
                onToggle={() => onToggleEpisode(ep)}
                onOpen={() => onOpenEpisode(ep)}
                toggling={togglingId === id}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

const SeasonAccordion = ({
  season,
  showId,
  watchedEpisodes,
  watchedDocs,
  onToggleEpisode,
  onOpenEpisode,
  togglingId,
  open,
  onToggle,
  onMarkSeason,
  onUnmarkSeason,
}: {
  season: TVSeason;
  showId: number;
  watchedEpisodes: Set<string>;
  watchedDocs: Map<string, { watchedAt: Date | null; runtime?: number }>;
  onToggleEpisode: (episode: TVEpisode) => void;
  onOpenEpisode: (episode: TVEpisode) => void;
  togglingId: string | null;
  open: boolean;
  onToggle: () => void;
  onMarkSeason: (seasonNumber: number) => void;
  onUnmarkSeason: (seasonNumber: number) => void;
}) => {
  const { data: seasonData, isLoading } = useQuery({
    queryKey: ['season', showId, season.season_number],
    queryFn: async () => {
      try { return await tmdbGetSeason(showId, season.season_number); }
      catch { return tvmazeGetSeason(showId, season.season_number); }
    },
    enabled: open,
  });

  const episodes = seasonData?.episodes ?? [];
  const watchedInSeason = episodes.filter((ep) =>
    watchedEpisodes.has(getEpisodeId(ep.season_number, ep.episode_number))
  ).length;
  const seasonComplete = episodes.length > 0 && watchedInSeason === episodes.length;
  const progress = episodes.length > 0 ? (watchedInSeason / episodes.length) * 100 : 0;

  return (
    <div className="card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-dark-600/30 transition-colors"
      >
        <div className="flex-1 text-left">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-white">Temporada {season.season_number}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {season.episode_count} episódios
                {episodes.length > 0 && ` · ${watchedInSeason} assistidos`}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                seasonComplete
                  ? onUnmarkSeason(season.season_number)
                  : onMarkSeason(season.season_number);
              }}
              disabled={episodes.length === 0}
              className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 disabled:opacity-40 ${
                seasonComplete
                  ? 'bg-dark-600 text-gray-300 hover:bg-dark-500'
                  : 'bg-brand-500/15 text-brand-400 hover:bg-brand-500/25'
              }`}
            >
              {seasonComplete ? 'Desmarcar temp.' : '✓ Marcar temp.'}
            </button>
          </div>
          {episodes.length > 0 && (
            <div className="progress-bar mt-2">
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
                  watchedAt={watchedDocs.get(id)?.watchedAt ?? null}
                  onToggle={() => onToggleEpisode(ep)}
                  onOpen={() => onOpenEpisode(ep)}
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
  const [watchedDocs, setWatchedDocs] = useState<Map<string, { watchedAt: Date | null; runtime?: number }>>(new Map());
  const [userShow, setUserShow] = useState<UserShow | null>(null);
  const [userShowsLoaded, setUserShowsLoaded] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [trailerId, setTrailerId] = useState<string | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [openSeason, setOpenSeason] = useState<number | null>(null);
  const [seasonLayout, setSeasonLayout] = useState<'dropdown' | 'accordion'>(() => {
    return (localStorage.getItem('seasonLayout') as 'dropdown' | 'accordion') || 'dropdown';
  });
  const [markingAll, setMarkingAll] = useState(false);
  const [openEpisode, setOpenEpisode] = useState<TVEpisode | null>(null);
  const [userRating, setUserRating] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);

  const { data: show, isLoading } = useQuery({
    queryKey: ['show', showId, userShow?.source],
    queryFn: async () => {
      if (userShow && userShow.source !== 'tmdb') {
        return tvmazeGetShowDetails(showId);
      }
      try {
        return await tmdbGetShowDetails(showId);
      } catch {
        return tvmazeGetShowDetails(showId);
      }
    },
    enabled: !!showId && userShowsLoaded,
  });

  useEffect(() => {
    if (!user || !showId) return;
    const unsub1 = subscribeToWatchedEpisodeDocs(user.uid, showId, (docs) => {
      setWatchedDocs(docs);
      setWatchedEpisodes(new Set(docs.keys()));
    });
    const unsub2 = subscribeToUserShows(user.uid, (shows) => {
      const found = shows.find((s) => String(s.showId) === String(showId)) ?? null;
      setUserShow(found);
      setIsFav(found?.isFavorite ?? false);
      setUserShowsLoaded(true);
    });
    return () => { unsub1(); unsub2(); };
  }, [user, showId]);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    getTVVideos(show.id).then((videos) => {
      if (!cancelled) {
        const trailer = videos.find((v) => v.key) ?? null;
        if (trailer) setTrailerId(trailer.key);
      }
    });
    return () => { cancelled = true; };
  }, [show]);

  useEffect(() => {
    if (!show || show.id === 0) return;
    const unsub = subscribeToMediaRatings(show.id, 'tv', (data) => {
      setAvgRating(data.average);
      setRatingCount(data.count);
    });
    return unsub;
  }, [show]);

  useEffect(() => {
    if (!user || !show || show.id === 0) return;
    getUserRating(user.uid, show.id, 'tv').then((r) => setUserRating(r ?? 0));
  }, [user, show]);

  const handleRate = async (rating: number) => {
    if (!user || !show || show.id === 0) return;
    setUserRating(rating);
    await submitRating(user.uid, user.displayName || 'Anônimo', user.photoURL, show.id, 'tv', rating);
  };

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
    } catch (err) {
      console.error('Erro ao marcar episódio:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const allWatched =
    !!userShow && userShow.totalEpisodes > 0 && userShow.watchedCount >= userShow.totalEpisodes;

  const handleMarkAll = async () => {
    if (!user || !show) return;
    setMarkingAll(true);
    try {
      const episodes: { seasonNumber: number; episodeNumber: number; runtime?: number | null }[] = [];
      for (const season of show.seasons ?? []) {
        if (season.season_number <= 0) continue;
        let data;
        try { data = await tmdbGetSeason(showId, season.season_number); }
        catch { data = await tvmazeGetSeason(showId, season.season_number); }
        for (const ep of data.episodes ?? []) {
          episodes.push({
            seasonNumber: ep.season_number,
            episodeNumber: ep.episode_number,
            runtime: ep.runtime ?? null,
          });
        }
      }
      if (allWatched) {
        await unmarkAllEpisodesWatched(user.uid, showId);
        if (userShow?.status === 'completed') {
          await updateShowStatus(user.uid, showId, 'watching');
        }
      } else {
        await markAllEpisodesWatched(user.uid, showId, episodes);
        if (userShow?.status !== 'completed') {
          await updateShowStatus(user.uid, showId, 'completed');
        }
      }
    } catch (err) {
      console.error('Erro ao marcar todos os episódios:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleMarkSeason = async (seasonNumber: number) => {
    if (!user || !show) return;
    try {
      let data;
      try { data = await tmdbGetSeason(showId, seasonNumber); }
      catch { data = await tvmazeGetSeason(showId, seasonNumber); }
      const episodes = (data.episodes ?? []).map((ep) => ({
        seasonNumber: ep.season_number,
        episodeNumber: ep.episode_number,
        runtime: ep.runtime ?? null,
      }));
      await markSeasonWatched(user.uid, showId, seasonNumber, episodes);
    } catch (err) {
      console.error('Erro ao marcar temporada:', err);
    }
  };

  const handleUnmarkSeason = async (seasonNumber: number) => {
    if (!user) return;
    try {
      await unmarkSeasonWatched(user.uid, showId, seasonNumber);
    } catch (err) {
      console.error('Erro ao desmarcar temporada:', err);
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

  const activeSeasonNumber =
    selectedSeason ?? seasons[0]?.season_number ?? null;
  const activeSeason =
    activeSeasonNumber != null
      ? seasons.find((s) => s.season_number === activeSeasonNumber) ?? null
      : null;

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
        <button
          onClick={() => {
            const url = window.location.href;
            const text = `Veja "${show?.name || ''}" no Time to Watch!`;
            if (navigator.share) {
              navigator.share({ title: text, url });
            } else {
              navigator.clipboard.writeText(url).then(() => alert('Link copiado!'));
            }
          }}
          className="absolute top-4 right-4 bg-dark-900/60 backdrop-blur-md p-2.5 rounded-xl text-white hover:bg-dark-800 transition-colors border border-white/10"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
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
            <button
              onClick={handleMarkAll}
              disabled={markingAll}
              className="btn-secondary w-full text-sm mt-3 disabled:opacity-50"
            >
              {markingAll
                ? 'Processando...'
                : allWatched
                  ? 'Desmarcar todos os episódios'
                  : '✓ Marcar tudo como assistido'}
            </button>
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
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title mb-0">Temporadas</h2>
              <div className="flex bg-dark-700 rounded-xl p-0.5 border border-white/5">
                <button
                  onClick={() => {
                    setSeasonLayout('dropdown');
                    localStorage.setItem('seasonLayout', 'dropdown');
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    seasonLayout === 'dropdown'
                      ? 'bg-dark-500 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Visualização por dropdown"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 inline-block mr-1">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Dropdown
                </button>
                <button
                  onClick={() => {
                    setSeasonLayout('accordion');
                    localStorage.setItem('seasonLayout', 'accordion');
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    seasonLayout === 'accordion'
                      ? 'bg-dark-500 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Visualização por accordion"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 inline-block mr-1">
                    <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                  Accordion
                </button>
              </div>
            </div>

            {seasonLayout === 'dropdown' ? (
              <>
                <div className="relative">
                  <select
                    value={activeSeasonNumber ?? ''}
                    onChange={(e) => setSelectedSeason(Number(e.target.value))}
                    className="input-field w-full text-sm py-2.5 pr-10 appearance-none cursor-pointer"
                  >
                    {seasons.map((season) => (
                      <option key={season.id} value={season.season_number}>
                        Temporada {season.season_number}
                        {season.episode_count ? ` · ${season.episode_count} eps` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <ChevronDownIcon />
                  </div>
                </div>

                {activeSeason && (
                  <SeasonEpisodes
                    showId={showId}
                    season={activeSeason}
                    watchedEpisodes={watchedEpisodes}
                    watchedDocs={watchedDocs}
                    onToggleEpisode={handleToggleEpisode}
                    onOpenEpisode={setOpenEpisode}
                    onMarkSeason={handleMarkSeason}
                    onUnmarkSeason={handleUnmarkSeason}
                    togglingId={togglingId}
                  />
                )}
              </>
            ) : (
              <div className="space-y-3">
                {seasons.map((season) => (
                  <SeasonAccordion
                    key={season.id}
                    season={season}
                    showId={showId}
                    watchedEpisodes={watchedEpisodes}
                    watchedDocs={watchedDocs}
                    onToggleEpisode={handleToggleEpisode}
                    onOpenEpisode={setOpenEpisode}
                    togglingId={togglingId}
                    open={openSeason === season.season_number}
                    onToggle={() =>
                      setOpenSeason((cur) =>
                        cur === season.season_number ? null : season.season_number
                      )
                    }
                    onMarkSeason={handleMarkSeason}
                    onUnmarkSeason={handleUnmarkSeason}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {openEpisode && (
          <EpisodeModal
            episode={openEpisode}
            watched={watchedEpisodes.has(
              getEpisodeId(openEpisode.season_number, openEpisode.episode_number)
            )}
            watchedAt={
              watchedDocs.get(
                getEpisodeId(openEpisode.season_number, openEpisode.episode_number)
              )?.watchedAt ?? null
            }
            onClose={() => setOpenEpisode(null)}
            onToggle={() => handleToggleEpisode(openEpisode)}
            onSaveDate={(date) => {
              if (!user) return;
              setEpisodeWatchedAt(
                user.uid,
                showId,
                openEpisode.season_number,
                openEpisode.episode_number,
                date
              );
            }}
          />
        )}

        {/* ── Ratings ───────────────────────────────────────────────────── */}
        {show && show.id > 0 && (
          <div className="card p-4 mt-5">
            <h3 className="section-title mb-3">Avaliação</h3>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center">
                <p className="text-xs text-gray-400 mb-1">Sua nota</p>
                <RatingStars
                  value={userRating}
                  onChange={user ? handleRate : undefined}
                  size="lg"
                />
              </div>
              {avgRating > 0 && (
                <div className="flex flex-col items-center">
                  <p className="text-xs text-gray-400 mb-1">Média</p>
                  <RatingStars value={avgRating} size="lg" count={ratingCount} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Comments ──────────────────────────────────────────────────── */}
        {show && show.id > 0 && (
          <DisqusComments mediaId={show.id} mediaType="tv" title={show.name} />
        )}
      </div>
    </div>
  );
};

export default ShowDetailPage;
