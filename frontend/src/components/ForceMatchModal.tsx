import { useState, useEffect } from 'react';
import { productsApi, transactionsApi } from '../services/api';
import {
  Loader2,
  X,
  CheckCircle,
  AlertTriangle,
  Package,
  FileText,
} from 'lucide-react';

interface Product {
  id: number;
  name: string;
  sku: string | null;
  active: boolean;
}

interface TicketProduct {
  name: string;
  quantity: number;
  price: number;
}

interface ForceMatchModalProps {
  isOpen: boolean;
  transactionId: number;
  productIndex: number;
  ticketProduct: TicketProduct;
  onClose: () => void;
  onSuccess: () => void;
}

export function ForceMatchModal({
  isOpen,
  transactionId,
  productIndex,
  ticketProduct,
  onClose,
  onSuccess,
}: ForceMatchModalProps) {
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch catalog products when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCatalogProducts();
    }
  }, [isOpen]);

  const fetchCatalogProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const result = await productsApi.getAll({ limit: 500, activeOnly: true });
      setCatalogProducts(result.data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Impossible de charger les produits');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setSelectedProductId(null);
    setNote('');
    setError(null);
    setSuccess(false);
    setSearchTerm('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedProductId || note.trim().length < 3) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await transactionsApi.forceMatch(transactionId, {
        productIndex,
        catalogProductId: selectedProductId,
        note: note.trim(),
      });
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 1500);
    } catch (err) {
      console.error('Error force matching:', err);
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(
        error.response?.data?.message ||
        error.message ||
        'Erreur lors du forçage'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = catalogProducts.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedProduct = catalogProducts.find(p => p.id === selectedProductId);

  if (!isOpen) return null;

  const eligibleAmount = ticketProduct.price * ticketProduct.quantity;

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        />
        <div className="relative glass-strong rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-[var(--border-glass)]">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-amber-500 rounded-t-2xl" />

          {success ? (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Produit validé</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Les points ont été recalculés et envoyés
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">Forcer la validation</h3>
                  <p className="text-sm text-[var(--text-secondary)]">Associer manuellement ce produit</p>
                </div>
                <button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all duration-200 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Ticket product info */}
              <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-red-400 mb-1">Produit non reconnu</p>
                    <p className="text-sm text-[var(--text-primary)] truncate">{ticketProduct.name}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      {ticketProduct.quantity}x {ticketProduct.price.toFixed(2)}€ = <span className="font-medium text-orange-400">{eligibleAmount.toFixed(2)}€</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* Catalog product selector */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    <Package className="w-4 h-4 inline-block mr-1" />
                    Produit catalogue à associer
                  </label>

                  {/* Search */}
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher un produit..."
                    className="w-full px-4 py-2 mb-2 bg-[var(--bg-tertiary)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />

                  {isLoadingProducts ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--border-glass)] bg-[var(--bg-tertiary)]">
                      {filteredProducts.length === 0 ? (
                        <p className="text-sm text-[var(--text-tertiary)] p-4 text-center">
                          Aucun produit trouvé
                        </p>
                      ) : (
                        filteredProducts.map((product) => (
                          <button
                            key={product.id}
                            onClick={() => setSelectedProductId(product.id)}
                            className={`w-full px-4 py-3 text-left hover:bg-[var(--bg-secondary)] transition-all border-b border-[var(--border-glass)] last:border-b-0 ${
                              selectedProductId === product.id
                                ? 'bg-orange-500/10 border-l-2 border-l-orange-500'
                                : ''
                            }`}
                          >
                            <p className="text-sm font-medium text-[var(--text-primary)]">{product.name}</p>
                            {product.sku && (
                              <p className="text-xs text-[var(--text-tertiary)]">SKU: {product.sku}</p>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {selectedProduct && (
                    <div className="mt-2 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                      <p className="text-xs text-orange-400">
                        Sélectionné: <span className="font-medium">{selectedProduct.name}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Note */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    <FileText className="w-4 h-4 inline-block mr-1" />
                    Note (obligatoire)
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ex: OCR mal lu, nouveau produit pas dans les alias..."
                    rows={3}
                    className="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
                  />
                  {note.trim().length > 0 && note.trim().length < 3 && (
                    <p className="text-xs text-orange-500 mt-1">Minimum 3 caractères requis</p>
                  )}
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-sm text-red-500">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !selectedProductId || note.trim().length < 3}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Validation en cours...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Forcer la validation (+{eligibleAmount.toFixed(2)}€)
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
