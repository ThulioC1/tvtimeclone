import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import {
  type User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { createUserProfile, getUserProfile, type UserProfile, updateUserProfile } from '../lib/firestore';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  dbError: string | null;
  setDbError: (msg: string | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateDisplayName: (name: string, photoURL?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const loadProfile = async (uid: string) => {
    const profile = await getUserProfile(uid);
    setUserProfile(profile);
    // Fallback: if Firestore profile is missing/empty name but the auth user has one, sync it.
    if (auth.currentUser && (!profile || !profile.displayName)) {
      const fbUser = auth.currentUser;
      if (fbUser.displayName || fbUser.photoURL) {
        await updateUserProfile(uid, {
          ...(fbUser.displayName ? { displayName: fbUser.displayName } : {}),
          ...(fbUser.photoURL ? { photoURL: fbUser.photoURL } : {}),
        });
        const refreshed = await getUserProfile(uid);
        setUserProfile(refreshed);
      }
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      try {
        if (firebaseUser) {
          await loadProfile(firebaseUser.uid);
        } else {
          setUserProfile(null);
        }
      } catch (err) {
        console.error(
          'Erro ao carregar perfil (Firestore):',
          err,
          '\nVerifique se o banco de dados Firestore foi criado no Firebase Console ' +
            '(Firestore Database → Create database) e se a API do Firestore está habilitada.'
        );
        setUserProfile(null);
        setDbError(
          'Não foi possível carregar seus dados. Verifique sua conexão ou se o Firestore está ativo no Firebase.'
        );
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    await createUserProfile(cred.user.uid, {
      uid: cred.user.uid,
      displayName,
      email,
      photoURL: null,
    });
  };

  const signInWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    const profile = await getUserProfile(cred.user.uid);
    if (!profile) {
      await createUserProfile(cred.user.uid, {
        uid: cred.user.uid,
        displayName: cred.user.displayName || '',
        email: cred.user.email || '',
        photoURL: cred.user.photoURL,
      });
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      // Avoid account enumeration: never reveal whether the email exists.
      if (err?.code === 'auth/user-not-found') {
        return;
      }
      throw err;
    }
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.uid);
  };

  const updateDisplayName = async (name: string, photoURL?: string) => {
    if (!user) return;
    await updateProfile(user, { displayName: name, photoURL: photoURL ?? user.photoURL });
    await updateUserProfile(user.uid, { displayName: name, ...(photoURL ? { photoURL } : {}) });
    await refreshProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        dbError,
        setDbError,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        resetPassword,
        refreshProfile,
        updateDisplayName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
