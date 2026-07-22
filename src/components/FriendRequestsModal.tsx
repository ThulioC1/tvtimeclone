import React, { useEffect, useState } from 'react';
import {
  subscribeToFriendRequests,
  getSentFriendRequests,
  acceptFriendRequest,
  type FriendRequest,
} from '../lib/firestore';

interface Props {
  open: boolean;
  uid: string;
  onClose: () => void;
}

const FriendRequestsModal: React.FC<Props> = ({ open, uid, onClose }) => {
  const [received, setReceived] = useState<FriendRequest[]>([]);
  const [sent, setSent] = useState<FriendRequest[]>([]);
  const [accepting, setAccepting] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !uid) return;
    const unsub = subscribeToFriendRequests(uid, setReceived);
    getSentFriendRequests(uid).then(setSent);
    return unsub;
  }, [open, uid]);

  const handleAccept = async (req: FriendRequest) => {
    setAccepting((prev) => new Set(prev).add(req.id));
    try {
      await acceptFriendRequest(req.id, req.from, req.to);
    } finally {
      setAccepting((prev) => { const n = new Set(prev); n.delete(req.id); return n; });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto bg-dark-850 rounded-t-2xl sm:rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Solicitações</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        {received.length === 0 && sent.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-4">Nenhuma solicitação.</p>
        )}

        {received.length > 0 && (
          <>
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Recebidas</h4>
            <div className="space-y-2 mb-6">
              {received.map((req) => (
                <div key={req.id} className="card-hover flex items-center gap-3 p-3 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center overflow-hidden shrink-0">
                    {req.fromPhotoURL ? (
                      <img src={req.fromPhotoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-bold text-sm">{req.fromName[0]?.toUpperCase() || '?'}</span>
                    )}
                  </div>
                  <p className="flex-1 text-sm font-medium text-white truncate">{req.fromName}</p>
                  <button
                    onClick={() => handleAccept(req)}
                    disabled={accepting.has(req.id)}
                    className="btn-primary py-1.5 px-3 text-xs disabled:opacity-50"
                  >
                    {accepting.has(req.id) ? '...' : 'Aceitar'}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {sent.length > 0 && (
          <>
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Enviadas</h4>
            <div className="space-y-2">
              {sent.map((req) => (
                <div key={req.id} className="card-hover flex items-center gap-3 p-3 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center overflow-hidden shrink-0">
                    <span className="text-white font-bold text-sm">{req.fromName[0]?.toUpperCase() || '?'}</span>
                  </div>
                  <p className="flex-1 text-sm font-medium text-white truncate">{req.fromName}</p>
                  <span className="text-xs text-yellow-400">Pendente</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FriendRequestsModal;
