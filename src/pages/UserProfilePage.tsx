import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getUserProfile,
  getUserShows,
  getBannerUrl,
  type UserProfile,
  type UserShow,
} from '../lib/firestore';
import { getBackdropUrl, getPosterUrl } from '../lib/tmdb';
import { formatWatchTime } from '../lib/format';

const UserProfilePage: React.FC = () => {
  const { uid: rawUid } = useParams<{ uid: string }>();
  const uid = rawUid ?? '';
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [shows, setShows] = useState<UserShow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !user) return;
    setLoading(true);

    const load = async () => {
      const [prof, userShows] = await Promise.all([
        getUserProfile(uid).catch(() => null),
        getUserShows(uid).catch(() => [] as UserShow[]),
      ]);
      setProfile(prof);
      setShows(userShows);
      setLoading(false);
    };

    load().catch(() => setLoading(false));
  }, [uid, user]);

  const watching = shows.filter((s) => s.status === 'watching');
  const favorites = shows.filter((s) => s.isFavorite);

  const bannerRaw = getBannerUrl(shows, profile?.bannerShowId ?? null);
  const bannerUrl = bannerRaw ? getBackdropUrl(bannerRaw) : null;

  if (loading || !profile) {
    return (
      <div className="max-w-2xl mx-auto pb-28 md:pb-0 px-4 py-12">
        <p className="text-gray-400 text-center">{loading ? 'Carregando...' : 'Usuário não encontrado.'}</p>
      </div>
    );
  }

  const avatarLetter = (profile.displayName || 'U')[0].toUpperCase();
  const isSelf = user?.uid === uid;

  return (
    <div className="max-w-2xl mx-auto pb-28 md:pb-0">
      {/* Banner */}
      <div className="relative">
        <div className="h-40 md:h-52 w-full bg-brand-600 overflow-hidden">
          {bannerUrl && (
            <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_20%,white,transparent_45%)]" />
        </div>
        <div className="px-4 md:px-6 relative z-10">
          <div className="-mt-14 md:-mt-16 flex items-end">
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-3xl bg-brand-500 flex items-center justify-center overflow-hidden shadow-xl ring-4 ring-dark-900 shrink-0">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-4xl">{avatarLetter}</span>
              )}
            </div>
          </div>
          <div className="mt-3 md:mt-4">
            <h2 className="text-xl md:text-2xl font-extrabold text-white">
              {profile.displayName || 'Usuário'}
              {isSelf && <span className="ml-2 text-sm text-brand-400 font-normal">(você)</span>}
            </h2>
            <p className="text-sm text-gray-400 mt-1">{profile.email}</p>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 mt-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
          <div className="card p-4 sm:p-5 rounded-2xl">
            <div className="text-2xl sm:text-3xl font-bold gradient-text leading-none">{shows.filter((s) => s.mediaType !== 'movie').length}</div>
            <div className="text-xs sm:text-sm text-gray-400 mt-2 leading-tight">Séries na lista</div>
          </div>
          <div className="card p-4 sm:p-5 rounded-2xl">
            <div className="text-2xl sm:text-3xl font-bold gradient-text leading-none">{shows.reduce((s, sh) => s + sh.watchedCount, 0)}</div>
            <div className="text-xs sm:text-sm text-gray-400 mt-2 leading-tight">Episódios assistidos</div>
          </div>
          <div className="card p-4 sm:p-5 rounded-2xl">
            <div className="text-2xl sm:text-3xl font-bold gradient-text leading-none">{formatWatchTime(profile.totalWatchMinutes || 0)}</div>
            <div className="text-xs sm:text-sm text-gray-400 mt-2 leading-tight">Tempo assistido</div>
          </div>
          <div className="card p-4 sm:p-5 rounded-2xl">
            <div className="text-2xl sm:text-3xl font-bold gradient-text leading-none">{shows.filter((s) => s.mediaType !== 'movie' && s.status === 'completed').length}</div>
            <div className="text-xs sm:text-sm text-gray-400 mt-2 leading-tight">Séries concluídas</div>
          </div>
        </div>

        {/* Watching */}
        {watching.length > 0 && (
          <section className="mb-8">
            <h2 className="section-title mb-4">Assistindo</h2>
            <div className="space-y-2">
              {watching.slice(0, 5).map((s) => {
                const posterUrl = getPosterUrl(s.posterPath);
                const progress = s.totalEpisodes > 0 ? (s.watchedCount / s.totalEpisodes) * 100 : 0;
                return (
                  <Link key={s.showId} to={`/show/${s.showId}`} className="card-hover flex items-center gap-3 p-3">
                    <div className="w-10 h-14 rounded-lg overflow-hidden bg-dark-500 shrink-0">
                      {posterUrl ? (
                        <img src={posterUrl} alt={s.title} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-dark-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{s.title}</p>
                      <p className="text-xs text-gray-400 truncate">{s.watchedCount}/{s.totalEpisodes} eps</p>
                    </div>
                    <div className="w-16 shrink-0">
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Favorites */}
        {favorites.length > 0 && (
          <section className="mb-8">
            <h2 className="section-title mb-4">Favoritas</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {favorites.map((s) => (
                <Link key={s.showId} to={`/show/${s.showId}`} className="card-hover group block">
                  <div className="aspect-[2/3] rounded-xl overflow-hidden bg-dark-600">
                    {getPosterUrl(s.posterPath) ? (
                      <img src={getPosterUrl(s.posterPath)!} alt={s.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full bg-dark-500" />
                    )}
                  </div>
                  <p className="text-xs font-medium text-white truncate p-2">{s.title}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {watching.length === 0 && favorites.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">Nenhuma série para exibir.</p>
        )}
      </div>
    </div>
  );
};

export default UserProfilePage;
