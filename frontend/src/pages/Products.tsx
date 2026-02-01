import { useEffect, useState } from 'react';
import { productsApi } from '../services/api';
import type { Product, PaginatedResponse } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../lib/utils';
import {
  Plus,
  Search,
  Loader2,
  Edit,
  Trash2,
  Check,
  X,
  Package,
} from 'lucide-react';

export function ProductsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({ name: '', sku: '', aliases: '', active: true });
  const [isSaving, setIsSaving] = useState(false);

  const fetchProducts = async (page = 1) => {
    setIsLoading(true);
    try {
      const response: PaginatedResponse<Product> = await productsApi.getAll({
        page,
        limit: 20,
        search: search || undefined,
        activeOnly: true,
      });
      setProducts(response.data);
      setPagination({
        page: response.pagination.page,
        total: response.pagination.total,
        totalPages: response.pagination.totalPages,
      });
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [search]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({ name: '', sku: '', aliases: '', active: true });
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    const aliasesStr = Array.isArray(product.aliases) ? product.aliases.join(', ') : '';
    setFormData({ name: product.name, sku: product.sku || '', aliases: aliasesStr, active: product.active });
    setShowModal(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Convert aliases string to array
      const aliasesArray = formData.aliases
        .split(',')
        .map((a) => a.trim())
        .filter((a) => a.length > 0);

      const payload = {
        name: formData.name,
        sku: formData.sku || null,
        aliases: aliasesArray,
        active: formData.active,
      };

      if (editingProduct) {
        await productsApi.update(editingProduct.id, payload);
      } else {
        await productsApi.create(payload);
      }
      setShowModal(false);
      fetchProducts(pagination.page);
    } catch (err) {
      console.error('Error saving product:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Etes-vous sur de vouloir supprimer ce produit ?')) return;
    try {
      await productsApi.delete(id);
      fetchProducts(pagination.page);
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Produits</h1>
            <p className="text-[var(--text-secondary)]">Catalogue des produits Phytalessence</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openCreateModal}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:shadow-lg hover:shadow-primary-500/25 transition-all duration-300"
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass rounded-2xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
          />
        </div>
      </div>

      {/* Products List */}
      <div className="glass rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">
            Aucun produit trouve
          </div>
        ) : (
          <>
            {/* Mobile: Card View */}
            <div className="block md:hidden divide-y divide-[var(--border-glass)]">
              {products.map((product) => (
                <div key={product.id} className="p-4 hover:bg-[var(--bg-tertiary)] transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--text-primary)] truncate">{product.name}</p>
                      {product.sku && (
                        <p className="text-sm text-[var(--text-tertiary)] mt-1">SKU: {product.sku}</p>
                      )}
                      {Array.isArray(product.aliases) && product.aliases.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {product.aliases.map((alias, idx) => (
                            <span key={idx} className="inline-block px-2 py-0.5 text-xs bg-purple-500/10 text-purple-400 rounded">
                              {alias}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {product.active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-500/10 text-success-500">
                            <Check className="w-3 h-3 mr-1" />
                            Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">
                            <X className="w-3 h-3 mr-1" />
                            Inactif
                          </span>
                        )}
                        <span className="text-xs text-[var(--text-tertiary)]">{formatDate(product.createdAt)}</span>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEditModal(product)}
                          className="text-[var(--text-tertiary)] hover:text-primary-500 p-2 rounded-lg hover:bg-primary-500/10 transition-all"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="text-[var(--text-tertiary)] hover:text-error-500 p-2 rounded-lg hover:bg-error-500/10 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[var(--border-glass)]">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Nom
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Alias
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Cree le
                    </th>
                    {isAdmin && (
                      <th className="px-6 py-4 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-glass)]">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-[var(--bg-tertiary)] transition-colors duration-200">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-[var(--text-primary)]">{product.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-[var(--text-secondary)]">
                        {product.sku || '-'}
                      </td>
                      <td className="px-6 py-4">
                        {Array.isArray(product.aliases) && product.aliases.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {product.aliases.map((alias, idx) => (
                              <span key={idx} className="inline-block px-2 py-0.5 text-xs bg-purple-500/10 text-purple-400 rounded">
                                {alias}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[var(--text-tertiary)]">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {product.active ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-success-500/10 text-success-500">
                            <Check className="w-3 h-3 mr-1" />
                            Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">
                            <X className="w-3 h-3 mr-1" />
                            Inactif
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-[var(--text-secondary)] text-sm">
                        {formatDate(product.createdAt)}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => openEditModal(product)}
                            className="text-[var(--text-tertiary)] hover:text-primary-500 p-2 rounded-lg hover:bg-primary-500/10 transition-all duration-200"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="text-[var(--text-tertiary)] hover:text-error-500 p-2 rounded-lg hover:bg-error-500/10 transition-all duration-200 ml-1"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
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
              {pagination.total} produit{pagination.total > 1 ? 's' : ''}
            </p>
            <div className="flex gap-2">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => fetchProducts(page)}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowModal(false)}
            />
            <div className="relative glass-strong rounded-2xl shadow-2xl max-w-md w-full p-6 border border-[var(--border-glass)]">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 to-purple-500 rounded-t-2xl" />

              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                {editingProduct ? 'Modifier le produit' : 'Ajouter un produit'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    SKU
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Alias (separes par virgule)
                  </label>
                  <input
                    type="text"
                    value={formData.aliases}
                    onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
                    placeholder="ex: PHYTALESS VALER, valeriane bio"
                    className="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                  />
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    Noms alternatifs pour le matching automatique
                  </p>
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      className="rounded border-[var(--border-glass)] bg-[var(--bg-tertiary)] text-primary-500 focus:ring-primary-500/50"
                    />
                    <span className="text-sm text-[var(--text-secondary)]">Actif</span>
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-[var(--border-glass)] rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-all duration-200"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={!formData.name || isSaving}
                  className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:shadow-lg hover:shadow-primary-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Enregistrer'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
