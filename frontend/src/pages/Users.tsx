import { useEffect, useState } from 'react';
import { usersApi, transactionsApi } from '../services/api';
import type { PaginatedResponse, UserSummary, Transaction, MatchedProduct, TicketProduct } from '../types';
import { formatDate, formatCurrency, formatNumber } from '../lib/utils';
import {
  Search,
  Loader2,
  Eye,
  Users as UsersIcon,
  Mail,
  Phone,
  Calendar,
  TrendingUp,
  X,
  Edit3,
  CheckCircle,
  XCircle,
  Clock,
  Receipt,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Package,
  ImageIcon,
  ShoppingBag,
  History,
  TrendingDown,
} from 'lucide-react';

interface PointsAdjustment {
  id: number;
  pointsBefore: number;
  pointsAfter: number;
  delta: number;
  reason: string;
  createdAt: string;
  admin: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}
import { useAuth } from '../contexts/AuthContext';
import { EditPointsModal } from '../components/EditPointsModal';

type SortField = 'userEmail' | 'userName' | 'totalTransactions' | 'totalAmount' | 'totalPoints' | 'lastTransactionDate';
type SortOrder = 'asc' | 'desc';

const statusConfig = {
  SUCCESS: { label: 'Succes', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
  FAILED: { label: 'Echec', icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
  PENDING: { label: 'En attente', icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  PARTIAL: { label: 'Partiel', icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10' },
};

export function UsersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('totalPoints');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Detail modal
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [userTransactions, setUserTransactions] = useState<Transaction[]>([]);
  const [userAdjustments, setUserAdjustments] = useState<PointsAdjustment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentTxIndex, setCurrentTxIndex] = useState(0);
  const [currentTxDetail, setCurrentTxDetail] = useState<Transaction | null>(null);
  const [activeTab, setActiveTab] = useState<'transactions' | 'adjustments'>('transactions');

  // Edit points modal
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);

  const fetchUsers = async (page = 1) => {
    setIsLoading(true);
    try {
      const response: PaginatedResponse<UserSummary> = await usersApi.getAll({
        page,
        limit: 20,
        search: search || undefined,
        sortBy,
        sortOrder,
      });
      setUsers(response.data);
      setPagination({
        page: response.pagination.page,
        total: response.pagination.total,
        totalPages: response.pagination.totalPages,
      });
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(debounce);
  }, [search, sortBy, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline ml-1" />
    );
  };

  const openUserDetail = async (userSummary: UserSummary) => {
    setDetailLoading(true);
    setSelectedUser(userSummary);
    setCurrentTxIndex(0);
    setCurrentTxDetail(null);
    setActiveTab('transactions');
    setUserAdjustments([]);
    try {
      // Fetch transactions and adjustments in parallel
      const [txResponse, adjResponse] = await Promise.all([
        usersApi.getTransactions(userSummary.userEmail, { limit: 50 }),
        usersApi.getAdjustments(userSummary.userEmail, { limit: 50 }),
      ]);
      const txList = txResponse.data as Transaction[];
      setUserTransactions(txList);
      setUserAdjustments(adjResponse.data as PointsAdjustment[]);
      // Load first transaction detail
      if (txList.length > 0) {
        const detail = await transactionsApi.getById(txList[0].id);
        setCurrentTxDetail(detail.data);
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const loadTransactionDetail = async (index: number) => {
    if (userTransactions[index]) {
      setCurrentTxIndex(index);
      try {
        const detail = await transactionsApi.getById(userTransactions[index].id);
        setCurrentTxDetail(detail.data);
      } catch (err) {
        console.error('Error loading transaction detail:', err);
      }
    }
  };

  const currentTx = currentTxDetail || userTransactions[currentTxIndex];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600">
            <UsersIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Utilisateurs</h1>
            <p className="text-[var(--text-secondary)]">Gestion des utilisateurs et points</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="glass rounded-2xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
          <input
            type="text"
            placeholder="Rechercher par email ou nom..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">
            Aucun utilisateur trouve
          </div>
        ) : (
          <>
            {/* Mobile: Card View */}
            <div className="block md:hidden divide-y divide-[var(--border-glass)]">
              {users.map((u) => (
                <div key={u.userEmail} className="p-4 hover:bg-[var(--bg-tertiary)] transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Mail className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate">{u.userEmail}</span>
                      </div>
                      {u.userName && (
                        <p className="text-xs text-[var(--text-tertiary)] truncate ml-6">{u.userName}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 ml-6 text-sm">
                        <span className="text-[var(--text-secondary)]">{u.totalTransactions} scans</span>
                        <span className="font-bold text-purple-500">{formatNumber(u.totalPoints)} pts</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {isAdmin && (
                        <button
                          onClick={() => setEditingUser(u)}
                          className="text-[var(--text-tertiary)] hover:text-purple-500 p-2 rounded-lg hover:bg-purple-500/10 transition-all"
                          title="Modifier points"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => openUserDetail(u)}
                        className="text-[var(--text-tertiary)] hover:text-purple-500 p-2 rounded-lg hover:bg-purple-500/10 transition-all"
                        title="Voir details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[var(--border-glass)]">
                    <th
                      className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:text-purple-500"
                      onClick={() => handleSort('userEmail')}
                    >
                      Email <SortIcon field="userEmail" />
                    </th>
                    <th
                      className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:text-purple-500"
                      onClick={() => handleSort('userName')}
                    >
                      Nom <SortIcon field="userName" />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Telephone
                    </th>
                    <th
                      className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:text-purple-500"
                      onClick={() => handleSort('totalTransactions')}
                    >
                      Scans <SortIcon field="totalTransactions" />
                    </th>
                    <th
                      className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:text-purple-500"
                      onClick={() => handleSort('totalAmount')}
                    >
                      Total Achats <SortIcon field="totalAmount" />
                    </th>
                    <th
                      className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:text-purple-500"
                      onClick={() => handleSort('totalPoints')}
                    >
                      Points <SortIcon field="totalPoints" />
                    </th>
                    <th
                      className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:text-purple-500"
                      onClick={() => handleSort('lastTransactionDate')}
                    >
                      Dernier Scan <SortIcon field="lastTransactionDate" />
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-glass)]">
                  {users.map((u) => (
                    <tr key={u.userEmail} className="hover:bg-[var(--bg-tertiary)] transition-colors duration-200">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-purple-500/10">
                            <Mail className="w-4 h-4 text-purple-500" />
                          </div>
                          <span className="text-sm font-medium text-[var(--text-primary)]">{u.userEmail}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-secondary)]">
                        {u.userName || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-secondary)]">
                        {u.userPhone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-500">
                          {u.totalTransactions} scan{u.totalTransactions > 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-primary)]">
                        {formatCurrency(u.totalAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-bold text-purple-500">
                          {formatNumber(u.totalPoints)} pts
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-secondary)]">
                        {u.lastTransactionDate ? formatDate(u.lastTransactionDate) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-1">
                          {isAdmin && (
                            <button
                              onClick={() => setEditingUser(u)}
                              className="text-[var(--text-tertiary)] hover:text-purple-500 p-2 rounded-lg hover:bg-purple-500/10 transition-all duration-200"
                              title="Modifier points"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openUserDetail(u)}
                            className="text-[var(--text-tertiary)] hover:text-purple-500 p-2 rounded-lg hover:bg-purple-500/10 transition-all duration-200"
                            title="Voir details"
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
              {pagination.total} utilisateur{pagination.total > 1 ? 's' : ''}
            </p>
            <div className="flex gap-2">
              {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => fetchUsers(page)}
                  className={`px-3 py-1 rounded-lg text-sm transition-all duration-200 ${
                    page === pagination.page
                      ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-purple-500/10 hover:text-purple-500'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User Detail Modal - Style similaire a Transactions */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => { setSelectedUser(null); setCurrentTxIndex(0); setCurrentTxDetail(null); }}
            />
            <div className="relative glass-strong rounded-2xl shadow-2xl max-w-6xl w-full p-6 max-h-[90vh] overflow-y-auto border border-[var(--border-glass)]">
              {detailLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
              ) : (
                <>
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-t-2xl" />

                  {/* Header avec info utilisateur */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                        <UsersIcon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                          {selectedUser.userEmail}
                        </h3>
                        {selectedUser.userName && (
                          <p className="text-sm text-[var(--text-secondary)]">{selectedUser.userName}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          {selectedUser.userPhone && (
                            <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                              <Phone className="w-3 h-3" /> {selectedUser.userPhone}
                            </span>
                          )}
                          <span className="text-xs text-[var(--text-tertiary)]">
                            {selectedUser.totalTransactions} scan{selectedUser.totalTransactions > 1 ? 's' : ''} au total
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <button
                          onClick={() => setEditingUser(selectedUser)}
                          className="flex items-center gap-2 px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition-all text-sm"
                        >
                          <Edit3 className="w-4 h-4" />
                          Modifier points
                        </button>
                      )}
                      <button
                        onClick={() => { setSelectedUser(null); setCurrentTxIndex(0); setCurrentTxDetail(null); }}
                        className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all duration-200"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Stats utilisateur */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]">
                      <div className="flex items-center gap-2 mb-2">
                        <Receipt className="w-4 h-4 text-purple-500" />
                        <span className="text-xs text-[var(--text-tertiary)]">Scans</span>
                      </div>
                      <p className="text-xl font-bold text-[var(--text-primary)]">{selectedUser.totalTransactions}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        <span className="text-xs text-[var(--text-tertiary)]">Total Achats</span>
                      </div>
                      <p className="text-xl font-bold text-[var(--text-primary)]">{formatCurrency(selectedUser.totalAmount)}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-xs text-[var(--text-tertiary)]">Eligible</span>
                      </div>
                      <p className="text-xl font-bold text-green-500">{formatCurrency(selectedUser.totalEligible)}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-purple-500" />
                        <span className="text-xs text-[var(--text-tertiary)]">Points cumules</span>
                      </div>
                      <p className="text-xl font-bold text-purple-500">{formatNumber(selectedUser.totalPoints)} pts</p>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-2 mb-6 border-b border-[var(--border-glass)]">
                    <button
                      onClick={() => setActiveTab('transactions')}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px ${
                        activeTab === 'transactions'
                          ? 'border-purple-500 text-purple-500'
                          : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Receipt className="w-4 h-4" />
                      Transactions ({userTransactions.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('adjustments')}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px ${
                        activeTab === 'adjustments'
                          ? 'border-purple-500 text-purple-500'
                          : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <History className="w-4 h-4" />
                      Ajustements ({userAdjustments.length})
                    </button>
                  </div>

                  {/* Tab Content: Adjustments */}
                  {activeTab === 'adjustments' && (
                    <div className="space-y-3">
                      {userAdjustments.length === 0 ? (
                        <div className="text-center py-8 text-[var(--text-tertiary)]">
                          <History className="w-12 h-12 mx-auto mb-2 opacity-30" />
                          <p>Aucun ajustement manuel</p>
                        </div>
                      ) : (
                        userAdjustments.map((adj) => (
                          <div
                            key={adj.id}
                            className={`p-4 rounded-xl border ${
                              adj.delta > 0
                                ? 'bg-green-500/5 border-green-500/20'
                                : 'bg-red-500/5 border-red-500/20'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${adj.delta > 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                  {adj.delta > 0 ? (
                                    <TrendingUp className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <TrendingDown className="w-4 h-4 text-red-500" />
                                  )}
                                </div>
                                <div>
                                  <p className={`text-lg font-bold ${adj.delta > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {adj.delta > 0 ? '+' : ''}{adj.delta} pts
                                  </p>
                                  <p className="text-sm text-[var(--text-secondary)]">{adj.reason}</p>
                                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                                    {adj.pointsBefore} → {adj.pointsAfter} pts
                                  </p>
                                </div>
                              </div>
                              <div className="text-right text-xs text-[var(--text-tertiary)]">
                                <p>{formatDate(adj.createdAt)}</p>
                                <p className="mt-1">
                                  par {adj.admin.firstName || adj.admin.email}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Tab Content: Transactions */}
                  {activeTab === 'transactions' && (
                    <>
                  {/* Navigation entre les scans si plusieurs */}
                  {userTransactions.length > 1 && (
                    <div className="mb-6 p-4 rounded-xl bg-[var(--bg-tertiary)]">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => loadTransactionDetail(currentTxIndex - 1)}
                          disabled={currentTxIndex === 0}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                            currentTxIndex === 0
                              ? 'opacity-50 cursor-not-allowed text-[var(--text-tertiary)]'
                              : 'hover:bg-purple-500/10 text-purple-500'
                          }`}
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Precedent
                        </button>

                        <div className="flex items-center gap-2 overflow-x-auto">
                          {userTransactions.slice(0, 7).map((tx, idx) => (
                            <button
                              key={tx.id}
                              onClick={() => loadTransactionDetail(idx)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                idx === currentTxIndex
                                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-purple-500/10'
                              }`}
                            >
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(tx.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                              </span>
                            </button>
                          ))}
                          {userTransactions.length > 7 && (
                            <span className="text-xs text-[var(--text-tertiary)]">+{userTransactions.length - 7}</span>
                          )}
                        </div>

                        <button
                          onClick={() => loadTransactionDetail(currentTxIndex + 1)}
                          disabled={currentTxIndex === userTransactions.length - 1}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                            currentTxIndex === userTransactions.length - 1
                              ? 'opacity-50 cursor-not-allowed text-[var(--text-tertiary)]'
                              : 'hover:bg-purple-500/10 text-purple-500'
                          }`}
                        >
                          Suivant
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-center text-xs text-[var(--text-tertiary)] mt-2">
                        Scan {currentTxIndex + 1} sur {userTransactions.length}
                      </p>
                    </div>
                  )}

                  {/* Detail du scan actuel */}
                  {currentTx && (
                    <div className="space-y-6">
                      {/* Info du scan actuel */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-xl bg-[var(--bg-tertiary)]">
                          <p className="text-xs text-[var(--text-tertiary)] mb-1">Transaction ID</p>
                          <p className="font-medium text-[var(--text-primary)] text-sm">#{currentTx.id}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-[var(--bg-tertiary)]">
                          <p className="text-xs text-[var(--text-tertiary)] mb-1">Ticket ID</p>
                          <p className="font-medium font-mono text-xs text-[var(--text-primary)] truncate">{currentTx.ticketId}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-[var(--bg-tertiary)]">
                          <p className="text-xs text-[var(--text-tertiary)] mb-1">Date du scan</p>
                          <p className="font-medium text-[var(--text-primary)] text-sm">{formatDate(currentTx.createdAt)}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-[var(--bg-tertiary)]">
                          <p className="text-xs text-[var(--text-tertiary)] mb-1">Statut</p>
                          {(() => {
                            const status = statusConfig[currentTx.status as keyof typeof statusConfig];
                            const Icon = status?.icon || Clock;
                            return (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status?.bg || 'bg-gray-500/10'} ${status?.color || 'text-gray-500'}`}>
                                <Icon className="w-3 h-3 mr-1" />
                                {status?.label || currentTx.status}
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Layout flex : Image à gauche, Produits à droite */}
                      <div className="flex flex-col lg:flex-row gap-6">
                        {/* Image du ticket */}
                        <div className="lg:w-1/2">
                          <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] h-full">
                            <div className="flex items-center gap-2 mb-3">
                              <ImageIcon className="w-4 h-4 text-purple-500" />
                              <p className="text-sm font-medium text-[var(--text-primary)]">Ticket de caisse</p>
                            </div>
                            {currentTx.ticketImageBase64 ? (
                              <div className="relative group">
                                <img
                                  src={`data:image/jpeg;base64,${currentTx.ticketImageBase64}`}
                                  alt="Ticket de caisse"
                                  className="w-full max-h-[400px] object-contain rounded-lg border border-[var(--border-glass)] cursor-zoom-in"
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
                              <div className="flex flex-col items-center justify-center h-48 text-[var(--text-tertiary)]">
                                <Receipt className="w-12 h-12 mb-2 opacity-30" />
                                <p className="text-sm">Pas d'image disponible</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Liste des produits */}
                        <div className="lg:w-1/2">
                          <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] h-full">
                            <div className="flex items-center gap-2 mb-3">
                              <ShoppingBag className="w-4 h-4 text-purple-500" />
                              <p className="text-sm font-medium text-[var(--text-primary)]">Produits detectes</p>
                            </div>

                            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
                              {currentTx.matchedProducts && (currentTx.matchedProducts as MatchedProduct[]).length > 0 ? (
                                <>
                                  {(currentTx.matchedProducts as MatchedProduct[]).map((mp, idx) => (
                                    <div
                                      key={idx}
                                      className={`flex items-center justify-between p-3 rounded-lg border ${
                                        mp.matched
                                          ? 'bg-green-500/5 border-green-500/20'
                                          : 'bg-red-500/5 border-red-500/20'
                                      }`}
                                    >
                                      <div className="flex items-center gap-3 flex-1 min-w-0">
                                        {mp.matched ? (
                                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                        ) : (
                                          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                                            {mp.ticketProduct.name}
                                          </p>
                                          {mp.matched && mp.matchedProductName && (
                                            <p className="text-xs text-green-600 truncate">
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
                                        <p className={`text-sm font-medium ${mp.matched ? 'text-green-600' : 'text-[var(--text-tertiary)] line-through'}`}>
                                          {formatCurrency(mp.ticketProduct.price * mp.ticketProduct.quantity)}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </>
                              ) : currentTx.ticketProducts && (currentTx.ticketProducts as TicketProduct[]).length > 0 ? (
                                <>
                                  {(currentTx.ticketProducts as TicketProduct[]).map((p, idx) => (
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
                            {currentTx.matchedProducts && (currentTx.matchedProducts as MatchedProduct[]).length > 0 && (
                              <div className="mt-3 pt-3 border-t border-[var(--border-glass)] flex justify-between text-xs">
                                <span className="text-green-500">
                                  {(currentTx.matchedProducts as MatchedProduct[]).filter(m => m.matched).length} comptabilise(s)
                                </span>
                                <span className="text-red-500">
                                  {(currentTx.matchedProducts as MatchedProduct[]).filter(m => !m.matched).length} non valide(s)
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Resume des points de ce scan */}
                      <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                        <p className="text-xs text-[var(--text-tertiary)] mb-3 text-center">Points de ce scan</p>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-xs text-[var(--text-tertiary)] mb-1">Montant total</p>
                            <p className="text-xl font-bold text-[var(--text-primary)]">
                              {formatCurrency(currentTx.totalAmount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--text-tertiary)] mb-1">Montant eligible</p>
                            <p className="text-xl font-bold text-green-500">
                              {formatCurrency(currentTx.eligibleAmount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--text-tertiary)] mb-1">Points gagnes</p>
                            <p className="text-xl font-bold text-purple-500">
                              {formatNumber(currentTx.pointsCalculated)} pts
                              {currentTx.pointsAwarded && (
                                <CheckCircle className="inline w-4 h-4 ml-1 text-green-500" />
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {userTransactions.length === 0 && (
                    <p className="text-sm text-[var(--text-tertiary)] text-center py-8">Aucune transaction</p>
                  )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Points Modal */}
      <EditPointsModal
        isOpen={!!editingUser}
        userEmail={editingUser?.userEmail || ''}
        userName={editingUser?.userName}
        currentPoints={editingUser?.totalPoints || 0}
        onClose={() => setEditingUser(null)}
        onSuccess={() => {
          fetchUsers(pagination.page);
          // Si le modal detail est ouvert, refresh
          if (selectedUser && selectedUser.userEmail === editingUser?.userEmail) {
            openUserDetail(selectedUser);
          }
        }}
        onPointsSynced={(newPoints) => {
          // Update user in local state when points synced from Certhis
          if (editingUser) {
            setUsers(prev => prev.map(u =>
              u.userEmail === editingUser.userEmail
                ? { ...u, totalPoints: newPoints }
                : u
            ));
            // Also update selectedUser if detail modal is open
            if (selectedUser && selectedUser.userEmail === editingUser.userEmail) {
              setSelectedUser({ ...selectedUser, totalPoints: newPoints });
            }
            // Update editingUser to reflect new points
            setEditingUser({ ...editingUser, totalPoints: newPoints });
          }
        }}
      />
    </div>
  );
}
