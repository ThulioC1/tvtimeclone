import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getMovieDetails as tmdbGetMovieDetails, getMovieVideos, getPosterUrl, getBackdropUrl, type TMDBMovieDetail } from '../lib/tmdb';
import { getMovieDetails as omdbGetMovieDetails } from '../lib/omdb';
import {
  addMovieToWatchlist,
  removeShowFromWatchlist,
  updateShowStatus,
  toggleFavorite,
  subscribeToUserShows,
  submitRating,
  getUserRating,
  subscribeToMediaRatings,
  type UserShow,
  type ShowStatus,
} from '../lib/firestore';
import DisqusComments from '../components/DisqusComments';
import RatingStars from '../components/RatingStars';

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
  const [userRating, setUserRating] = useState<number>(0);
  const [avgRating, setAvgRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);

  const movieId = id ?? '';
  const isImdbId = movieId.startsWith('tt');

  const { data: movie, isLoading } = useQuery({
    queryKey: ['movie', movieId],
    queryFn: async () => {
      if (isImdbId) {
        const omdb = await omdbGetMovieDetails(movieId);
        return {
          id: 0,
          title: omdb.Title,
          release_date: omdb.Year !== 'N/A' ? omdb.Year : '',
          runtime: omdb.Runtime !== 'N/A' ? parseInt(omdb.Runtime) || null : null,
          genres: omdb.Genre !== 'N/A' ? omdb.Genre.split(', ').map((n, i) => ({ id: i, name: n })) : [],
          overview: omdb.Plot !== 'N/A' ? omdb.Plot : '',
          poster_path: omdb.Poster !== 'N/A' ? omdb.Poster : null,
          backdrop_path: omdb.Poster !== 'N/A' ? omdb.Poster : null,
          vote_average: omdb.imdbRating !== 'N/A' ? parseFloat(omdb.imdbRating) : 0,
          vote_count: 0,
          imdb_id: omdb.imdbID,
          director: omdb.Director !== 'N/A' ? omdb.Director : '',
          writers: omdb.Writer !== 'N/A' ? omdb.Writer.split(', ').map((w) => w.trim()) : [],
          actors: omdb.Actors !== 'N/A' ? omdb.Actors.split(', ').map((n) => ({ name: n.trim(), character: '' })) : [],
          production_companies: omdb.Production !== 'N/A' ? [omdb.Production] : [],
          tagline: '',
          status: '',
          budget: 0,
          revenue: 0,
        } as TMDBMovieDetail;
      }
      return tmdbGetMovieDetails(Number(movieId));
    },
    enabled: !!movieId,
  });

  useEffect(() => {
    if (!user || !movieId) return;
    const unsub = subscribeToUserShows(user.uid, (shows) => {
      const found = shows.find((s) => s.showId === movieId) ?? null;
      setUserShow(found);
      setIsFav(found?.isFavorite ?? false);
    });
    return () => { unsub(); };
  }, [user, movieId]);

  useEffect(() => {
    if (!movie) return;
    let cancelled = false;
    if (movie.id > 0) {
      getMovieVideos(movie.id).then((videos) => {
        if (!cancelled) {
          const trailer = videos.find((v) => v.key) ?? null;
          if (trailer) setTrailerId(trailer.key);
        }
      });
    } else {
      import('../lib/youtube').then(({ getYouTubeTrailer }) => {
        getYouTubeTrailer(movie.title).then((id) => {
          if (!cancelled) setTrailerId(id);
        });
      });
    }
    return () => { cancelled = true; };
  }, [movie]);

  useEffect(() => {
    if (!movie || movie.id === 0) return;
    const unsub = subscribeToMediaRatings(movie.id, 'movie', (data) => {
      setAvgRating(data.average);
      setRatingCount(data.count);
    });
    return unsub;
  }, [movie]);

  useEffect(() => {
    if (!user || !movie || movie.id === 0) return;
    getUserRating(user.uid, movie.id, 'movie').then((r) => setUserRating(r ?? 0));
  }, [user, movie]);

  const handleRate = async (rating: number) => {
    if (!user || !movie || movie.id === 0) return;
    setUserRating(rating);
    await submitRating(user.uid, user.displayName || 'Anônimo', user.photoURL, movie.id, 'movie', rating);
  };

  const handleAddToList = async () => {
    if (!user || !movie) return;
    if (isImdbId) {
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const ref = doc(db, 'users', user.uid, 'userShows', movieId);
      await setDoc(ref, {
        showId: movieId,
        title: movie.title,
        posterPath: movie.poster_path,
        backdropPath: movie.backdrop_path,
        status: 'plan_to_watch' as const,
        mediaType: 'movie' as const,
        totalEpisodes: 1,
        totalSeasons: 0,
        watchedCount: 0,
        addedAt: serverTimestamp(),
        lastWatchedAt: null,
        isFavorite: false,
        genres: movie.genres.map((g) => g.name),
      });
    } else {
      await addMovieToWatchlist(user.uid, movie);
    }
  };

  const handleRemoveFromList = async () => {
    if (!user) return;
    await removeShowFromWatchlist(user.uid, movieId);
  };

  const handleStatusChange = async (status: ShowStatus) => {
    if (!user) return;
    setStatusUpdating(true);
    try {
      await updateShowStatus(user.uid, movieId, status);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleToggleFav = async () => {
    if (!user) return;
    const next = !isFav;
    setIsFav(next);
    try {
      await toggleFavorite(user.uid, movieId, next);
    } catch {
      setIsFav(!next);
    }
  };

  const handleToggleWatched = async () => {
    if (!user) return;
    setWatchedLoading(true);
    try {
      const ref = doc(db, 'users', user.uid, 'userShows', movieId);
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

  const backdropUrl = getBackdropUrl(movie.backdrop_path, 'w1280');
  const posterUrl = getPosterUrl(movie.poster_path, 'w342');
  const isInList = !!userShow;
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : '';
  const runtime = movie.runtime ? `${movie.runtime} min` : '';
  const genreStr = movie.genres.map((g) => g.name).join(', ');

  return (
    <div className="max-w-3xl mx-auto">
      <div className="relative h-60 md:h-80 overflow-hidden">
        {backdropUrl ? (
          <img
            src={backdropUrl}
            alt={movie.title}
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
            const text = `Veja "${movie?.title || ''}" no Time to Watch!`;
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
          <div className="w-28 h-40 md:w-32 md:h-48 rounded-2xl overflow-hidden bg-dark-600 shrink-0 border border-white/10 shadow-2xl shadow-black/60 ring-1 ring-white/5">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={movie.title}
                loading="lazy"
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.classList.add('bg-dark-500'); }}
              />
            ) : (
              <div className="w-full h-full bg-dark-500" />
            )}
          </div>

          <div className="pt-16 md:pt-20 flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-extrabold text-white leading-tight tracking-tight drop-shadow">{movie.title}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-400">
              {year && <span>{year}</span>}
              {runtime && <span>{runtime}</span>}
              {movie.vote_average > 0 && (
                <span className="flex items-center gap-1">
                  <StarIcon /> {movie.vote_average.toFixed(1)}
                </span>
              )}
            </div>
            {genreStr && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {movie.genres.map((g) => (
                  <span key={g.id} className="badge bg-brand-500/10 text-brand-400 text-xs">{g.name}</span>
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

        {movie.vote_average > 0 && (
          <div className="card p-4 mt-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-yellow-400/10 flex items-center justify-center shrink-0">
              <StarIcon />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Avaliação</p>
              <p className="text-xs text-gray-400">{movie.vote_average.toFixed(1)}/10</p>
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
                title={`Trailer de ${movie.title}`}
                frameBorder={0}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}

        {movie.tagline && (
          <div className="mt-5">
            <p className="text-sm text-gray-400 italic">"{movie.tagline}"</p>
          </div>
        )}

        {movie.overview && (
          <div className="mt-5">
            <h2 className="section-title mb-2">Sinopse</h2>
            <p className="text-gray-300 text-sm leading-relaxed">{movie.overview}</p>
          </div>
        )}

        <div className="mt-5 space-y-3">
          {movie.director && (
            <div>
              <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Diretor</h3>
              <p className="text-sm text-white">{movie.director}</p>
            </div>
          )}
          {movie.writers.length > 0 && (
            <div>
              <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Roteiristas</h3>
              <p className="text-sm text-white">{movie.writers.join(', ')}</p>
            </div>
          )}
          {movie.actors.length > 0 && (
            <div>
              <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Elenco</h3>
              <p className="text-sm text-white">
                {movie.actors.slice(0, 8).map((a) => a.name).join(', ')}
              </p>
            </div>
          )}
          {movie.production_companies.length > 0 && (
            <div>
              <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Produção</h3>
              <p className="text-sm text-white">{movie.production_companies.join(', ')}</p>
            </div>
          )}
        </div>

        {/* ── Ratings ───────────────────────────────────────────────────── */}
        {movie.id > 0 && (
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
        {movie.id > 0 && (
          <DisqusComments mediaId={movie.id} mediaType="movie" title={movie.title} />
        )}
      </div>
    </div>
  );
};

export default MovieDetailPage;
