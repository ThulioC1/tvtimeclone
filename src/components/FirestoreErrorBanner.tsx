import { useAuth } from '../context/AuthContext';

export default function FirestoreErrorBanner() {
  const { dbError, setDbError } = useAuth();

  if (!dbError) return null;

  return (
    <div
      role="alert"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[90%] rounded-lg border border-red-500/40 bg-red-950/90 text-red-100 px-4 py-3 shadow-lg backdrop-blur"
    >
      <div className="flex items-start gap-3">
        <span className="text-lg leading-none">⚠️</span>
        <p className="flex-1 text-sm">{dbError}</p>
        <button
          onClick={() => setDbError(null)}
          className="text-red-300 hover:text-red-100 text-sm font-bold"
          aria-label="Fechar aviso"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
