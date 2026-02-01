import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { transactionsApi, productsApi } from '../services/api';
import type { TransactionStats } from '../types';
import { formatNumber } from '../lib/utils';
import {
  Receipt,
  Package,
  Award,
  TrendingUp,
  ArrowRight,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

interface DashboardData {
  stats: TransactionStats;
  productCount: number;
}

const statusConfig = {
  SUCCESS: { label: 'Succes', icon: CheckCircle, color: 'text-success-500' },
  FAILED: { label: 'Echec', icon: XCircle, color: 'text-error-500' },
  PENDING: { label: 'En attente', icon: Clock, color: 'text-warning-500' },
  PARTIAL: { label: 'Partiel', icon: AlertTriangle, color: 'text-accent-500' },
};

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, productsRes] = await Promise.all([
          transactionsApi.getStats(),
          productsApi.getAll({ limit: 1 }),
        ]);

        setData({
          stats: statsRes.data,
          productCount: productsRes.pagination.total,
        });
      } catch (err) {
        setError('Erreur lors du chargement des donnees');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass rounded-2xl border border-error-500/20 text-error-500 px-4 py-3">
        {error || 'Erreur inconnue'}
      </div>
    );
  }

  const { stats, productCount } = data;

  const cards = [
    {
      title: 'Transactions',
      value: formatNumber(stats.total),
      subtitle: `${formatNumber(stats.today)} aujourd'hui`,
      icon: Receipt,
      gradient: 'from-primary-500 to-primary-600',
      href: '/transactions',
    },
    {
      title: 'Points attribues',
      value: formatNumber(stats.totalPointsAwarded),
      subtitle: 'Total cumule',
      icon: Award,
      gradient: 'from-success-500 to-emerald-600',
      href: '/transactions',
    },
    {
      title: 'Produits',
      value: formatNumber(productCount),
      subtitle: 'Dans le catalogue',
      icon: Package,
      gradient: 'from-purple-500 to-purple-600',
      href: '/products',
    },
    {
      title: 'Taux de succes',
      value: stats.total > 0
        ? `${Math.round(((stats.byStatus.SUCCESS || 0) / stats.total) * 100)}%`
        : '0%',
      subtitle: 'Des transactions',
      icon: TrendingUp,
      gradient: 'from-accent-500 to-orange-600',
      href: '/transactions',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
          <p className="text-[var(--text-secondary)]">Vue d'ensemble du systeme CRM Fidelite</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.title}
            to={card.href}
            className="group glass rounded-2xl p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden relative"
          >
            {/* Gradient bar at top */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.gradient}`} />

            <div className="flex items-center">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${card.gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-[var(--text-secondary)]">{card.title}</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{card.value}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{card.subtitle}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-glass)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Repartition par statut
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Object.entries(statusConfig).map(([status, config]) => {
              const count = stats.byStatus[status] || 0;
              const percentage = stats.total > 0
                ? Math.round((count / stats.total) * 100)
                : 0;

              return (
                <div
                  key={status}
                  className="text-center p-4 rounded-xl bg-[var(--bg-tertiary)] hover:scale-105 transition-transform duration-300"
                >
                  <config.icon className={`w-8 h-8 mx-auto ${config.color}`} />
                  <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
                    {formatNumber(count)}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">{config.label}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">{percentage}%</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-glass)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Actions rapides</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Link
              to="/products"
              className="group flex items-center justify-between p-4 rounded-xl border border-[var(--border-glass)] hover:bg-[var(--bg-tertiary)] transition-all duration-300"
            >
              <div className="flex items-center">
                <Package className="w-5 h-5 text-[var(--text-tertiary)] group-hover:text-primary-500 transition-colors" />
                <span className="ml-3 text-sm font-medium text-[var(--text-primary)]">Gerer les produits</span>
              </div>
              <ArrowRight className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
            </Link>

            <Link
              to="/transactions"
              className="group flex items-center justify-between p-4 rounded-xl border border-[var(--border-glass)] hover:bg-[var(--bg-tertiary)] transition-all duration-300"
            >
              <div className="flex items-center">
                <Receipt className="w-5 h-5 text-[var(--text-tertiary)] group-hover:text-primary-500 transition-colors" />
                <span className="ml-3 text-sm font-medium text-[var(--text-primary)]">Voir les transactions</span>
              </div>
              <ArrowRight className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
            </Link>

            <Link
              to="/settings"
              className="group flex items-center justify-between p-4 rounded-xl border border-[var(--border-glass)] hover:bg-[var(--bg-tertiary)] transition-all duration-300"
            >
              <div className="flex items-center">
                <Award className="w-5 h-5 text-[var(--text-tertiary)] group-hover:text-primary-500 transition-colors" />
                <span className="ml-3 text-sm font-medium text-[var(--text-primary)]">Configurer les points</span>
              </div>
              <ArrowRight className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
