import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { subscribeToUserShows, removeShowFromWatchlist, updateShowStatus, type UserShow, type ShowStatus } from '../lib/firestore';
import { getPosterUrl } from '../lib/tvmaze';

const STATUS_LABELS: Record<ShowStatus, string> = {
  watching: 'Assistindo',
  completed: 'Concluído',
  dropped: 'Abandonado',
  plan_to_watch: 'Quero assistir',
};

const STATUS_COLORS: Record<ShowStatus, string> = {
  watching: 'bg-brand-500/20 text-brand-400',
  completed: 'bg-green-500/20 text-green-400',
  dropped: 'bg-red-500/20 text-red-400',
  plan_to_watch: 'bg-yellow-500/20 text-yellow-400',
};

const ShowRow = ({
  show,
  onRemove,
  onStatusChange,
}: {
  show: UserShow;
  onRemove: () => void;
  onStatusChange: (status: ShowStatus) => void;
}) => {
  const posterUrl = getPosterUrl(show.posterPath, 'w185');
  const progress = show.totalEpisodes > 0 ? (show.watchedCount / show.totalEpisodes) * 100 : 0;

  return (
    <div className="card p-4 flex gap-4 hover:border-dark-300 transition-colors active-show-glow">
      <Link to={`/show/${show.showId}`} className="shrink-0">
        <div className="w-14 h-20 rounded-xl overflow-hidden bg-dark-500">
          {posterUrl ? (
            <img src={posterUrl} alt={show.title} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-dark-500" />
          )}
        </div>
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/show/${show.showId}`}>
            <h3 className="font-semibold text-white hover:text-brand-400 transition-colors truncate text-sm">
              {show.title}
            </h3>
          </Link>
          <button
            onClick={onRemove}
            className="text-gray-600 hover:text-red-400 transition-colors shrink-0 text-lg leading-none"
            title="Remover da lista"
          >
            ×
          </button>
        </div>

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <select
            value={show.status}
            onChange={(e) => onStatusChange(e.target.value as ShowStatus)}
            className={`text-xs font-medium px-2 py-1 rounded-lg border-0 outline-none cursor-pointer ${STATUS_COLORS[show.status]} bg-transparent`}
          >
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v} className="bg-dark-700 text-white">{l}</option>
            ))}
          </select>
          <span className="text-xs text-gray-500">
            {show.watchedCount}/{show.totalEpisodes} ep.
          </span>
        </div>

        <div className="progress-bar mt-2">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
};

const WatchlistPage: React.FC = () => {
  const { user } = useAuth();
  const [shows, setShows] = useState<UserShow[]>([]);
  const [activeTab, setActiveTab] = useState<ShowStatus | 'all'>('all');
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserShows(user.uid, setShows);
    return unsub;
  }, [user]);

  const handleRemove = async (showId: number) => {
    if (!user) return;
    setRemovingId(showId);
    try {
      await removeShowFromWatchlist(user.uid, showId);
    } finally {
      setRemovingId(null);
    }
  };

  const handleStatusChange = async (showId: number, status: ShowStatus) => {
    if (!user) return;
    await updateShowStatus(user.uid, showId, status);
  };

  const tabs: { key: ShowStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'watching', label: 'Assistindo' },
    { key: 'plan_to_watch', label: 'Quero ver' },
    { key: 'completed', label: 'Concluídas' },
    { key: 'dropped', label: 'Abandonadas' },
  ];

  const filtered = activeTab === 'all' ? shows : shows.filter((s) => s.status === activeTab);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto pb-28 md:pb-0">
      <h1 className="page-title mb-6">Minha Lista</h1>

      {/* Stats row */}
      {shows.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total', value: shows.length },
            { label: 'Assistindo', value: shows.filter((s) => s.status === 'watching').length },
            { label: 'Concluídas', value: shows.filter((s) => s.status === 'completed').length },
            { label: 'Abandonadas', value: shows.filter((s) => s.status === 'dropped').length },
          ].map(({ label, value }) => (
            <div key={label} className="card p-3 text-center">
              <p className="text-2xl font-bold gradient-text">{value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      {shows.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`shrink-0 text-sm font-medium px-4 py-2 rounded-xl transition-all duration-200 ${
                activeTab === key
                  ? 'bg-brand-600 text-white'
                  : 'bg-dark-700 text-gray-400 hover:text-white hover:bg-dark-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Shows */}
      {filtered.length > 0 ? (
        <div className="space-y-3 animation-fade-in">
          {filtered.map((show) => (
            <div key={show.showId} className={removingId === show.showId ? 'opacity-50 pointer-events-none' : ''}>
              <ShowRow
                show={show}
                onRemove={() => handleRemove(show.showId)}
                onStatusChange={(s) => handleStatusChange(show.showId, s)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">📺</div>
          <p className="text-white font-semibold">
            {shows.length === 0 ? 'Sua lista está vazia' : 'Nenhuma série nessa categoria'}
          </p>
          {shows.length === 0 && (
            <>
              <p className="text-gray-400 text-sm mt-1">Busque séries para começar a adicionar!</p>
              <Link to="/search" className="btn-primary inline-flex mt-4">
                Buscar séries
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default WatchlistPage;
