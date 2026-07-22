import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { searchUsers, type UserProfile } from '../lib/firestore';

interface Props {
  open: boolean;
  currentUid: string;
  onClose: () => void;
}

const FriendSearchModal: React.FC<Props> = ({ open, currentUid, onClose }) => {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Pick<UserProfile, 'uid' | 'displayName' | 'photoURL'>[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTerm('');
    setResults([]);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    if (!term.trim()) { setResults([]); return; }
    const id = setTimeout(async () => {
      setLoading(true);
      const users = await searchUsers(term.trim());
      setResults(users.filter((u) => u.uid !== currentUid));
      setLoading(false);
    }, 300);
    return () => clearTimeout(id);
  }, [term, currentUid]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto bg-dark-850 rounded-t-2xl sm:rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Buscar pessoas</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Digite o nome do usuário..."
          className="input-field w-full mb-4"
        />

        {loading && <p className="text-gray-400 text-sm text-center">Buscando...</p>}

        {!loading && term.trim() && results.length === 0 && (
          <p className="text-gray-400 text-sm text-center">Nenhum usuário encontrado.</p>
        )}

        <div className="space-y-2">
          {results.map((u) => (
            <Link
              key={u.uid}
              to={`/user/${u.uid}`}
              onClick={onClose}
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
              <span className="text-xs text-brand-400">Ver perfil →</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FriendSearchModal;
