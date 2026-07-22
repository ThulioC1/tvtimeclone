import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  startAt,
  endAt,
  limit,
  serverTimestamp,
  onSnapshot,
  writeBatch,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { TVShow } from './tmdb';
import type { TMDBMovieDetail } from './tmdb';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ShowStatus = 'watching' | 'completed' | 'dropped' | 'plan_to_watch';
export type MediaType = 'tv' | 'movie';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  coverURL: string | null;
  bannerShowId: number | null;
  createdAt: Date;
  totalWatchMinutes: number;
}

export interface UserShow {
  showId: string | number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  status: ShowStatus;
  mediaType?: MediaType;
  totalEpisodes: number;
  watchedCount: number;
  addedAt: Date;
  lastWatchedAt: Date | null;
  totalSeasons: number;
  isFavorite: boolean;
  genres?: string[];
  source?: 'tvmaze' | 'tmdb';
}

export interface WatchedEpisode {
  seasonNumber: number;
  episodeNumber: number;
  watchedAt: Date;
  runtime?: number;
}

// ── User Profile ──────────────────────────────────────────────────────────────

export const createUserProfile = async (
  uid: string,
  data: Partial<UserProfile>
): Promise<void> => {
  const ref = doc(db, 'users', uid);
  await setDoc(ref, {
    uid,
    displayName: data.displayName || '',
    email: data.email || '',
    photoURL: data.photoURL || null,
    coverURL: data.coverURL || null,
    bannerShowId: data.bannerShowId ?? null,
    createdAt: serverTimestamp(),
    totalWatchMinutes: 0,
  });
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as UserProfile) : null;
};

export const updateUserProfile = async (
  uid: string,
  data: Partial<UserProfile>
): Promise<void> => {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, data);
};

export const setBannerShow = async (uid: string, showId: number | string | null): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), { bannerShowId: showId });
};

export const getBannerUrl = (
  shows: UserShow[],
  bannerShowId: number | string | null
): string | null => {
  if (bannerShowId == null) return null;
  const show = shows.find((s) => String(s.showId) === String(bannerShowId));
  if (!show) return null;
  return show.backdropPath || show.posterPath || null;
};

// ── User Shows ────────────────────────────────────────────────────────────────

export const addShowToWatchlist = async (
  uid: string,
  show: TVShow,
  status: ShowStatus = 'watching'
): Promise<void> => {
  const ref = doc(db, 'users', uid, 'userShows', String(show.id));
  const totalEpisodes =
    show.seasons
      ?.filter((s) => s.season_number > 0)
      .reduce((sum, s) => sum + s.episode_count, 0) ?? show.number_of_episodes ?? 0;

  await setDoc(ref, {
    showId: String(show.id),
    title: show.name,
    posterPath: show.poster_path,
    backdropPath: show.backdrop_path,
    status,
    mediaType: 'tv',
    totalEpisodes,
    totalSeasons: show.number_of_seasons ?? show.seasons?.filter((s) => s.season_number > 0).length ?? 1,
    watchedCount: 0,
    addedAt: serverTimestamp(),
    lastWatchedAt: null,
    isFavorite: false,
    genres: show.genres?.map((g) => g.name) ?? [],
    source: 'tmdb',
  } satisfies Omit<UserShow, 'addedAt' | 'lastWatchedAt'> & { addedAt: any; lastWatchedAt: any });
};

export const addMovieToWatchlist = async (
  uid: string,
  movie: TMDBMovieDetail,
  status: ShowStatus = 'plan_to_watch'
): Promise<void> => {
  const ref = doc(db, 'users', uid, 'userShows', String(movie.id));
  await setDoc(ref, {
    showId: String(movie.id),
    title: movie.title,
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
    status,
    mediaType: 'movie',
    totalEpisodes: 1,
    totalSeasons: 0,
    watchedCount: 0,
    addedAt: serverTimestamp(),
    lastWatchedAt: null,
    isFavorite: false,
    genres: movie.genres.map((g) => g.name),
    source: 'tmdb',
  } satisfies Omit<UserShow, 'addedAt' | 'lastWatchedAt'> & { addedAt: any; lastWatchedAt: any });
};

export const removeShowFromWatchlist = async (uid: string, showId: string | number): Promise<void> => {
  const ref = doc(db, 'users', uid, 'userShows', String(showId));
  await deleteDoc(ref);
  // Also remove all episodes (harmless for movies, no episodes subcollection)
  const episodesRef = collection(db, 'users', uid, 'userShows', String(showId), 'episodes');
  const episodesSnap = await getDocs(episodesRef);
  const deletePromises = episodesSnap.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletePromises);
};

export const updateShowStatus = async (
  uid: string,
  showId: string | number,
  status: ShowStatus
): Promise<void> => {
  const ref = doc(db, 'users', uid, 'userShows', String(showId));
  await updateDoc(ref, { status });
};

export const toggleFavorite = async (
  uid: string,
  showId: string | number,
  isFavorite: boolean
): Promise<void> => {
  const ref = doc(db, 'users', uid, 'userShows', String(showId));
  await updateDoc(ref, { isFavorite });
};

export const getUserShows = async (uid: string): Promise<UserShow[]> => {
  const ref = collection(db, 'users', uid, 'userShows');
  const q = query(ref, orderBy('addedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as UserShow);
};

export const subscribeToUserShows = (
  uid: string,
  callback: (shows: UserShow[]) => void
): Unsubscribe => {
  const ref = collection(db, 'users', uid, 'userShows');
  const q = query(ref, orderBy('addedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => d.data() as UserShow));
    },
    (err) => {
      console.error('Erro ao ler séries do usuário:', err);
    }
  );
};

// ── Episodes ──────────────────────────────────────────────────────────────────

export const getEpisodeId = (seasonNumber: number, episodeNumber: number) =>
  `s${seasonNumber}e${episodeNumber}`;

export const markEpisodeWatched = async (
  uid: string,
  showId: number,
  seasonNumber: number,
  episodeNumber: number,
  runtime?: number
): Promise<void> => {
  const episodeId = getEpisodeId(seasonNumber, episodeNumber);
  const ref = doc(db, 'users', uid, 'userShows', String(showId), 'episodes', episodeId);

  // Prevent double-counting: if the episode doc already exists, just bump timestamp.
  const existingSnap = await getDoc(ref);
  if (existingSnap.exists()) {
    await updateDoc(ref, { watchedAt: serverTimestamp() });
    return;
  }

  const effectiveRuntime = typeof runtime === 'number' && runtime > 0 ? runtime : 30;
  await setDoc(ref, {
    seasonNumber,
    episodeNumber,
    watchedAt: serverTimestamp(),
    runtime: effectiveRuntime,
  });

  const showRef = doc(db, 'users', uid, 'userShows', String(showId));
  const showSnap = await getDoc(showRef);
  if (showSnap.exists()) {
    const current = showSnap.data() as UserShow;
    await updateDoc(showRef, {
      watchedCount: current.watchedCount + 1,
      lastWatchedAt: serverTimestamp(),
    });
  }

  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const profile = userSnap.data() as UserProfile;
    await updateDoc(userRef, {
      totalWatchMinutes: (profile.totalWatchMinutes || 0) + effectiveRuntime,
    });
  }
};

export const setEpisodeWatchedAt = async (
  uid: string,
  showId: number,
  seasonNumber: number,
  episodeNumber: number,
  watchedAt: Date
): Promise<void> => {
  const episodeId = getEpisodeId(seasonNumber, episodeNumber);
  const ref = doc(db, 'users', uid, 'userShows', String(showId), 'episodes', episodeId);
  await updateDoc(ref, { watchedAt });

  const showRef = doc(db, 'users', uid, 'userShows', String(showId));
  const showSnap = await getDoc(showRef);
  if (showSnap.exists()) {
    await updateDoc(showRef, { lastWatchedAt: watchedAt });
  }
};

export const unmarkEpisodeWatched = async (
  uid: string,
  showId: number,
  seasonNumber: number,
  episodeNumber: number,
  runtime?: number
): Promise<void> => {
  const episodeId = getEpisodeId(seasonNumber, episodeNumber);
  const ref = doc(db, 'users', uid, 'userShows', String(showId), 'episodes', episodeId);
  await deleteDoc(ref);

  const effectiveRuntime = typeof runtime === 'number' && runtime > 0 ? runtime : 30;

  const showRef = doc(db, 'users', uid, 'userShows', String(showId));
  const showSnap = await getDoc(showRef);
  if (showSnap.exists()) {
    const current = showSnap.data() as UserShow;
    await updateDoc(showRef, {
      watchedCount: Math.max(0, current.watchedCount - 1),
    });
  }

  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const profile = userSnap.data() as UserProfile;
    await updateDoc(userRef, {
      totalWatchMinutes: Math.max(0, (profile.totalWatchMinutes || 0) - effectiveRuntime),
    });
  }
};

export const getWatchedEpisodes = async (
  uid: string,
  showId: number
): Promise<Set<string>> => {
  const ref = collection(db, 'users', uid, 'userShows', String(showId), 'episodes');
  const snap = await getDocs(ref);
  return new Set(snap.docs.map((d) => d.id));
};

interface EpisodeInput {
  seasonNumber: number;
  episodeNumber: number;
  runtime?: number | null;
}

export const markAllEpisodesWatched = async (
  uid: string,
  showId: number,
  episodes: EpisodeInput[]
): Promise<void> => {
  const episodesRef = collection(db, 'users', uid, 'userShows', String(showId), 'episodes');
  const showRef = doc(db, 'users', uid, 'userShows', String(showId));
  const userRef = doc(db, 'users', uid);

  await runTransaction(db, async (transaction) => {
    const epEntries = episodes.map((ep) => ({
      ep,
      ref: doc(episodesRef, getEpisodeId(ep.seasonNumber, ep.episodeNumber)),
    }));

    const epSnaps = await Promise.all(
      epEntries.map(({ ref }) => transaction.get(ref))
    );

    const showSnap = await transaction.get(showRef);
    const userSnap = await transaction.get(userRef);

    let totalMinutes = 0;
    let newCount = 0;

    for (let i = 0; i < epEntries.length; i++) {
      if (epSnaps[i].exists()) continue;
      const { ep, ref } = epEntries[i];
      const rt = typeof ep.runtime === 'number' && ep.runtime > 0 ? ep.runtime : 30;
      transaction.set(ref, {
        seasonNumber: ep.seasonNumber,
        episodeNumber: ep.episodeNumber,
        watchedAt: serverTimestamp(),
        runtime: rt,
      });
      totalMinutes += rt;
      newCount += 1;
    }

    if (newCount > 0) {
      if (showSnap.exists()) {
        const current = showSnap.data() as UserShow;
        transaction.update(showRef, {
          watchedCount: current.watchedCount + newCount,
          lastWatchedAt: serverTimestamp(),
        });
      }
      if (userSnap.exists()) {
        const profile = userSnap.data() as UserProfile;
        transaction.update(userRef, {
          totalWatchMinutes: (profile.totalWatchMinutes || 0) + totalMinutes,
        });
      }
    }
  });
};

export const unmarkAllEpisodesWatched = async (
  uid: string,
  showId: number
): Promise<void> => {
  const episodesRef = collection(db, 'users', uid, 'userShows', String(showId), 'episodes');
  const showRef = doc(db, 'users', uid, 'userShows', String(showId));
  const userRef = doc(db, 'users', uid);

  const episodesSnap = await getDocs(episodesRef);
  const batch = writeBatch(db);

  let totalMinutes = 0;
  episodesSnap.docs.forEach((d) => {
    const rt = d.data().runtime;
    totalMinutes += typeof rt === 'number' && rt > 0 ? rt : 30;
    batch.delete(d.ref);
  });

  const showSnap = await getDoc(showRef);
  if (showSnap.exists()) {
    batch.update(showRef, { watchedCount: 0 });
  }
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const profile = userSnap.data() as UserProfile;
    batch.update(userRef, {
      totalWatchMinutes: Math.max(0, (profile.totalWatchMinutes || 0) - totalMinutes),
    });
  }
  await batch.commit();
};

export const markSeasonWatched = async (
  uid: string,
  showId: number,
  seasonNumber: number,
  episodes: EpisodeInput[]
): Promise<void> => {
  const episodesRef = collection(db, 'users', uid, 'userShows', String(showId), 'episodes');
  const showRef = doc(db, 'users', uid, 'userShows', String(showId));
  const userRef = doc(db, 'users', uid);

  await runTransaction(db, async (transaction) => {
    const seasonEpisodes = episodes.filter((ep) => ep.seasonNumber === seasonNumber);
    const epEntries = seasonEpisodes.map((ep) => ({
      ep,
      ref: doc(episodesRef, getEpisodeId(ep.seasonNumber, ep.episodeNumber)),
    }));

    const epSnaps = await Promise.all(
      epEntries.map(({ ref }) => transaction.get(ref))
    );

    const showSnap = await transaction.get(showRef);
    const userSnap = await transaction.get(userRef);

    let totalMinutes = 0;
    let newCount = 0;

    for (let i = 0; i < epEntries.length; i++) {
      if (epSnaps[i].exists()) continue;
      const { ep, ref } = epEntries[i];
      const rt = typeof ep.runtime === 'number' && ep.runtime > 0 ? ep.runtime : 30;
      transaction.set(ref, {
        seasonNumber: ep.seasonNumber,
        episodeNumber: ep.episodeNumber,
        watchedAt: serverTimestamp(),
        runtime: rt,
      });
      totalMinutes += rt;
      newCount += 1;
    }

    if (newCount > 0) {
      if (showSnap.exists()) {
        const current = showSnap.data() as UserShow;
        transaction.update(showRef, {
          watchedCount: current.watchedCount + newCount,
          lastWatchedAt: serverTimestamp(),
        });
      }
      if (userSnap.exists()) {
        const profile = userSnap.data() as UserProfile;
        transaction.update(userRef, {
          totalWatchMinutes: (profile.totalWatchMinutes || 0) + totalMinutes,
        });
      }
    }
  });
};

export const unmarkSeasonWatched = async (
  uid: string,
  showId: number,
  seasonNumber: number
): Promise<void> => {
  const episodesRef = collection(db, 'users', uid, 'userShows', String(showId), 'episodes');
  const showRef = doc(db, 'users', uid, 'userShows', String(showId));
  const userRef = doc(db, 'users', uid);

  const episodesSnap = await getDocs(episodesRef);
  const batch = writeBatch(db);

  let totalMinutes = 0;
  let removedCount = 0;
  episodesSnap.docs.forEach((d) => {
    const data = d.data() as { seasonNumber?: number; runtime?: number };
    if (data.seasonNumber !== seasonNumber) return;
    const rt = typeof data.runtime === 'number' && data.runtime > 0 ? data.runtime : 30;
    totalMinutes += rt;
    removedCount += 1;
    batch.delete(d.ref);
  });

  if (removedCount > 0) {
    const showSnap = await getDoc(showRef);
    if (showSnap.exists()) {
      const current = showSnap.data() as UserShow;
      batch.update(showRef, {
        watchedCount: Math.max(0, current.watchedCount - removedCount),
      });
    }
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const profile = userSnap.data() as UserProfile;
      batch.update(userRef, {
        totalWatchMinutes: Math.max(0, (profile.totalWatchMinutes || 0) - totalMinutes),
      });
    }
    await batch.commit();
  }
};

export const recalculateUserStats = async (uid: string): Promise<void> => {
  const showsRef = collection(db, 'users', uid, 'userShows');
  const showsSnap = await getDocs(showsRef);

  let totalMinutes = 0;
  const showUpdates: Promise<void>[] = [];

  for (const showDoc of showsSnap.docs) {
    const showId = showDoc.id;
    const episodesRef = collection(db, 'users', uid, 'userShows', showId, 'episodes');
    const episodesSnap = await getDocs(episodesRef);

    let watchedCount = 0;
    for (const epDoc of episodesSnap.docs) {
      const ep = epDoc.data() as { runtime?: number };
      const rt = typeof ep.runtime === 'number' && ep.runtime > 0 ? ep.runtime : 30;
      watchedCount += 1;
      totalMinutes += rt;
    }

    const current = showDoc.data() as UserShow;
    showUpdates.push(
      updateDoc(showDoc.ref, { watchedCount })
    );
    void current;
  }

  await Promise.all(showUpdates);
  await updateDoc(doc(db, 'users', uid), { totalWatchMinutes: totalMinutes });
};

export const subscribeToWatchedEpisodes = (
  uid: string,
  showId: number,
  callback: (episodeIds: Set<string>) => void
): Unsubscribe => {
  const ref = collection(db, 'users', uid, 'userShows', String(showId), 'episodes');
  return onSnapshot(
    ref,
    (snap) => {
      callback(new Set(snap.docs.map((d) => d.id)));
    },
    (err) => {
      console.error('Erro ao ler episódios assistidos:', err);
    }
  );
};

export interface WatchedEpisodeDoc {
  watchedAt: Date | null;
  runtime?: number;
}

// ── Ratings ────────────────────────────────────────────────────────────────────

export interface UserRating {
  userId: string;
  userName: string;
  userPhotoURL: string | null;
  mediaId: number;
  mediaType: 'movie' | 'tv';
  rating: number; // 1-5
  createdAt: Date;
}

export const submitRating = async (
  userId: string,
  userName: string,
  userPhotoURL: string | null,
  mediaId: number,
  mediaType: 'movie' | 'tv',
  rating: number
): Promise<void> => {
  const id = `${userId}_${mediaType}_${mediaId}`;
  const ref = doc(db, 'ratings', id);
  await setDoc(ref, {
    userId,
    userName,
    userPhotoURL,
    mediaId,
    mediaType,
    rating,
    createdAt: serverTimestamp(),
  });
};

export const getUserRating = async (
  userId: string,
  mediaId: number,
  mediaType: 'movie' | 'tv'
): Promise<number | null> => {
  const id = `${userId}_${mediaType}_${mediaId}`;
  const snap = await getDoc(doc(db, 'ratings', id));
  if (!snap.exists()) return null;
  return (snap.data() as UserRating).rating;
};

export const getMediaRatings = async (
  mediaId: number,
  mediaType: 'movie' | 'tv'
): Promise<{ ratings: UserRating[]; average: number; count: number }> => {
  const snap = await getDocs(collection(db, 'ratings'));
  const filtered = snap.docs
    .map((d) => d.data() as UserRating)
    .filter((r) => r.mediaId === mediaId && r.mediaType === mediaType);
  const count = filtered.length;
  const average = count > 0
    ? Math.round(filtered.reduce((s, r) => s + r.rating, 0) / count * 10) / 10
    : 0;
  return { ratings: filtered, average, count };
};

export const subscribeToMediaRatings = (
  mediaId: number,
  mediaType: 'movie' | 'tv',
  callback: (data: { ratings: UserRating[]; average: number; count: number }) => void
): Unsubscribe => {
  return onSnapshot(collection(db, 'ratings'), (snap) => {
    const filtered = snap.docs
      .map((d) => d.data() as UserRating)
      .filter((r) => r.mediaId === mediaId && r.mediaType === mediaType);
    const count = filtered.length;
    const average = count > 0
      ? Math.round(filtered.reduce((s, r) => s + r.rating, 0) / count * 10) / 10
      : 0;
    callback({ ratings: filtered, average, count });
  });
};

export const subscribeToWatchedEpisodeDocs = (
  uid: string,
  showId: number,
  callback: (episodes: Map<string, WatchedEpisodeDoc>) => void
): Unsubscribe => {
  const ref = collection(db, 'users', uid, 'userShows', String(showId), 'episodes');
  return onSnapshot(
    ref,
    (snap) => {
      const map = new Map<string, WatchedEpisodeDoc>();
      snap.docs.forEach((d) => {
        const data = d.data() as { watchedAt?: any; runtime?: number };
        map.set(d.id, {
          watchedAt: data.watchedAt ? (data.watchedAt.toDate ? data.watchedAt.toDate() : new Date(data.watchedAt)) : null,
          runtime: data.runtime,
        });
      });
      callback(map);
    },
    (err) => {
      console.error('Erro ao ler episódios assistidos:', err);
    }
  );
};

// ── Friends ────────────────────────────────────────────────────────────────────

export interface FriendRequest {
  id: string;
  from: string;
  to: string;
  fromName: string;
  fromPhotoURL: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
}

export interface FriendInfo {
  friendId: string;
  displayName: string;
  photoURL: string | null;
  becameFriendsAt: Date;
}

export const searchUsers = async (
  term: string
): Promise<Pick<UserProfile, 'uid' | 'displayName' | 'photoURL'>[]> => {
  if (!term.trim()) return [];
  const ref = collection(db, 'users');
  const q = query(
    ref,
    orderBy('displayName'),
    startAt(term),
    endAt(term + '\uf8ff'),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as UserProfile;
    return { uid: d.id, displayName: data.displayName, photoURL: data.photoURL };
  });
};

export const sendFriendRequest = async (
  from: string,
  to: string,
  fromName: string,
  fromPhotoURL: string | null
): Promise<void> => {
  const ref = doc(collection(db, 'friendRequests'));
  await setDoc(ref, {
    from,
    to,
    fromName,
    fromPhotoURL,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
};

export const acceptFriendRequest = async (
  requestId: string,
  from: string,
  to: string
): Promise<void> => {
  await runTransaction(db, async (transaction) => {
    const reqRef = doc(db, 'friendRequests', requestId);
    const reqSnap = await transaction.get(reqRef);
    if (!reqSnap.exists() || reqSnap.data().status !== 'pending') return;

    transaction.update(reqRef, { status: 'accepted' });

    const toFriendRef = doc(db, 'users', to, 'friends', from);
    transaction.set(toFriendRef, {
      friendId: from,
      displayName: reqSnap.data().fromName,
      photoURL: reqSnap.data().fromPhotoURL,
      becameFriendsAt: serverTimestamp(),
    });

    const toUserSnap = await transaction.get(doc(db, 'users', to));

    const toName = (toUserSnap.data() as UserProfile)?.displayName || '';
    const toPhoto = (toUserSnap.data() as UserProfile)?.photoURL || null;

    const fromFriendRef = doc(db, 'users', from, 'friends', to);
    transaction.set(fromFriendRef, {
      friendId: to,
      displayName: toName,
      photoURL: toPhoto,
      becameFriendsAt: serverTimestamp(),
    });
  });
};

export const declineFriendRequest = async (requestId: string): Promise<void> => {
  await updateDoc(doc(db, 'friendRequests', requestId), { status: 'rejected' });
};

// ── Friend queries (single-field where only — no composite indexes needed) ─────

export const getFriendRequests = async (uid: string): Promise<FriendRequest[]> => {
  const q = query(collection(db, 'friendRequests'), where('to', '==', uid));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as FriendRequest))
    .filter((r) => r.status === 'pending');
};

export const getSentFriendRequests = async (uid: string): Promise<FriendRequest[]> => {
  const q = query(collection(db, 'friendRequests'), where('from', '==', uid));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as FriendRequest))
    .filter((r) => r.status === 'pending');
};

export const subscribeToFriendRequests = (
  uid: string,
  callback: (requests: FriendRequest[]) => void
): Unsubscribe => {
  const q = query(collection(db, 'friendRequests'), where('to', '==', uid));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as FriendRequest))
        .filter((r) => r.status === 'pending')
    );
  });
};

export const subscribeToFriends = (
  uid: string,
  callback: (friends: FriendInfo[]) => void
): Unsubscribe => {
  const ref = collection(db, 'users', uid, 'friends');
  return onSnapshot(ref, (snap) => {
    callback(snap.docs.map((d) => d.data() as FriendInfo));
  });
};

export const getFriends = async (uid: string): Promise<FriendInfo[]> => {
  const snap = await getDocs(collection(db, 'users', uid, 'friends'));
  return snap.docs.map((d) => d.data() as FriendInfo);
};

export const areFriends = async (uid1: string, uid2: string): Promise<boolean> => {
  const snap = await getDoc(doc(db, 'users', uid1, 'friends', uid2));
  return snap.exists();
};

export const checkFriendship = async (
  currentUid: string,
  targetUid: string
): Promise<'self' | 'friend' | 'pending' | 'sent' | 'none'> => {
  if (currentUid === targetUid) return 'self';

  const friendSnap = await getDoc(doc(db, 'users', currentUid, 'friends', targetUid));
  if (friendSnap.exists()) return 'friend';

  // Check sent request
  const sentQ = query(collection(db, 'friendRequests'), where('from', '==', currentUid));
  const sentSnap = await getDocs(sentQ);
  for (const d of sentSnap.docs) {
    const data = d.data();
    if (data.to === targetUid && data.status === 'pending') return 'sent';
  }

  // Check received request
  const receivedQ = query(collection(db, 'friendRequests'), where('to', '==', currentUid));
  const receivedSnap = await getDocs(receivedQ);
  for (const d of receivedSnap.docs) {
    const data = d.data();
    if (data.from === targetUid && data.status === 'pending') return 'pending';
  }

  return 'none';
};


