import React from 'react';
import { getPosterUrl } from '../lib/tvmaze';
import { getBannerUrl, type UserShow } from '../lib/firestore';

interface Props {
  open: boolean;
  shows: UserShow[];
  currentBannerShowId: number | string | null;
  saving: boolean;
  onClose: () => void;
  onPick: (showId: number | string | null) => void;
}

const BannerPickerModal: React.FC<Props> = ({
  open,
  shows,
  currentBannerShowId,
  saving,
  onClose,
  onPick,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto bg-dark-850 rounded-t-2xl sm:rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Escolha seu banner</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        {shows.length === 0 ? (
          <p className="text-gray-400 text-sm">Você ainda não tem séries na sua lista.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {shows.map((s) => {
                const selected = String(s.showId) === String(currentBannerShowId);
                const img = getBannerUrl([s], s.showId) || getPosterUrl(s.posterPath);
                return (
                  <button
                    key={String(s.showId)}
                    onClick={() => onPick(s.showId)}
                    disabled={saving}
                    className={`relative aspect-video rounded-xl overflow-hidden ring-2 transition ${
                      selected ? 'ring-brand-500' : 'ring-transparent hover:ring-white/30'
                    }`}
                  >
                    {img ? (
                      <img src={img} alt={s.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-dark-700 flex items-center justify-center text-xs text-gray-400 px-1 text-center">
                        {s.title}
                      </div>
                    )}
                    {selected && (
                      <span className="absolute top-1 right-1 bg-brand-500 text-white text-[10px] px-1.5 py-0.5 rounded">
                        Atual
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => onPick(null)}
              disabled={saving}
              className="btn-secondary w-full text-sm"
            >
              Remover banner (usar gradiente)
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default BannerPickerModal;
