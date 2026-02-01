import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Supprimer',
  cancelLabel = 'Annuler',
  variant = 'danger',
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      gradient: 'from-error-500 to-red-600',
      icon: Trash2,
      iconBg: 'bg-error-500/10',
      iconColor: 'text-error-500',
      buttonBg: 'bg-gradient-to-r from-error-500 to-error-600 hover:from-error-600 hover:to-error-700',
      buttonShadow: 'shadow-error-500/25',
    },
    warning: {
      gradient: 'from-warning-500 to-orange-600',
      icon: AlertTriangle,
      iconBg: 'bg-warning-500/10',
      iconColor: 'text-warning-500',
      buttonBg: 'bg-gradient-to-r from-warning-500 to-warning-600 hover:from-warning-600 hover:to-warning-700',
      buttonShadow: 'shadow-warning-500/25',
    },
  };

  const styles = variantStyles[variant];
  const Icon = styles.icon;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={onCancel}
        />

        {/* Dialog */}
        <div className="relative glass-strong rounded-2xl shadow-2xl max-w-md w-full p-6 border border-[var(--border-glass)] transform transition-all">
          {/* Top gradient bar */}
          <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${styles.gradient} rounded-t-2xl`} />

          {/* Close button */}
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all duration-200"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className={`p-4 rounded-full ${styles.iconBg}`}>
              <Icon className={`w-8 h-8 ${styles.iconColor}`} />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-xl font-semibold text-[var(--text-primary)] text-center mb-2">
            {title}
          </h3>

          {/* Message */}
          <p className="text-[var(--text-secondary)] text-center mb-6">
            {message}
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 border border-[var(--border-glass)] rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-all duration-200 font-medium disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 px-4 py-2.5 ${styles.buttonBg} text-white rounded-xl hover:shadow-lg ${styles.buttonShadow} transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Suppression...
                </span>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
