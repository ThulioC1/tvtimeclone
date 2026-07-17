import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { subscribeToUserShows, setBannerShow, getBannerUrl, recalculateUserStats, type UserShow } from '../lib/firestore';
import BannerPickerModal from '../components/BannerPickerModal';

const ProfilePage: React.FC = () => {
  const { user, userProfile, signOut, updateDisplayName } = useAuth();
  const [shows, setShows] = useState<UserShow[]>([]);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [recalc, setRecalc] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserShows(user.uid, setShows);
    return unsub;
  }, [user]);

  useEffect(() => {
    setNewName(userProfile?.displayName || user?.displayName || '');
  }, [userProfile, user]);

  const totalWatched = shows.reduce((sum, s) => sum + s.watchedCount, 0);
  const totalMinutes = userProfile?.totalWatchMinutes ?? 0;
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  const handleSave = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await updateDisplayName(newName.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const avatarLetter = (userProfile?.displayName || user?.email || 'U')[0].toUpperCase();

  const handleRecalc = async () => {
    if (!user) return;
    setRecalc(true);
    try {
      await recalculateUserStats(user.uid);
    } catch (err) {
      console.error('Erro ao recalcular estatísticas:', err);
      alert('Erro ao recalcular estatísticas.');
    } finally {
      setRecalc(false);
    }
  };

  const handlePickBanner = async (showId: number | null) => {
    if (!user) return;
    setSavingBanner(true);
    try {
      await setBannerShow(user.uid, showId);
      setPickerOpen(false);
    } catch (err) {
      console.error('Erro ao definir banner:', err);
    } finally {
      setSavingBanner(false);
    }
  };

  const bannerUrl = getBannerUrl(shows, userProfile?.bannerShowId ?? null);

  return (
    <div className="max-w-2xl mx-auto pb-28 md:pb-0">
      {/* Cover + avatar (estilo Facebook) */}
      <div className="relative">
        <div
          className="h-40 md:h-52 w-full bg-gradient-to-br from-brand-600 via-brand-500 to-purple-600 overflow-hidden cursor-pointer group relative"
          onClick={() => setPickerOpen(true)}
          title="Trocar banner"
        >
          {bannerUrl && (
            <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_20%,white,transparent_45%)] group-hover:bg-brand-900/30 transition-colors" />
          <div className="absolute bottom-2 right-3 text-xs text-white/90 bg-dark-900/50 px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
            {shows.length === 0 ? 'Adicione séries para escolher um banner' : 'Trocar banner'}
          </div>
        </div>
        <div className="px-4 md:px-6">
          <div className="-mt-14 md:-mt-16 flex items-end gap-4">
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-3xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center overflow-hidden shadow-xl ring-4 ring-dark-900 shrink-0">
              {userProfile?.photoURL || user?.photoURL ? (
                <img src={(userProfile?.photoURL || user?.photoURL) ?? ''} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-4xl">{avatarLetter}</span>
              )}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              {editing ? (
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="input-field flex-1 py-2 text-sm"
                    placeholder="Seu nome"
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    autoFocus
                  />
                  <button onClick={handleSave} disabled={saving} className="btn-primary py-2 px-4 text-sm">
                    {saving ? '...' : 'Salvar'}
                  </button>
                  <button onClick={() => setEditing(false)} className="btn-ghost text-sm">
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-xl md:text-2xl font-extrabold text-white truncate">
                    {userProfile?.displayName || user?.displayName || 'Usuário'}
                  </h2>
                  <button
                    onClick={() => setEditing(true)}
                    className="text-gray-400 hover:text-brand-400 transition-colors shrink-0"
                    title="Editar nome"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              )}
              <p className="text-sm text-gray-400 mt-0.5 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 mt-4">

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
        <div className="card p-4 sm:p-5 rounded-2xl">
          <div className="text-2xl sm:text-3xl font-bold gradient-text leading-none">{shows.length}</div>
          <div className="text-xs sm:text-sm text-gray-400 mt-2 leading-tight">Séries na lista</div>
        </div>
        <div className="card p-4 sm:p-5 rounded-2xl">
          <div className="text-2xl sm:text-3xl font-bold gradient-text leading-none">{totalWatched}</div>
          <div className="text-xs sm:text-sm text-gray-400 mt-2 leading-tight">Episódios assistidos</div>
        </div>
        <div className="card p-4 sm:p-5 rounded-2xl">
          <div className="text-2xl sm:text-3xl font-bold gradient-text leading-none">{totalHours}h{remainingMinutes > 0 ? ` ${remainingMinutes}min` : ''}</div>
          <div className="text-xs sm:text-sm text-gray-400 mt-2 leading-tight">Tempo assistido</div>
        </div>
        <div className="card p-4 sm:p-5 rounded-2xl">
          <div className="text-2xl sm:text-3xl font-bold gradient-text leading-none">
            {shows.filter((s) => s.status === 'completed').length}
          </div>
          <div className="text-xs sm:text-sm text-gray-400 mt-2 leading-tight">Séries concluídas</div>
        </div>
      </div>

      <div className="flex justify-end mb-6">
        <button
          onClick={handleRecalc}
          disabled={recalc}
          className="btn-secondary text-sm disabled:opacity-50"
        >
          {recalc ? 'Recalculando...' : 'Recalcular estatísticas'}
        </button>
      </div>

      {/* Status breakdown */}
      {shows.length > 0 && (
        <div className="card p-5 mb-6">
          <h3 className="section-title mb-4">Distribuição por status</h3>
          {[
            { label: 'Assistindo', key: 'watching', color: 'bg-brand-500' },
            { label: 'Quero assistir', key: 'plan_to_watch', color: 'bg-yellow-500' },
            { label: 'Concluídas', key: 'completed', color: 'bg-green-500' },
            { label: 'Abandonadas', key: 'dropped', color: 'bg-red-500' },
          ].map(({ label, key, color }) => {
            const count = shows.filter((s) => s.status === key).length;
            const pct = shows.length > 0 ? (count / shows.length) * 100 : 0;
            if (count === 0) return null;
            return (
              <div key={key} className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">{label}</span>
                  <span className="text-gray-400">{count}</span>
                </div>
                <div className="progress-bar">
                  <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Account info */}
      <div className="card p-5 mb-6">
        <h3 className="section-title mb-3">Conta</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">E-mail</span>
            <span className="text-white">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Membro desde</span>
            <span className="text-white">
              {userProfile?.createdAt
                ? new Date((userProfile.createdAt as any)?.seconds * 1000).toLocaleDateString('pt-BR')
                : new Date(user?.metadata.creationTime ?? '').toLocaleDateString('pt-BR')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Login via</span>
            <span className="text-white">
              {user?.providerData?.[0]?.providerId === 'google.com' ? 'Google' : 'E-mail'}
            </span>
          </div>
        </div>
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="btn-secondary w-full text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-colors"
      >
        {signingOut ? 'Saindo...' : '→ Sair da conta'}
      </button>
      </div>

      <BannerPickerModal
        open={pickerOpen}
        shows={shows}
        currentBannerShowId={userProfile?.bannerShowId ?? null}
        saving={savingBanner}
        onClose={() => setPickerOpen(false)}
        onPick={handlePickBanner}
      />
    </div>
  );
};

export default ProfilePage;
