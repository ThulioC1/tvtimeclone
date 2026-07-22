import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { subscribeToFollowing, searchUsers, type FollowingInfo, type UserProfile } from '../lib/firestore';

const FollowingPage: React.FC = () => {
  const { user } = useAuth();
  const [following, setFollowing] = useState<FollowingInfo[]>([]);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Pick<UserProfile, 'uid' | 'displayName' | 'photoURL'>[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToFollowing(user.uid, setFollowing);
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!term.trim() || !user) { setResults([]); return; }
    const id = setTimeout(async () => {
      setSearching(true);
      const users = await searchUsers(term.trim());
      setResults(users.filter((u) => u.uid !== user.uid));
      setSearching(false);
    }, 300);
    return () => clearTimeout(id);
  }, [term, user]);

  return (
    <div className="max-w-2xl mx-auto pb-28 md:pb-0 px-4 py-6">
      <h1 className="section-title mb-6">Comunidade</h1>

      {/* Search */}
      <div className="mb-8">
        <input
          ref={inputRef}
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar pessoas pelo nome..."
          className="input-field w-full"
        />
        {searching && <p className="text-gray-400 text-xs mt-2">Buscando...</p>}
        {!searching && term.trim() && results.length === 0 && (
          <p className="text-gray-400 text-xs mt-2">Nenhum usuário encontrado.</p>
        )}
        {results.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Resultados</p>
            {results.map((u) => (
              <Link
                key={u.uid}
                to={`/user/${u.uid}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-dark-700/90 hover:bg-dark-600/90 hover:border-brand-500/30 border border-white/[0.06] transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center overflow-hidden shrink-0">
                  {u.photoURL ? (
                    <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-sm">{u.displayName[0]?.toUpperCase() || '?'}</span>
                  )}
                </div>
                <p className="flex-1 text-sm font-medium text-white truncate">{u.displayName}</p>
                <span className="text-xs text-brand-400 shrink-0">Ver perfil →</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Following */}
      <h2 className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-3">Seguindo</h2>
      {following.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-400 text-sm">
            Você ainda não segue ninguém.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {following.map((f) => (
            <Link
              key={f.targetId}
              to={`/user/${f.targetId}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-dark-700/90 hover:bg-dark-600/90 hover:border-brand-500/30 border border-white/[0.06] transition-all duration-200"
            >
              <div className="w-11 h-11 rounded-full bg-brand-600 flex items-center justify-center overflow-hidden shrink-0">
                {f.photoURL ? (
                  <img src={f.photoURL} alt={f.displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-lg">
                    {(f.displayName || 'U')[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {f.displayName}
                </p>
              </div>
              <span className="text-xs text-brand-400 shrink-0">Ver perfil →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default FollowingPage;
