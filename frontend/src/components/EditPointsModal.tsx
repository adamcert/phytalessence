import { useState, useEffect } from 'react';
import { usersApi } from '../services/api';
import { formatNumber } from '../lib/utils';
import {
  Loader2,
  X,
  Edit3,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface EditPointsModalProps {
  isOpen: boolean;
  userEmail: string;
  userName?: string | null;
  currentPoints: number;
  onClose: () => void;
  onSuccess: () => void;
  onPointsSynced?: (newPoints: number) => void;
}

export function EditPointsModal({
  isOpen,
  userEmail,
  userName,
  currentPoints,
  onClose,
  onSuccess,
  onPointsSynced,
}: EditPointsModalProps) {
  const [pointsToAdjust, setPointsToAdjust] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [sendNotification, setSendNotification] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSuccess, setAdjustSuccess] = useState(false);

  // Certhis points sync
  const [certhisPoints, setCerthisPoints] = useState<number | null>(null);
  const [isFetchingPoints, setIsFetchingPoints] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch Certhis points when modal opens
  useEffect(() => {
    if (isOpen && userEmail) {
      fetchCerthisPoints();
    }
  }, [isOpen, userEmail]);

  const fetchCerthisPoints = async () => {
    setIsFetchingPoints(true);
    setFetchError(null);
    try {
      const result = await usersApi.getCerthisPoints(userEmail);
      if (result.success) {
        setCerthisPoints(result.points);
        // Notify parent to update users table if points differ from local
        if (onPointsSynced && result.points !== currentPoints) {
          onPointsSynced(result.points);
        }
      } else {
        setFetchError(result.error || 'Erreur de synchronisation');
        setCerthisPoints(null);
      }
    } catch (err) {
      console.error('Error fetching Certhis points:', err);
      setFetchError('Impossible de récupérer les points');
      setCerthisPoints(null);
    } finally {
      setIsFetchingPoints(false);
    }
  };

  // Use Certhis points if available, otherwise fallback to passed currentPoints
  const displayPoints = certhisPoints !== null ? certhisPoints : currentPoints;

  const handleClose = () => {
    if (isAdjusting) return;
    setPointsToAdjust(0);
    setAdjustReason('');
    setSendNotification(false);
    setAdjustError(null);
    setAdjustSuccess(false);
    setCerthisPoints(null);
    setFetchError(null);
    onClose();
  };

  const handleAdjustPoints = async () => {
    if (pointsToAdjust === 0 || adjustReason.trim().length < 3) return;

    setIsAdjusting(true);
    setAdjustError(null);

    try {
      // Send delta directly - backend fetches current points from Certhis (source of truth)
      await usersApi.adjustPoints(userEmail, pointsToAdjust, adjustReason, sendNotification);
      setAdjustSuccess(true);
      // Notify parent and close after delay
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 1500);
    } catch (err) {
      console.error('Error adjusting points:', err);
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setAdjustError(
        error.response?.data?.message ||
        error.message ||
        'Erreur lors de la modification des points'
      );
    } finally {
      setIsAdjusting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        />
        <div className="relative glass-strong rounded-2xl shadow-2xl max-w-md w-full p-6 border border-[var(--border-glass)]">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-t-2xl" />

          {adjustSuccess ? (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Points modifies</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                {pointsToAdjust > 0 ? '+' : ''}{pointsToAdjust} points pour {userEmail}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">Modifier les points</h3>
                  <p className="text-sm text-[var(--text-secondary)]">{userEmail}</p>
                  {userName && <p className="text-xs text-[var(--text-tertiary)]">{userName}</p>}
                </div>
                <button
                  onClick={handleClose}
                  disabled={isAdjusting}
                  className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all duration-200 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 p-4 rounded-xl bg-[var(--bg-tertiary)]">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm text-[var(--text-tertiary)]">Points actuels</p>
                  <button
                    onClick={fetchCerthisPoints}
                    disabled={isFetchingPoints}
                    className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-purple-500 transition-all disabled:opacity-50"
                    title="Rafraichir"
                  >
                    <RefreshCw className={`w-4 h-4 ${isFetchingPoints ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                {isFetchingPoints ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                    <span className="text-sm text-[var(--text-secondary)]">Synchronisation...</span>
                  </div>
                ) : fetchError ? (
                  <div className="flex items-center gap-2 text-orange-500">
                    <AlertCircle className="w-5 h-5" />
                    <div>
                      <p className="text-2xl font-bold">{formatNumber(currentPoints)} pts</p>
                      <p className="text-xs">(local - {fetchError})</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-purple-500">
                    {formatNumber(displayPoints)} pts
                    {certhisPoints !== null && certhisPoints !== currentPoints && (
                      <span className="text-xs font-normal text-green-500 ml-2">(synchro)</span>
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Points a ajouter/retirer
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPointsToAdjust(Math.max(pointsToAdjust - 10, -10000))}
                      className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
                    >
                      <TrendingDown className="w-5 h-5" />
                    </button>
                    <input
                      type="number"
                      value={pointsToAdjust}
                      onChange={(e) => setPointsToAdjust(parseInt(e.target.value) || 0)}
                      className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-glass)] rounded-xl text-center text-lg font-bold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                    <button
                      onClick={() => setPointsToAdjust(Math.min(pointsToAdjust + 10, 10000))}
                      className="p-2 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-all"
                    >
                      <TrendingUp className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1 text-center">
                    Nouveau total: {formatNumber(displayPoints + pointsToAdjust)} pts
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Raison (obligatoire, min 3 caractères)
                  </label>
                  <textarea
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Ex: Compensation service client, correction erreur..."
                    rows={3}
                    className="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                  />
                  {adjustReason.trim().length > 0 && adjustReason.trim().length < 3 && (
                    <p className="text-xs text-orange-500 mt-1">Minimum 3 caractères requis</p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="sendNotification"
                    checked={sendNotification}
                    onChange={(e) => setSendNotification(e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--border-glass)] bg-[var(--bg-tertiary)] text-purple-500 focus:ring-purple-500/50"
                  />
                  <label htmlFor="sendNotification" className="text-sm text-[var(--text-secondary)]">
                    Envoyer une notification au client
                  </label>
                </div>

                {adjustError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-sm text-red-500">{adjustError}</p>
                  </div>
                )}

                <button
                  onClick={handleAdjustPoints}
                  disabled={isAdjusting || pointsToAdjust === 0 || adjustReason.trim().length < 3}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isAdjusting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Modification en cours...
                    </>
                  ) : (
                    <>
                      <Edit3 className="w-4 h-4" />
                      {pointsToAdjust > 0 ? 'Ajouter' : pointsToAdjust < 0 ? 'Retirer' : 'Modifier'} les points
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
