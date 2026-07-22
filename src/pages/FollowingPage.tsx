import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { subscribeToFollowing, type FollowingInfo } from '../lib/firestore';

const FollowingPage: React.FC = () => {
  const { user } = useAuth();
  const [following, setFollowing] = useState<FollowingInfo[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToFollowing(user.uid, setFollowing);
    return unsub;
  }, [user]);

  return (
    <div className="max-w-2xl mx-auto pb-28 md:pb-0 px-4 py-6">
      <h1 className="section-title mb-6">Seguindo</h1>

      {following.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-400 text-sm">
            Você ainda não segue ninguém. Busque pessoas para seguir!
          </p>
          <Link to="/search" className="btn-primary inline-flex mt-4 text-sm">
            Buscar pessoas
          </Link>
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
