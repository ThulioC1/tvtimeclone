import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { TVShow } from './tvmaze';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ShowStatus = 'watching' | 'completed' | 'dropped' | 'plan_to_watch';

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
  showId: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  status: ShowStatus;
  totalEpisodes: number;
  watchedCount: number;
  addedAt: Date;
  lastWatchedAt: Date | null;
  totalSeasons: number;
  isFavorite: boolean;
  genres?: string[];
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
    createdAt: serverTimestamp(),
    totalWatchMinutes: 0,
    ...data,
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
  await updateDoc(ref, data as any);
};

export const setBannerShow = async (uid: string, showId: number | null): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), { bannerShowId: showId });
};

export const getBannerUrl = (
  shows: UserShow[],
  bannerShowId: number | null
): string | null => {
  if (bannerShowId == null) return null;
  const show = shows.find((s) => s.showId === bannerShowId);
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
    showId: show.id,
    title: show.name,
    posterPath: show.poster_path,
    backdropPath: show.backdrop_path,
    status,
    totalEpisodes,
    totalSeasons: show.number_of_seasons ?? show.seasons?.filter((s) => s.season_number > 0).length ?? 1,
    watchedCount: 0,
    addedAt: serverTimestamp(),
    lastWatchedAt: null,
    isFavorite: false,
    genres: show.genres?.map((g) => g.name) ?? [],
  } satisfies Omit<UserShow, 'addedAt' | 'lastWatchedAt'> & { addedAt: any; lastWatchedAt: any });
};

export const removeShowFromWatchlist = async (uid: string, showId: number): Promise<void> => {
  const ref = doc(db, 'users', uid, 'userShows', String(showId));
  await deleteDoc(ref);
  // Also remove all episodes
  const episodesRef = collection(db, 'users', uid, 'userShows', String(showId), 'episodes');
  const episodesSnap = await getDocs(episodesRef);
  const deletePromises = episodesSnap.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletePromises);
};

export const updateShowStatus = async (
  uid: string,
  showId: number,
  status: ShowStatus
): Promise<void> => {
  const ref = doc(db, 'users', uid, 'userShows', String(showId));
  await updateDoc(ref, { status });
};

export const toggleFavorite = async (
  uid: string,
  showId: number,
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
  const effectiveRuntime = typeof runtime === 'number' && runtime > 0 ? runtime : 30;
  await setDoc(ref, {
    seasonNumber,
    episodeNumber,
    watchedAt: serverTimestamp(),
    runtime: effectiveRuntime,
  });

  // Update watchedCount and totalWatchMinutes
  const showRef = doc(db, 'users', uid, 'userShows', String(showId));
  const showSnap = await getDoc(showRef);
  if (showSnap.exists()) {
    const current = showSnap.data() as UserShow;
    await updateDoc(showRef, {
      watchedCount: current.watchedCount + 1,
      lastWatchedAt: serverTimestamp(),
    });
  }

  // Update user total watch minutes
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

  const existingSnap = await getDocs(episodesRef);
  const existingIds = new Set(existingSnap.docs.map((d) => d.id));

  const batch = writeBatch(db);
  let totalMinutes = 0;
  let newCount = 0;

  for (const ep of episodes) {
    const id = getEpisodeId(ep.seasonNumber, ep.episodeNumber);
    if (existingIds.has(id)) continue;
    const rt = typeof ep.runtime === 'number' && ep.runtime > 0 ? ep.runtime : 30;
    batch.set(doc(episodesRef, id), {
      seasonNumber: ep.seasonNumber,
      episodeNumber: ep.episodeNumber,
      watchedAt: serverTimestamp(),
      runtime: rt,
    });
    totalMinutes += rt;
    newCount += 1;
  }

  if (newCount > 0) {
    const showSnap = await getDoc(showRef);
    if (showSnap.exists()) {
      const current = showSnap.data() as UserShow;
      batch.update(showRef, { watchedCount: current.watchedCount + newCount });
    }
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const profile = userSnap.data() as UserProfile;
      batch.update(userRef, {
        totalWatchMinutes: (profile.totalWatchMinutes || 0) + totalMinutes,
      });
    }
    await batch.commit();
  }
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

  const existingSnap = await getDocs(episodesRef);
  const existingIds = new Set(existingSnap.docs.map((d) => d.id));

  const batch = writeBatch(db);
  let totalMinutes = 0;
  let newCount = 0;

  for (const ep of episodes) {
    if (ep.seasonNumber !== seasonNumber) continue;
    const id = getEpisodeId(ep.seasonNumber, ep.episodeNumber);
    if (existingIds.has(id)) continue;
    const rt = typeof ep.runtime === 'number' && ep.runtime > 0 ? ep.runtime : 30;
    batch.set(doc(episodesRef, id), {
      seasonNumber: ep.seasonNumber,
      episodeNumber: ep.episodeNumber,
      watchedAt: serverTimestamp(),
      runtime: rt,
    });
    totalMinutes += rt;
    newCount += 1;
  }

  if (newCount > 0) {
    const showSnap = await getDoc(showRef);
    if (showSnap.exists()) {
      const current = showSnap.data() as UserShow;
      batch.update(showRef, {
        watchedCount: current.watchedCount + newCount,
        lastWatchedAt: serverTimestamp(),
      });
    }
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const profile = userSnap.data() as UserProfile;
      batch.update(userRef, {
        totalWatchMinutes: (profile.totalWatchMinutes || 0) + totalMinutes,
      });
    }
    await batch.commit();
  }
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
