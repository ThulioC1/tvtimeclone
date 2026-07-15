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

  const loadProfile = async (uid: string) => {
    const profile = await getUserProfile(uid);
    setUserProfile(profile);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await loadProfile(firebaseUser.uid);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
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
    await sendPasswordResetEmail(auth, email);
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
