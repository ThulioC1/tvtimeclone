import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import {
  getAllUserSeasonsProgress,
  setEpisodeWatchedAt,
  type SeasonProgress,
  type SeasonCatalogInfo,
  type ShowStatus,
} from '../lib/firestore';
import { getPosterUrl, getTVShowDetails, getTVSeason } from '../lib/tmdb';
import { getAllEpisodesSorted as tvmazeGetAllEpisodes } from '../lib/tvmaze';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type FilterType = 'all' | 'watching' | 'completed' | 'up_to_date';

const FILTER_OPTIONS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'watching', label: 'Assistindo' },
  { key: 'up_to_date', label: 'Em dia' },
  { key: 'completed', label: 'Terminado' },
];

const STATUS_LABELS: Record<ShowStatus, string> = {
  watching: 'Assistindo',
  completed: 'Concluído',
  dropped: 'Abandonado',
  plan_to_watch: 'Quero assistir',
};

const STATUS_STYLES: Record<ShowStatus, string> = {
  watching: 'bg-brand-600 text-white',
  completed: 'bg-green-600 text-white',
  dropped: 'bg-red-600 text-white',
  plan_to_watch: 'bg-yellow-500 text-dark-900',
};

const ITEMS_PER_PAGE = 10;

const ControlListPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [seasons, setSeasons] = useState<SeasonProgress[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingSeason, setEditingSeason] = useState<SeasonProgress | null>(null);
  const [editField, setEditField] = useState<'start' | 'end'>('end');
  const [editDate, setEditDate] = useState<Date | null>(null);

  const fetchSeasons = useCallback(async () => {
    if (!user) return [];
    const base = await getAllUserSeasonsProgress(user.uid);

    // Enrich with the real per-season episode totals AND released counts from
    // TMDB/TVMaze. The show-level "released" total covers ALL seasons (like
    // Minha Lista does), so the status badge is identical to Minha Lista.
    // Failures fall back to the estimate already present in each SeasonProgress.
    const now = new Date();
    const showIds = [...new Set(base.map((s) => s.showId))];
    const catalogs = await Promise.all(
      showIds.map(async (showId) => {
        const sample = base.find((s) => s.showId === showId)!;
        const catalog = new Map<number, SeasonCatalogInfo>();
        let catalogOk = false;
        try {
          if (sample.source === 'tvmaze') {
            const all = await tvmazeGetAllEpisodes(Number(showId));
            const bySeason = new Map<number, { total: number; released: number }>();
            all.forEach((e) => {
              const entry = bySeason.get(e.season_number) ?? { total: 0, released: 0 };
              entry.total += 1;
              if (e.air_date && new Date(e.air_date) <= now) entry.released += 1;
              bySeason.set(e.season_number, entry);
            });
            bySeason.forEach(({ total, released }, seasonNumber) => {
              catalog.set(seasonNumber, { totalEpisodes: total, releasedEpisodes: released });
            });
            catalogOk = true;
          } else {
            const details = await getTVShowDetails(Number(showId));
            const seasonNumbers = (details.seasons ?? [])
              .map((s) => s.season_number)
              .filter((n) => n > 0);
            const infos = await Promise.all(
              seasonNumbers.map(async (seasonNumber) => {
                try {
                  const season = await getTVSeason(Number(showId), seasonNumber);
                  const episodes = season.episodes ?? [];
                  return {
                    seasonNumber,
                    info: {
                      totalEpisodes: episodes.length,
                      releasedEpisodes: episodes.filter(
                        (e) => e.air_date && new Date(e.air_date) <= now
                      ).length,
                      name: season.name,
                    } as SeasonCatalogInfo,
                  };
                } catch (err) {
                  console.error(
                    `Erro ao buscar temporada ${seasonNumber} da série ${showId}:`,
                    err
                  );
                  return null;
                }
              })
            );
            infos.forEach((entry) => {
              if (entry) catalog.set(entry.seasonNumber, entry.info);
            });
            catalogOk = infos.some((entry) => entry !== null);
          }
        } catch (err) {
          console.error(`Erro ao buscar catálogo da série ${showId}:`, err);
        }
        return { showId, catalog, catalogOk };
      })
    );

    const byShow = new Map(catalogs.map((c) => [c.showId, c]));
    // Show-level released total (all seasons) + watched total, exactly like
    // the "Em dia" check in Minha Lista.
    const showStats = new Map<string, { released: number; watched: number; total: number; ok: boolean }>();
    showIds.forEach((showId) => {
      const seasonsOfShow = base.filter((s) => s.showId === showId);
      const entry = byShow.get(showId);
      let released = 0;
      entry?.catalog.forEach((info) => {
        released += info.releasedEpisodes ?? 0;
      });
      const watched = seasonsOfShow.reduce((sum, s) => sum + s.watchedEpisodes, 0);
      const total = seasonsOfShow[0]?.showTotalEpisodes ?? 0;
      // Same fallback as Minha Lista: if the API fails, released = total.
      if (!entry?.catalogOk) released = total;
      showStats.set(showId, { released, watched, total, ok: !!entry?.catalogOk });
    });

    // Latest season per show (highest season number in the catalog;
    // falls back to the highest watched season when the API fails).
    const latestSeasonByShow = new Map<string, number>();
    showIds.forEach((showId) => {
      const keys = [...(byShow.get(showId)?.catalog.keys() ?? [])];
      if (keys.length > 0) {
        latestSeasonByShow.set(showId, Math.max(...keys));
      } else {
        const watchedSeasons = base.filter((s) => s.showId === showId).map((s) => s.seasonNumber);
        if (watchedSeasons.length > 0) {
          latestSeasonByShow.set(showId, Math.max(...watchedSeasons));
        }
      }
    });

    const enriched = base.map((s) => {
      const info = byShow.get(s.showId)?.catalog.get(s.seasonNumber);
      const stats = showStats.get(s.showId)!;
      const totalEpisodes = info?.totalEpisodes ?? s.totalEpisodes;
      const releasedEpisodes = info?.releasedEpisodes ?? s.releasedEpisodes;
      const isCompleted = s.watchedEpisodes >= totalEpisodes && totalEpisodes > 0;
      const showIsUpToDate =
        s.showStatus === 'watching' && stats.released > 0 && stats.watched >= stats.released;
      return {
        ...s,
        totalEpisodes,
        releasedEpisodes,
        seasonName: info?.name ?? s.seasonName,
        isCompleted,
        isUpToDate: releasedEpisodes > 0 && s.watchedEpisodes >= releasedEpisodes,
        showReleasedEpisodes: stats.released,
        showIsUpToDate,
        isLatestSeason: latestSeasonByShow.get(s.showId) === s.seasonNumber,
      };
    });

    // Most recently edited first (same ordering as Up Next).
    enriched.sort((a, b) => {
      const ta = a.lastWatchedAt ? new Date(a.lastWatchedAt).getTime() : 0;
      const tb = b.lastWatchedAt ? new Date(b.lastWatchedAt).getTime() : 0;
      return tb - ta;
    });

    return enriched;
  }, [user]);

  const { data: fetchedSeasons, isLoading: queryLoading, isError: queryError } = useQuery({
    queryKey: ['userSeasonsProgress', user?.uid],
    queryFn: fetchSeasons,
    enabled: !!user,
    staleTime: 30000,
  });

  useEffect(() => {
    if (fetchedSeasons) {
      setSeasons(fetchedSeasons);
      setCurrentPage(1);
    }
  }, [fetchedSeasons]);

  const filteredSeasons = useMemo(() => {
    return seasons.filter((season) => {
      if (filter === 'all') return true;
      if (filter === 'watching') return season.showStatus === 'watching';
      if (filter === 'completed') return season.showStatus === 'completed';
      if (filter === 'up_to_date') return season.showIsUpToDate;
      return true;
    });
  }, [seasons, filter]);

  const totalPages = Math.ceil(filteredSeasons.length / ITEMS_PER_PAGE);
  const paginatedSeasons = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSeasons.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSeasons, currentPage]);

  const updateEndDateMutation = useMutation({
    mutationFn: async ({ 
      uid, 
      showId, 
      seasonNumber, 
      episodeNumber, 
      newDate 
    }: { 
      uid: string; 
      showId: number; 
      seasonNumber: number; 
      episodeNumber: number; 
      newDate: Date 
    }) => {
      await setEpisodeWatchedAt(uid, showId, seasonNumber, episodeNumber, newDate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSeasonsProgress', user?.uid] });
      setEditingSeason(null);
      setEditDate(null);
    },
    onError: (err) => {
      console.error('Erro ao atualizar data:', err);
    },
  });

  const handleEditClick = (season: SeasonProgress, field: 'start' | 'end') => {
    setEditingSeason(season);
    setEditField(field);
    setEditDate(field === 'start' ? season.startDate : season.endDate);
  };

  const handleSaveEdit = () => {
    if (!editingSeason || !editDate || !user) return;
    const episodeNumber =
      editField === 'start' ? editingSeason.firstEpisodeNumber : editingSeason.lastEpisodeNumber;
    if (episodeNumber == null) return;

    // Update the watchedAt of the first/last watched episode in this
    // season — the same documents the other tabs already use.
    updateEndDateMutation.mutate({
      uid: user.uid,
      showId: Number(editingSeason.showId),
      seasonNumber: editingSeason.seasonNumber,
      episodeNumber,
      newDate: editDate,
    });
  };

  const handleCancelEdit = () => {
    setEditingSeason(null);
    setEditDate(null);
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return '—';
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  };

  // A fully watched season always shows "Concluído". Otherwise the badge is
  // identical to Minha Lista for this series: "Em dia" when the show is
  // being watched and caught up with everything released, else the show's
  // own status.
  const getSeasonStatusLabel = (season: SeasonProgress): string => {
    if (season.isCompleted) return 'Concluído';
    if (season.showIsUpToDate) return 'Em dia';
    return STATUS_LABELS[season.showStatus];
  };

  const getSeasonStatusStyle = (season: SeasonProgress): string => {
    if (season.isCompleted) return 'bg-green-600 text-white';
    if (season.showIsUpToDate) return 'bg-teal-600 text-white';
    return STATUS_STYLES[season.showStatus];
  };

  if (queryLoading) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto pb-28 md:pb-0">
        <h1 className="page-title mb-6">Lista de Controle</h1>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-center gap-4 p-4">
                <div className="w-14 h-20 rounded-lg bg-dark-600" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-dark-500 rounded w-1/3" />
                  <div className="h-3 bg-dark-600 rounded w-1/4" />
                  <div className="h-3 bg-dark-600 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto pb-28 md:pb-0">
      <h1 className="page-title mb-6">Lista de Controle</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {FILTER_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => {
              setFilter(key);
              setCurrentPage(1);
            }}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 ${
              filter === key
                ? key === 'up_to_date'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-brand-600 text-white shadow-sm'
                : 'bg-dark-700 text-gray-400 hover:text-white hover:bg-dark-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error */}
      {queryError && seasons.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-white font-semibold text-lg">Não foi possível carregar a lista</p>
          <p className="text-gray-400 text-sm mt-1">Verifique sua conexão e tente novamente.</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['userSeasonsProgress', user?.uid] })}
            className="btn-primary inline-flex mt-4"
          >
            Tentar novamente
          </button>
        </div>
      ) : seasons.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-500/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-brand-400" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18M3 9h18M3 15h18M3 21h18M3 3v18M7 3v18M11 3v18M15 3v18M21 3v18" />
            </svg>
          </div>
          <p className="text-white font-semibold text-lg">Nenhuma temporada registrada</p>
          <p className="text-gray-400 text-sm mt-1">Comece a assistir episódios para ver o progresso por temporada aqui.</p>
          <Link to="/search" className="btn-primary inline-flex mt-4">
            Buscar séries
          </Link>
        </div>
      ) : filteredSeasons.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-400 text-sm">Nenhuma temporada encontrada com este filtro.</p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dark-800/50 border-b border-dark-600">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Série</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Temporada</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Progresso</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Início</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Fim</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-600/50">
                  {paginatedSeasons.map((season) => (
                    <tr
                      key={`${season.showId}-${season.seasonNumber}`}
                      title={season.isLatestSeason ? 'Última temporada da série' : undefined}
                      className={`transition-colors ${
                        season.isLatestSeason
                          ? 'bg-brand-500/[0.07] hover:bg-brand-500/[0.12]'
                          : 'hover:bg-dark-700/50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Link to={`/show/${season.showId}`} className="flex items-center gap-3 hover:text-brand-400 transition-colors">
                          <div className="w-10 h-14 rounded-lg overflow-hidden bg-dark-500 shrink-0">
                            {season.posterPath ? (
                              <img src={getPosterUrl(season.posterPath, 'w185')!} alt={season.showTitle} loading="lazy" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-dark-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate">{season.showTitle}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/show/${season.showId}`} className="hover:text-brand-400 transition-colors">
                          <p className="font-medium text-white">{season.seasonName}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-2 progress-bar flex-shrink-0">
                            <div 
                              className="progress-fill" 
                              style={{ width: `${season.totalEpisodes > 0 ? (season.watchedEpisodes / season.totalEpisodes) * 100 : 0}%` }} 
                            />
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">
                            {season.watchedEpisodes}/{season.totalEpisodes} ep
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {editingSeason && editingSeason.showId === season.showId && editingSeason.seasonNumber === season.seasonNumber && editField === 'start' ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={editDate ? format(editDate!, 'yyyy-MM-dd') : ''}
                              onChange={(e) => setEditDate(e.target.value ? new Date(e.target.value) : null)}
                              className="input-field text-sm w-36"
                            />
                            <button
                              onClick={handleSaveEdit}
                              disabled={!editDate || updateEndDateMutation.isPending}
                              className="btn-primary text-xs py-1 px-2 disabled:opacity-50"
                            >
                              {updateEndDateMutation.isPending ? 'Salvando...' : 'Salvar'}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="text-gray-400 hover:text-white text-xs"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-white">
                            {formatDate(season.startDate)}{' '}
                            <button
                              onClick={() => handleEditClick(season, 'start')}
                              className="text-brand-400 hover:text-brand-300 text-xs font-medium transition-colors"
                              title="Editar data de início"
                            >
                              ✎
                            </button>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingSeason && editingSeason.showId === season.showId && editingSeason.seasonNumber === season.seasonNumber && editField === 'end' ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={editDate ? format(editDate!, 'yyyy-MM-dd') : ''}
                              onChange={(e) => setEditDate(e.target.value ? new Date(e.target.value) : null)}
                              className="input-field text-sm w-36"
                            />
                            <button
                              onClick={handleSaveEdit}
                              disabled={!editDate || updateEndDateMutation.isPending}
                              className="btn-primary text-xs py-1 px-2 disabled:opacity-50"
                            >
                              {updateEndDateMutation.isPending ? 'Salvando...' : 'Salvar'}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="text-gray-400 hover:text-white text-xs"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-white">
                            {formatDate(season.endDate)}{' '}
                            <button
                              onClick={() => handleEditClick(season, 'end')}
                              className="text-brand-400 hover:text-brand-300 text-xs font-medium transition-colors"
                              title="Editar data de fim"
                            >
                              ✎
                            </button>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${getSeasonStatusStyle(season)}`}>
                          {getSeasonStatusLabel(season)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-dark-600/50 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  Página {currentPage} de {totalPages} — {filteredSeasons.length} temporada{filteredSeasons.length !== 1 ? 's' : ''}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ControlListPage;