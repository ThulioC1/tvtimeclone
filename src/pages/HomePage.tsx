import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { subscribeToUserShows, setBannerShow, getBannerUrl, subscribeToFollowing, type UserShow, type FollowingInfo } from '../lib/firestore';
import { getBackdropUrl } from '../lib/tmdb';
import { formatWatchTimeShort } from '../lib/format';
import BannerPickerModal from '../components/BannerPickerModal';
import { getTrendingTVShows, getTrendingMovies, getPosterUrl, getAllEpisodes as tmdbGetAllEpisodes, type TVShow, type TMDBMovieSimple } from '../lib/tmdb';
import { getAllEpisodesSorted as tvmazeGetAllEpisodes } from '../lib/tvmaze';

const StarIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-yellow-400">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

// Deterministic shuffle so the "Recommended" list changes every week
// but stays stable during the week (seeded by ISO week number).
const getWeekSeed = (): number => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const day = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return Math.ceil((day + start.getDay() + 1) / 7);
};

const seededShuffle = <T,>(arr: T[], seed: number): T[] => {
  const a = [...arr];
  let s = seed;
  const rand = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

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

const MovieCard = ({ movie }: { movie: TMDBMovieSimple }) => {
  const posterUrl = getPosterUrl(movie.poster_path, 'w342');
  return (
    <Link to={`/movie/${movie.id}`} className="card-hover group block">
      <div className="aspect-[2/3] rounded-xl overflow-hidden bg-dark-600 relative">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={movie.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.classList.add('flex', 'items-center', 'justify-center'); }}
          />
        ) : null}
        {!posterUrl && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600">
            <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1}>
              <rect x="2" y="3" width="20" height="14" rx="2" />
            </svg>
          </div>
        )}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-dark-900/80 rounded-full px-2 py-0.5">
          <StarIcon />
          <span className="text-[10px] text-white font-medium">
            {movie.vote_average ? movie.vote_average.toFixed(1) : '–'}
          </span>
        </div>
      </div>
      <div className="p-2">
        <p className="text-xs font-medium text-white truncate">{movie.title}</p>
        <p className="text-[10px] text-gray-500">
          {movie.release_date ? new Date(movie.release_date).getFullYear() : ''}
        </p>
      </div>
    </Link>
  );
};

const ListShowRow = ({ show }: { show: UserShow }) => {
  const posterUrl = getPosterUrl(show.posterPath);
  const progress = show.totalEpisodes > 0 ? (show.watchedCount / show.totalEpisodes) * 100 : 0;
  const lastEp = show.lastWatchedEpisode;

  // Dynamic resolution for legacy user shows without lastWatchedEpisode saved in Firestore
  const { data: fetchedLastEp } = useQuery({
    queryKey: ['show-last-ep', show.showId, show.source, show.watchedCount],
    queryFn: async () => {
      if (show.watchedCount <= 0) return null;
      const all = show.source === 'tmdb'
        ? await tmdbGetAllEpisodes(Number(show.showId)).catch(() => tvmazeGetAllEpisodes(Number(show.showId)))
        : await tvmazeGetAllEpisodes(Number(show.showId));
      const epIndex = Math.min(show.watchedCount - 1, all.length - 1);
      const ep = all[epIndex];
      if (!ep) return null;
      return {
        seasonNumber: ep.season_number,
        episodeNumber: ep.episode_number,
        name: ep.name,
      };
    },
    enabled: !lastEp && show.watchedCount > 0,
    staleTime: 3600000,
  });

  const displayEp = lastEp || fetchedLastEp;

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
        {displayEp ? (
          <p className="text-xs text-brand-400 font-medium truncate">
            T{displayEp.seasonNumber} · E{displayEp.episodeNumber}{displayEp.name ? ` — ${displayEp.name}` : ''}
          </p>
        ) : (
          <p className="text-xs text-gray-400 truncate">
            {show.watchedCount}/{show.totalEpisodes} eps
          </p>
        )}
      </div>
      <div className="w-16 shrink-0">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </Link>
  );
};

const StatCard = ({
  value,
  label,
  onClick,
  title,
}: {
  value: number | string;
  label: string;
  onClick?: () => void;
  title?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title || label}
    className="card p-2.5 sm:p-4 flex flex-col items-center justify-center text-center min-w-0 w-full transition-all duration-200 cursor-pointer hover:border-brand-500/50 hover:bg-dark-700/80 hover:scale-[1.03] active:scale-[0.98] group relative"
  >
    <p className="text-lg sm:text-2xl font-extrabold gradient-text leading-none break-words w-full group-hover:brightness-110 transition-all">{value}</p>
    <p className="text-[9px] sm:text-[10px] text-gray-400 mt-1 leading-tight break-words w-full flex items-center justify-center gap-0.5 group-hover:text-gray-200 transition-colors">
      <span>{label}</span>
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
      </svg>
    </p>
  </button>
);

const WatchedEpisodesModal = ({
  open,
  onClose,
  shows,
  totalWatched,
}: {
  open: boolean;
  onClose: () => void;
  shows: UserShow[];
  totalWatched: number;
}) => {
  if (!open) return null;

  const seriesWithEps = shows
    .filter((s) => s.mediaType !== 'movie' && s.watchedCount > 0)
    .sort((a, b) => b.watchedCount - a.watchedCount);

  const watchingCount = shows.filter((s) => s.mediaType !== 'movie' && s.status === 'watching').length;
  const avgPerSeries = shows.length > 0 ? (totalWatched / shows.length).toFixed(1) : '0';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[80vh] overflow-y-auto bg-dark-900 rounded-2xl p-5 border border-dark-700 shadow-2xl shadow-black relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-dark-700">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-none">Estatísticas de Episódios</h3>
              <p className="text-xs text-gray-400 mt-1">Resumo das suas maratonas</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="bg-dark-800 p-3 rounded-xl text-center border border-dark-700">
            <p className="text-lg font-bold text-brand-400 leading-none">{totalWatched}</p>
            <p className="text-[10px] text-gray-400 mt-1">Total assistido</p>
          </div>
          <div className="bg-dark-800 p-3 rounded-xl text-center border border-dark-700">
            <p className="text-lg font-bold text-teal-400 leading-none">{watchingCount}</p>
            <p className="text-[10px] text-gray-400 mt-1">Assistindo</p>
          </div>
          <div className="bg-dark-800 p-3 rounded-xl text-center border border-dark-700">
            <p className="text-lg font-bold text-purple-400 leading-none">{avgPerSeries}</p>
            <p className="text-[10px] text-gray-400 mt-1">Média/série</p>
          </div>
        </div>

        <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">Top Séries Assistidas</h4>
        {seriesWithEps.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhum episódio registrado ainda.</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {seriesWithEps.slice(0, 6).map((show) => {
              const poster = getPosterUrl(show.posterPath, 'w92');
              return (
                <div key={show.showId} className="flex items-center gap-3 p-2 rounded-xl bg-dark-800/60 border border-dark-700/50">
                  <div className="w-8 h-11 rounded bg-dark-700 overflow-hidden shrink-0">
                    {poster ? (
                      <img src={poster} alt={show.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-dark-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{show.title}</p>
                    <p className="text-[10px] text-gray-400">{show.watchedCount} de {show.totalEpisodes} episódios</p>
                  </div>
                  <span className="text-xs font-bold text-brand-400 bg-brand-500/10 px-2 py-1 rounded-lg shrink-0">
                    {show.watchedCount} ep
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const WatchTimeModal = ({
  open,
  onClose,
  totalMinutes,
}: {
  open: boolean;
  onClose: () => void;
  totalMinutes: number;
}) => {
  if (!open) return null;

  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const mins = totalMinutes % 60;

  const totalHoursNum = (totalMinutes / 60).toFixed(1);
  const moviesEquivalent = Math.round(totalMinutes / 120);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[80vh] overflow-y-auto bg-dark-900 rounded-2xl p-5 border border-dark-700 shadow-2xl shadow-black relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-dark-700">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-none">Tempo Assistido</h3>
              <p className="text-xs text-gray-400 mt-1">Detalhamento das suas horas dedicadas</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="bg-gradient-to-br from-brand-600/20 to-purple-600/20 border border-brand-500/30 p-4 rounded-2xl text-center mb-5">
          <p className="text-xs text-gray-300 font-medium uppercase tracking-wider">Tempo Total Acumulado</p>
          <p className="text-2xl sm:text-3xl font-extrabold gradient-text mt-1">
            {days > 0 ? `${days}d ` : ''}{hours}h {mins}m
          </p>
        </div>

        <div className="space-y-3 mb-5">
          <div className="flex justify-between items-center bg-dark-800 p-3 rounded-xl border border-dark-700 text-sm">
            <span className="text-gray-400">Total em Horas</span>
            <span className="font-bold text-white">{totalHoursNum}h</span>
          </div>
          <div className="flex justify-between items-center bg-dark-800 p-3 rounded-xl border border-dark-700 text-sm">
            <span className="text-gray-400">Total em Minutos</span>
            <span className="font-bold text-white">{totalMinutes.toLocaleString('pt-BR')} min</span>
          </div>
          <div className="flex justify-between items-center bg-dark-800 p-3 rounded-xl border border-dark-700 text-sm">
            <span className="text-gray-400">Equivalência aproximada</span>
            <span className="font-bold text-brand-400">~{moviesEquivalent} filmes (2h)</span>
          </div>
        </div>

        <div className="p-3 bg-dark-800/40 rounded-xl border border-dark-700/40 text-xs text-gray-400 leading-relaxed">
          💡 O tempo é calculado somando a duração de cada episódio ou filme assistido na sua conta.
        </div>
      </div>
    </div>
  );
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [userShows, setUserShows] = useState<UserShow[]>([]);
  const [following, setFollowing] = useState<FollowingInfo[]>([]);
  const [episodesModalOpen, setEpisodesModalOpen] = useState(false);
  const [watchTimeModalOpen, setWatchTimeModalOpen] = useState(false);

  const { data: recommendedData, isLoading: trendingLoading } = useQuery({
    queryKey: ['recommended'],
    queryFn: () => getTrendingTVShows(),
  });

  const { data: recommendedMovies, isLoading: moviesLoading } = useQuery({
    queryKey: ['recommended-movies'],
    queryFn: () => getTrendingMovies(),
    staleTime: 3600000,
  });

  const weekSeed = getWeekSeed();
  const recommended = recommendedData
    ? seededShuffle(recommendedData, weekSeed).slice(0, 10)
    : [];

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserShows(user.uid, setUserShows);
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToFollowing(user.uid, setFollowing);
    return unsub;
  }, [user]);

  const lists = userShows
    .filter((s) => s.status !== 'plan_to_watch' && s.status !== 'completed' && s.watchedCount > 0)
    .sort((a, b) => {
      const ta = a.lastWatchedAt ? new Date(a.lastWatchedAt).getTime() : 0;
      const tb = b.lastWatchedAt ? new Date(b.lastWatchedAt).getTime() : 0;
      return tb - ta;
    });
  const favorites = userShows.filter((s) => s.isFavorite);
  const totalWatched = userShows.reduce((sum, s) => sum + s.watchedCount, 0);
  const totalMinutes = userProfile?.totalWatchMinutes ?? 0;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);

  const avatarLetter = (userProfile?.displayName || user?.displayName || user?.email || 'U')[0].toUpperCase();
  const bannerRaw = getBannerUrl(userShows, userProfile?.bannerShowId ?? null);
  const bannerUrl = bannerRaw ? getBackdropUrl(bannerRaw) : null;
  const avatarUrl = userProfile?.photoURL || user?.photoURL || null;

  const handlePickBanner = async (showId: number | string | null) => {
    if (!user) return;
    setSavingBanner(true);
    try {
      await setBannerShow(user.uid, showId);
      setPickerOpen(false);
    } catch (err) {
      console.error('Erro ao definir banner:', err);
    } finally {
      setSavingBanner(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-28 md:pb-0">
      {/* Banner + avatar */}
      <div className="relative">
        <div
          className="h-36 md:h-44 w-full bg-brand-600 overflow-hidden cursor-pointer group relative"
          onClick={() => setPickerOpen(true)}
          title="Trocar banner"
        >
          {bannerUrl ? (
            <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
          ) : null}
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_20%,white,transparent_45%)] group-hover:bg-brand-900/30 transition-colors" />
          <div className="absolute bottom-2 right-3 text-xs text-white/80 bg-dark-900/50 px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
            {userShows.length === 0 ? 'Adicione séries para escolher um banner' : 'Trocar banner'}
          </div>
        </div>

        <div className="px-4 md:px-6 relative z-10">
          <div className="-mt-10 md:-mt-12 flex items-end">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-brand-500 flex items-center justify-center overflow-hidden shadow-xl ring-4 ring-dark-900 shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-3xl">{avatarLetter}</span>
              )}
            </div>
          </div>
          <div className="mt-3 md:mt-4">
            <h1 className="text-xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Olá, <span className="gradient-text">{user?.displayName?.split(' ')[0] || 'Usuário'}</span> 👋
            </h1>
            <p className="text-gray-400 mt-1 text-sm md:text-base leading-snug">
              Acompanhe suas séries e descubra novidades
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 mt-6">

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        <StatCard
          value={userShows.length}
          label="Na lista"
          title="Clique para ir para Minha Lista"
          onClick={() => navigate('/watchlist?tab=series')}
        />
        <StatCard
          value={totalWatched}
          label="Ep. assistidos"
          title="Clique para ver estatísticas de episódios"
          onClick={() => setEpisodesModalOpen(true)}
        />
        <StatCard
          value={formatWatchTimeShort(totalMinutes)}
          label="Assistidas"
          title="Clique para ver detalhamento do tempo assistido"
          onClick={() => setWatchTimeModalOpen(true)}
        />
        <StatCard
          value={userShows.filter((s) => s.status === 'completed').length}
          label="Concluídas"
          title="Clique para ver séries concluídas"
          onClick={() => navigate('/watchlist?tab=series&filter=completed')}
        />
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
            {lists.slice(0, 3).map((show) => (
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

      {/* Following */}
      {following.length > 0 && (
        <section className="mb-8">
          <h2 className="section-title mb-4">Seguindo</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {following.map((f) => (
              <Link
                key={f.targetId}
                to={`/user/${f.targetId}`}
                className="card-hover flex flex-col items-center gap-1.5 p-3 min-w-20 shrink-0 rounded-xl"
              >
                <div className="w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center overflow-hidden">
                  {f.photoURL ? (
                    <img src={f.photoURL} alt={f.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-lg">
                      {(f.displayName || 'U')[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-300 truncate max-w-16 text-center">
                  {f.displayName?.split(' ')[0] || 'Usuário'}
                </span>
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
            {recommended.map((show: TVShow) => (
              <ShowCard key={show.id} show={show} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="section-title mb-4">Filmes recomendados</h2>
        {moviesLoading ? (
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
            {recommendedMovies?.map((movie: TMDBMovieSimple) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        )}
      </section>

      <BannerPickerModal
        open={pickerOpen}
        shows={userShows}
        currentBannerShowId={userProfile?.bannerShowId ?? null}
        saving={savingBanner}
        onClose={() => setPickerOpen(false)}
        onPick={handlePickBanner}
      />

      <WatchedEpisodesModal
        open={episodesModalOpen}
        onClose={() => setEpisodesModalOpen(false)}
        shows={userShows}
        totalWatched={totalWatched}
      />

      <WatchTimeModal
        open={watchTimeModalOpen}
        onClose={() => setWatchTimeModalOpen(false)}
        totalMinutes={totalMinutes}
      />
      </div>
    </div>
  );
};

export default HomePage;
