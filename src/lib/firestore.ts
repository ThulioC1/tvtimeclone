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
