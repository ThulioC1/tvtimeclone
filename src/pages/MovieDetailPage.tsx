import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getMovieDetails } from '../lib/omdb';
import {
  addMovieToWatchlist,
  removeShowFromWatchlist,
  updateShowStatus,
  toggleFavorite,
  subscribeToUserShows,
  type UserShow,
  type ShowStatus,
} from '../lib/firestore';
import { getYouTubeTrailer } from '../lib/youtube';

const BackIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
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

const MovieDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [userShow, setUserShow] = useState<UserShow | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [trailerId, setTrailerId] = useState<string | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [watchedLoading, setWatchedLoading] = useState(false);

  const showId = id ?? '';

  const { data: movie, isLoading } = useQuery({
    queryKey: ['movie', showId],
    queryFn: () => getMovieDetails(showId),
    enabled: !!showId,
  });

  useEffect(() => {
    if (!user || !showId) return;
    const unsub = subscribeToUserShows(user.uid, (shows) => {
      const found = shows.find((s) => s.showId === showId) ?? null;
      setUserShow(found);
      setIsFav(found?.isFavorite ?? false);
    });
    return () => { unsub(); };
  }, [user, showId]);

  useEffect(() => {
    if (!movie) return;
    let cancelled = false;
    getYouTubeTrailer(movie.Title).then((id) => {
      if (!cancelled) setTrailerId(id);
    });
    return () => { cancelled = true; };
  }, [movie]);

  const handleAddToList = async () => {
    if (!user || !movie) return;
    await addMovieToWatchlist(user.uid, movie);
  };

  const handleRemoveFromList = async () => {
    if (!user) return;
    await removeShowFromWatchlist(user.uid, showId as any);
  };

  const handleStatusChange = async (status: ShowStatus) => {
    if (!user) return;
    setStatusUpdating(true);
    try {
      await updateShowStatus(user.uid, showId as any, status);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleToggleFav = async () => {
    if (!user) return;
    const next = !isFav;
    setIsFav(next);
    try {
      await toggleFavorite(user.uid, showId as any, next);
    } catch {
      setIsFav(!next);
    }
  };

  const handleToggleWatched = async () => {
    if (!user) return;
    setWatchedLoading(true);
    try {
      const ref = doc(db, 'users', user.uid, 'userShows', showId);
      if (userShow && userShow.watchedCount > 0) {
        await updateDoc(ref, { watchedCount: 0, lastWatchedAt: null });
      } else {
        await updateDoc(ref, { watchedCount: 1, lastWatchedAt: serverTimestamp() });
      }
    } finally {
      setWatchedLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="w-8 h-8 border-4 border-dark-400 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Filme não encontrado</p>
      </div>
    );
  }

  const posterUrl = movie.Poster !== 'N/A' ? movie.Poster : null;
  const isInList = !!userShow;
  const imdbRating = movie.imdbRating !== 'N/A' ? parseFloat(movie.imdbRating) : 0;
  const year = movie.Year !== 'N/A' ? movie.Year : '';
  const runtime = movie.Runtime !== 'N/A' ? movie.Runtime : '';
  const genre = movie.Genre !== 'N/A' ? movie.Genre : '';
  const director = movie.Director !== 'N/A' ? movie.Director : '';
  const actors = movie.Actors !== 'N/A' ? movie.Actors : '';
  const awards = movie.Awards !== 'N/A' ? movie.Awards : '';
  const plot = movie.Plot !== 'N/A' ? movie.Plot : '';
  const rated = movie.Rated !== 'N/A' ? movie.Rated : '';

  return (
    <div className="max-w-3xl mx-auto">
      <div className="relative h-60 md:h-80 overflow-hidden">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={movie.Title}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.querySelector('.hero-fallback')?.classList.remove('hidden'); }}
          />
        ) : null}
        <div className={`hero-fallback ${posterUrl ? 'hidden' : ''} absolute inset-0 bg-gradient-to-br from-dark-600 to-dark-800`} />
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
          <div className="w-28 h-40 md:w-32 md:h-48 rounded-2xl overflow-hidden bg-dark-600 shrink-0 border border-white/10 shadow-2xl shadow-black/60 ring-1 ring-white/5">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={movie.Title}
                loading="lazy"
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.classList.add('bg-dark-500'); }}
              />
            ) : (
              <div className="w-full h-full bg-dark-500" />
            )}
          </div>

          <div className="pt-16 md:pt-20 flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-extrabold text-white leading-tight tracking-tight drop-shadow">{movie.Title}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-400">
              {year && <span>{year}</span>}
              {runtime && <span>{runtime}</span>}
              {imdbRating > 0 && (
                <span className="flex items-center gap-1">
                  <StarIcon /> {imdbRating.toFixed(1)}
                </span>
              )}
              {rated && (
                <span className="badge bg-gray-500/20 text-gray-400">{rated}</span>
              )}
            </div>
            {genre && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {genre.split(', ').map((g) => (
                  <span key={g} className="badge bg-brand-500/10 text-brand-400 text-xs">{g}</span>
                ))}
              </div>
            )}
          </div>
        </div>

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

        {isInList && (
          <div className="card p-4 mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Progresso</span>
              <span className="text-brand-400 font-semibold">
                {userShow.watchedCount}/{userShow.totalEpisodes} assistido
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${userShow.totalEpisodes > 0 ? (userShow.watchedCount / userShow.totalEpisodes) * 100 : 0}%`,
                }}
              />
            </div>
            <button
              onClick={handleToggleWatched}
              disabled={watchedLoading}
              className={`btn-primary w-full text-sm mt-3 disabled:opacity-50 ${
                userShow.watchedCount > 0 ? 'bg-dark-600 hover:bg-dark-500' : ''
              }`}
            >
              {watchedLoading
                ? 'Processando...'
                : userShow.watchedCount > 0
                  ? 'Desmarcar como assistido'
                  : '✓ Marcar como assistido'}
            </button>
          </div>
        )}

        {imdbRating > 0 && (
          <div className="card p-4 mt-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-yellow-400/10 flex items-center justify-center shrink-0">
              <StarIcon />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">IMDb Rating</p>
              <p className="text-xs text-gray-400">{imdbRating.toFixed(1)}/10</p>
            </div>
          </div>
        )}

        {trailerId && (
          <div className="mt-5">
            <h2 className="section-title mb-2">Trailer</h2>
            <div className="relative w-full rounded-2xl overflow-hidden bg-dark-600" style={{ paddingTop: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${trailerId}`}
                title={`Trailer de ${movie.Title}`}
                frameBorder={0}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}

        {plot && (
          <div className="mt-5">
            <h2 className="section-title mb-2">Sinopse</h2>
            <p className="text-gray-300 text-sm leading-relaxed">{plot}</p>
          </div>
        )}

        <div className="mt-5 space-y-3">
          {director && (
            <div>
              <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Diretor</h3>
              <p className="text-sm text-white">{director}</p>
            </div>
          )}
          {actors && (
            <div>
              <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Elenco</h3>
              <p className="text-sm text-white">{actors}</p>
            </div>
          )}
          {awards && (
            <div>
              <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Prêmios</h3>
              <p className="text-sm text-white">{awards}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MovieDetailPage;
