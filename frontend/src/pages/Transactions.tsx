import { useEffect, useState, useMemo } from 'react';
import { transactionsApi } from '../services/api';
import type { Transaction, PaginatedResponse, TransactionStatus, TicketProduct, MatchedProduct } from '../types';
import { formatDate, formatCurrency, formatNumber } from '../lib/utils';
import {
  Search,
  Loader2,
  Eye,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  X,
  Download,
  Receipt,
  Package,
  ImageIcon,
  ShoppingBag,
  User,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Trash2,
  Edit3,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { exportApi } from '../services/api';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EditPointsModal } from '../components/EditPointsModal';

const statusConfig: Record<TransactionStatus, { label: string; icon: typeof CheckCircle; color: string; bg: string }> = {
  SUCCESS: { label: 'Succes', icon: CheckCircle, color: 'text-success-500', bg: 'bg-success-500/10' },
  FAILED: { label: 'Echec', icon: XCircle, color: 'text-error-500', bg: 'bg-error-500/10' },
  PENDING: { label: 'En attente', icon: Clock, color: 'text-warning-500', bg: 'bg-warning-500/10' },
  PARTIAL: { label: 'Partiel', icon: AlertTriangle, color: 'text-accent-500', bg: 'bg-accent-500/10' },
};

// Interface pour regrouper les transactions par utilisateur
interface UserGroup {
  userEmail: string;
  userName: string | null;
  userPhone: string | null;
  transactions: Transaction[];
  totalScans: number;
  totalAmount: number;
  totalEligible: number;
  totalPoints: number;
  lastScanDate: string;
  hasSuccess: boolean;
  hasPending: boolean;
  hasFailed: boolean;
}

// Fonction pour grouper les transactions par utilisateur
const groupTransactionsByUser = (transactions: Transaction[]): UserGroup[] => {
  const userMap = new Map<string, UserGroup>();

  for (const tx of transactions) {
    const existing = userMap.get(tx.userEmail);
    if (existing) {
      existing.transactions.push(tx);
      existing.totalScans++;
      existing.totalAmount += parseFloat(tx.totalAmount);
      existing.totalEligible += parseFloat(tx.eligibleAmount);
      existing.totalPoints += tx.pointsCalculated;
      if (new Date(tx.createdAt) > new Date(existing.lastScanDate)) {
        existing.lastScanDate = tx.createdAt;
        existing.userName = tx.userName || existing.userName;
        existing.userPhone = tx.userPhone || existing.userPhone;
      }
      if (tx.status === 'SUCCESS') existing.hasSuccess = true;
      if (tx.status === 'PENDING') existing.hasPending = true;
      if (tx.status === 'FAILED') existing.hasFailed = true;
    } else {
      userMap.set(tx.userEmail, {
        userEmail: tx.userEmail,
        userName: tx.userName,
        userPhone: tx.userPhone,
        transactions: [tx],
        totalScans: 1,
        totalAmount: parseFloat(tx.totalAmount),
        totalEligible: parseFloat(tx.eligibleAmount),
        totalPoints: tx.pointsCalculated,
        lastScanDate: tx.createdAt,
        hasSuccess: tx.status === 'SUCCESS',
        hasPending: tx.status === 'PENDING',
        hasFailed: tx.status === 'FAILED',
      });
    }
  }

  // Trier par date du dernier scan (plus recent en premier)
  return Array.from(userMap.values()).sort(
    (a, b) => new Date(b.lastScanDate).getTime() - new Date(a.lastScanDate).getTime()
  );
};

export function TransactionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    userEmail: '',
  });

  // Regroupement par utilisateur
  const userGroups = useMemo(() => groupTransactionsByUser(transactions), [transactions]);

  // Detail modal - maintenant pour un groupe d'utilisateur
  const [selectedUserGroup, setSelectedUserGroup] = useState<UserGroup | null>(null);
  const [currentScanIndex, setCurrentScanIndex] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);

  // Transaction actuellement affichee dans le modal
  const currentTransaction = selectedUserGroup?.transactions[currentScanIndex] || null;

  // Delete confirmation
  const [deleteTransaction, setDeleteTransaction] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit points modal
  const [editPointsUser, setEditPointsUser] = useState<UserGroup | null>(null);

  const fetchTransactions = async (page = 1) => {
    setIsLoading(true);
    try {
      const response: PaginatedResponse<Transaction> = await transactionsApi.getAll({
        page,
        limit: 20,
        status: filters.status || undefined,
        userEmail: filters.userEmail || undefined,
      });
      setTransactions(response.data);
      setPagination({
        page: response.pagination.page,
        total: response.pagination.total,
        totalPages: response.pagination.totalPages,
      });
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [filters]);

  // Ouvrir le detail d'un groupe d'utilisateur
  const openUserDetail = async (userGroup: UserGroup) => {
    setDetailLoading(true);
    setCurrentScanIndex(0);
    try {
      // Charger les details complets de toutes les transactions de cet utilisateur
      const detailedTransactions = await Promise.all(
        userGroup.transactions.map(tx =>
          transactionsApi.getById(tx.id)
            .then(r => r.data)
            .catch(err => {
              console.error(`Error fetching transaction ${tx.id}:`, err);
              // Return the basic transaction data if detail fetch fails
              return tx;
            })
        )
      );
      // Trier par date (plus recent en premier)
      detailedTransactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSelectedUserGroup({
        ...userGroup,
        transactions: detailedTransactions,
      });
    } catch (err) {
      console.error('Error fetching user transactions:', err);
      // Even if there's an error, show the modal with basic data
      setSelectedUserGroup(userGroup);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReprocess = async (id: number) => {
    if (!confirm('Voulez-vous retraiter cette transaction ?')) return;
    try {
      await transactionsApi.reprocess(id, true);
      fetchTransactions(pagination.page);
      // Recharger le groupe si on est dans le modal
      if (selectedUserGroup) {
        openUserDetail(selectedUserGroup);
      }
    } catch (err) {
      console.error('Error reprocessing transaction:', err);
    }
  };

  // Navigation entre les scans
  const goToPreviousScan = () => {
    if (currentScanIndex > 0) {
      setCurrentScanIndex(currentScanIndex - 1);
    }
  };

  const goToNextScan = () => {
    if (selectedUserGroup && currentScanIndex < selectedUserGroup.transactions.length - 1) {
      setCurrentScanIndex(currentScanIndex + 1);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportApi.transactions(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting transactions:', err);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!deleteTransaction) return;
    setIsDeleting(true);
    try {
      await transactionsApi.delete(deleteTransaction.id);
      setDeleteTransaction(null);
      // Si on supprime depuis le modal, fermer le modal et recharger
      if (selectedUserGroup) {
        // Retirer la transaction supprimee du groupe
        const updatedTransactions = selectedUserGroup.transactions.filter(t => t.id !== deleteTransaction.id);
        if (updatedTransactions.length === 0) {
          setSelectedUserGroup(null);
          setCurrentScanIndex(0);
        } else {
          setSelectedUserGroup({
            ...selectedUserGroup,
            transactions: updatedTransactions,
            totalScans: updatedTransactions.length,
          });
          if (currentScanIndex >= updatedTransactions.length) {
            setCurrentScanIndex(updatedTransactions.length - 1);
          }
        }
      }
      fetchTransactions(pagination.page);
    } catch (err) {
      console.error('Error deleting transaction:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600">
            <Receipt className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Transactions</h1>
            <p className="text-[var(--text-secondary)]">Historique des tickets traites</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 border border-[var(--border-glass)] rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-all duration-300"
          >
            <Download className="w-4 h-4 mr-2" />
            Exporter CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="glass rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <input
              type="text"
              placeholder="Rechercher par email..."
              value={filters.userEmail}
              onChange={(e) => setFilters({ ...filters, userEmail: e.target.value })}
              className="w-full pl-10 pr-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
          >
            <option value="">Tous les statuts</option>
            <option value="SUCCESS">Succes</option>
            <option value="FAILED">Echec</option>
            <option value="PENDING">En attente</option>
            <option value="PARTIAL">Partiel</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : userGroups.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">
            Aucune transaction trouvee
          </div>
        ) : (
          <>
            {/* Mobile: Card View - Grouped by user */}
            <div className="block md:hidden divide-y divide-[var(--border-glass)]">
              {userGroups.map((group) => (
                <div key={group.userEmail} className="p-4 hover:bg-[var(--bg-tertiary)] transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-primary-500" />
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate">{group.userEmail}</span>
                      </div>
                      {group.userName && (
                        <p className="text-xs text-[var(--text-tertiary)] truncate ml-6">{group.userName}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 ml-6">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-500/10 text-primary-500">
                          {group.totalScans} scan{group.totalScans > 1 ? 's' : ''}
                        </span>
                        {group.hasSuccess && <CheckCircle className="w-3 h-3 text-success-500" />}
                        {group.hasPending && <Clock className="w-3 h-3 text-warning-500" />}
                        {group.hasFailed && <XCircle className="w-3 h-3 text-error-500" />}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm ml-6">
                        <span className="text-[var(--text-secondary)]">{formatCurrency(group.totalAmount)}</span>
                        <span className="font-medium text-primary-600">
                          {formatNumber(group.totalPoints)} pts
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-tertiary)] mt-1 ml-6">
                        Dernier: {formatDate(group.lastScanDate)}
                      </p>
                    </div>
                    <button
                      onClick={() => openUserDetail(group)}
                      className="text-[var(--text-tertiary)] hover:text-primary-500 p-2 rounded-lg hover:bg-primary-500/10 transition-all flex-shrink-0"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Table View - Grouped by user */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[var(--border-glass)]">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Utilisateur
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Scans
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Eligible
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Points
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Statuts
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Dernier scan
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-glass)]">
                  {userGroups.map((group) => (
                    <tr key={group.userEmail} className="hover:bg-[var(--bg-tertiary)] transition-colors duration-200">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary-500/10">
                            <User className="w-4 h-4 text-primary-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[var(--text-primary)]">{group.userEmail}</p>
                            {group.userName && (
                              <p className="text-xs text-[var(--text-tertiary)]">{group.userName}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary-500/10 text-primary-500">
                          {group.totalScans} scan{group.totalScans > 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-primary)]">
                        {formatCurrency(group.totalAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-success-500 font-medium">
                        {formatCurrency(group.totalEligible)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-bold text-primary-500">
                          {formatNumber(group.totalPoints)} pts
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {group.hasSuccess && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-500/10 text-success-500">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              OK
                            </span>
                          )}
                          {group.hasPending && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning-500/10 text-warning-500">
                              <Clock className="w-3 h-3 mr-1" />
                              En attente
                            </span>
                          )}
                          {group.hasFailed && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-error-500/10 text-error-500">
                              <XCircle className="w-3 h-3 mr-1" />
                              Echec
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-secondary)]">
                        {formatDate(group.lastScanDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-1">
                          {isAdmin && (
                            <button
                              onClick={() => setEditPointsUser(group)}
                              className="text-[var(--text-tertiary)] hover:text-purple-500 p-2 rounded-lg hover:bg-purple-500/10 transition-all duration-200"
                              title="Modifier les points"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openUserDetail(group)}
                            className="text-[var(--text-tertiary)] hover:text-primary-500 p-2 rounded-lg hover:bg-primary-500/10 transition-all duration-200"
                            title="Voir les details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-[var(--border-glass)] flex items-center justify-between">
            <p className="text-sm text-[var(--text-secondary)]">
              {userGroups.length} utilisateur{userGroups.length > 1 ? 's' : ''} ({pagination.total} transaction{pagination.total > 1 ? 's' : ''})
            </p>
            <div className="flex gap-2">
              {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => fetchTransactions(page)}
                  className={`px-3 py-1 rounded-lg text-sm transition-all duration-200 ${
                    page === pagination.page
                      ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-primary-500/10 hover:text-primary-500'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal - User Group */}
      {(selectedUserGroup || detailLoading) && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => { setSelectedUserGroup(null); setCurrentScanIndex(0); }}
            />
            <div className="relative glass-strong rounded-2xl shadow-2xl max-w-6xl w-full p-6 max-h-[90vh] overflow-y-auto border border-[var(--border-glass)]">
              {detailLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                </div>
              ) : selectedUserGroup && currentTransaction && (
                <>
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 to-purple-500 rounded-t-2xl" />

                  {/* Header avec info utilisateur */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                          {selectedUserGroup.userEmail}
                        </h3>
                        {selectedUserGroup.userName && (
                          <p className="text-sm text-[var(--text-secondary)]">{selectedUserGroup.userName}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-[var(--text-tertiary)]">
                            {selectedUserGroup.totalScans} scan{selectedUserGroup.totalScans > 1 ? 's' : ''} au total
                          </span>
                          <span className="text-xs font-bold text-primary-500">
                            {formatNumber(selectedUserGroup.totalPoints)} pts cumules
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => { setSelectedUserGroup(null); setCurrentScanIndex(0); }}
                      className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all duration-200"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Navigation entre les scans si plusieurs */}
                  {selectedUserGroup.transactions.length > 1 && (
                    <div className="mb-6 p-4 rounded-xl bg-[var(--bg-tertiary)]">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={goToPreviousScan}
                          disabled={currentScanIndex === 0}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                            currentScanIndex === 0
                              ? 'opacity-50 cursor-not-allowed text-[var(--text-tertiary)]'
                              : 'hover:bg-primary-500/10 text-primary-500'
                          }`}
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Precedent
                        </button>

                        <div className="flex items-center gap-2">
                          {selectedUserGroup.transactions.map((tx, idx) => (
                            <button
                              key={tx.id}
                              onClick={() => setCurrentScanIndex(idx)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                idx === currentScanIndex
                                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-primary-500/10'
                              }`}
                            >
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(tx.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                              </span>
                            </button>
                          ))}
                        </div>

                        <button
                          onClick={goToNextScan}
                          disabled={currentScanIndex === selectedUserGroup.transactions.length - 1}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                            currentScanIndex === selectedUserGroup.transactions.length - 1
                              ? 'opacity-50 cursor-not-allowed text-[var(--text-tertiary)]'
                              : 'hover:bg-primary-500/10 text-primary-500'
                          }`}
                        >
                          Suivant
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-center text-xs text-[var(--text-tertiary)] mt-2">
                        Scan {currentScanIndex + 1} sur {selectedUserGroup.transactions.length}
                      </p>
                    </div>
                  )}

                  <div className="space-y-6">
                    {/* Info du scan actuel */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-[var(--bg-tertiary)]">
                        <p className="text-xs text-[var(--text-tertiary)] mb-1">Transaction ID</p>
                        <p className="font-medium text-[var(--text-primary)] text-sm">#{currentTransaction.id}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[var(--bg-tertiary)]">
                        <p className="text-xs text-[var(--text-tertiary)] mb-1">Ticket ID</p>
                        <p className="font-medium font-mono text-xs text-[var(--text-primary)] truncate">{currentTransaction.ticketId}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[var(--bg-tertiary)]">
                        <p className="text-xs text-[var(--text-tertiary)] mb-1">Date du scan</p>
                        <p className="font-medium text-[var(--text-primary)] text-sm">{formatDate(currentTransaction.createdAt)}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[var(--bg-tertiary)]">
                        <p className="text-xs text-[var(--text-tertiary)] mb-1">Statut</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[currentTransaction.status].bg} ${statusConfig[currentTransaction.status].color}`}>
                          {statusConfig[currentTransaction.status].label}
                        </span>
                      </div>
                    </div>

                    {/* Layout flex : Image à gauche, Produits à droite */}
                    <div className="flex flex-col lg:flex-row gap-6">
                      {/* Image du ticket - Colonne gauche */}
                      <div className="lg:w-1/2">
                        <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] h-full">
                          <div className="flex items-center gap-2 mb-3">
                            <ImageIcon className="w-4 h-4 text-primary-500" />
                            <p className="text-sm font-medium text-[var(--text-primary)]">Ticket de caisse</p>
                          </div>
                          {currentTransaction.ticketImageBase64 ? (
                            <div className="relative group">
                              <img
                                src={`data:image/jpeg;base64,${currentTransaction.ticketImageBase64}`}
                                alt="Ticket de caisse"
                                className="w-full max-h-[500px] object-contain rounded-lg border border-[var(--border-glass)] cursor-zoom-in"
                                onClick={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  if (img.requestFullscreen) img.requestFullscreen();
                                }}
                              />
                              <p className="text-xs text-[var(--text-tertiary)] text-center mt-2">
                                Cliquez pour agrandir
                              </p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-[var(--text-tertiary)]">
                              <Receipt className="w-12 h-12 mb-2 opacity-30" />
                              <p className="text-sm">Pas d'image disponible</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Liste des produits - Colonne droite */}
                      <div className="lg:w-1/2">
                        <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] h-full">
                          <div className="flex items-center gap-2 mb-3">
                            <ShoppingBag className="w-4 h-4 text-primary-500" />
                            <p className="text-sm font-medium text-[var(--text-primary)]">Produits detectes</p>
                          </div>

                          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                            {currentTransaction.matchedProducts && currentTransaction.matchedProducts.length > 0 ? (
                              <>
                                {(currentTransaction.matchedProducts as MatchedProduct[]).map((mp, idx) => (
                                  <div
                                    key={idx}
                                    className={`flex items-center justify-between p-3 rounded-lg border ${
                                      mp.matched
                                        ? 'bg-success-500/5 border-success-500/20'
                                        : 'bg-error-500/5 border-error-500/20'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      {mp.matched ? (
                                        <CheckCircle className="w-4 h-4 text-success-500 flex-shrink-0" />
                                      ) : (
                                        <XCircle className="w-4 h-4 text-error-500 flex-shrink-0" />
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                                          {mp.ticketProduct.name}
                                        </p>
                                        {mp.matched && mp.matchedProductName && (
                                          <p className="text-xs text-success-600 truncate">
                                            → {mp.matchedProductName}
                                            {mp.matchMethod && (
                                              <span className="ml-1 text-[10px] opacity-70">({mp.matchMethod})</span>
                                            )}
                                          </p>
                                        )}
                                        <p className="text-xs text-[var(--text-tertiary)]">
                                          {mp.ticketProduct.quantity} x {formatCurrency(mp.ticketProduct.price)}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-2">
                                      <p className={`text-sm font-medium ${mp.matched ? 'text-success-600' : 'text-[var(--text-tertiary)] line-through'}`}>
                                        {formatCurrency(mp.ticketProduct.price * mp.ticketProduct.quantity)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </>
                            ) : currentTransaction.ticketProducts && (currentTransaction.ticketProducts as TicketProduct[]).length > 0 ? (
                              <>
                                {(currentTransaction.ticketProducts as TicketProduct[]).map((p, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-glass)]"
                                  >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <Package className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{p.name}</p>
                                        <p className="text-xs text-[var(--text-tertiary)]">
                                          {p.quantity} x {formatCurrency(p.price)}
                                        </p>
                                      </div>
                                    </div>
                                    <p className="text-sm font-medium text-[var(--text-primary)] flex-shrink-0 ml-2">
                                      {formatCurrency(p.price * p.quantity)}
                                    </p>
                                  </div>
                                ))}
                              </>
                            ) : (
                              <p className="text-sm text-[var(--text-tertiary)]">Aucun produit</p>
                            )}
                          </div>

                          {/* Compteur produits */}
                          {currentTransaction.matchedProducts && currentTransaction.matchedProducts.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-[var(--border-glass)] flex justify-between text-xs">
                              <span className="text-success-500">
                                {(currentTransaction.matchedProducts as MatchedProduct[]).filter(m => m.matched).length} comptabilise(s)
                              </span>
                              <span className="text-error-500">
                                {(currentTransaction.matchedProducts as MatchedProduct[]).filter(m => !m.matched).length} non valide(s)
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Resume des points de ce scan */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-primary-500/10 to-purple-500/10 border border-primary-500/20">
                      <p className="text-xs text-[var(--text-tertiary)] mb-3 text-center">Points de ce scan</p>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-[var(--text-tertiary)] mb-1">Montant total</p>
                          <p className="text-xl font-bold text-[var(--text-primary)]">
                            {formatCurrency(currentTransaction.totalAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--text-tertiary)] mb-1">Montant eligible</p>
                          <p className="text-xl font-bold text-success-500">
                            {formatCurrency(currentTransaction.eligibleAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--text-tertiary)] mb-1">Points gagnes</p>
                          <p className="text-xl font-bold text-primary-500">
                            {formatNumber(currentTransaction.pointsCalculated)} pts
                            {currentTransaction.pointsAwarded && (
                              <CheckCircle className="inline w-4 h-4 ml-1 text-success-500" />
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Resume total utilisateur (si plusieurs scans) */}
                    {selectedUserGroup.transactions.length > 1 && (
                      <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                        <p className="text-xs text-[var(--text-tertiary)] mb-3 text-center">Total cumule ({selectedUserGroup.totalScans} scans)</p>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-xs text-[var(--text-tertiary)] mb-1">Total depense</p>
                            <p className="text-xl font-bold text-[var(--text-primary)]">
                              {formatCurrency(selectedUserGroup.totalAmount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--text-tertiary)] mb-1">Total eligible</p>
                            <p className="text-xl font-bold text-success-500">
                              {formatCurrency(selectedUserGroup.totalEligible)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--text-tertiary)] mb-1">Points cumules</p>
                            <p className="text-xl font-bold text-purple-500">
                              {formatNumber(selectedUserGroup.totalPoints)} pts
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {currentTransaction.errorMessage && (
                      <div className="p-4 rounded-xl bg-error-500/10 border border-error-500/20">
                        <p className="text-sm text-error-500">{currentTransaction.errorMessage}</p>
                      </div>
                    )}

                    {/* Actions si admin */}
                    {isAdmin && (
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => setEditPointsUser(selectedUserGroup)}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition-all"
                        >
                          <Edit3 className="w-4 h-4" />
                          Modifier les points
                        </button>
                        {(currentTransaction.status === 'FAILED' || currentTransaction.status === 'PENDING') && (
                          <button
                            onClick={() => handleReprocess(currentTransaction.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-all"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Retraiter ce scan
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTransaction(currentTransaction)}
                          className="flex items-center gap-2 px-4 py-2 bg-error-500 hover:bg-error-600 text-white rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                          Supprimer ce scan
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTransaction}
        title="Supprimer la transaction"
        message={`Etes-vous sur de vouloir supprimer cette transaction (ID: ${deleteTransaction?.id}) ? Cette action supprimera toutes les donnees associees et est irreversible.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
        onConfirm={handleDeleteTransaction}
        onCancel={() => setDeleteTransaction(null)}
        isLoading={isDeleting}
      />

      {/* Edit Points Modal */}
      <EditPointsModal
        isOpen={!!editPointsUser}
        userEmail={editPointsUser?.userEmail || ''}
        userName={editPointsUser?.userName}
        currentPoints={editPointsUser?.totalPoints || 0}
        onClose={() => setEditPointsUser(null)}
        onSuccess={() => {
          fetchTransactions(pagination.page);
          // Recharger les details du groupe si on est dans le modal
          if (selectedUserGroup) {
            openUserDetail(selectedUserGroup);
          }
        }}
      />
    </div>
  );
}
