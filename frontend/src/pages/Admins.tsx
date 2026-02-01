import { useEffect, useState } from 'react';
import { adminsApi } from '../services/api';
import type { Admin } from '../types';
import { formatDate } from '../lib/utils';
import {
  Plus,
  Loader2,
  Edit,
  Trash2,
  Key,
  Shield,
  User,
  Users,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

export function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'VIEWER' as 'ADMIN' | 'VIEWER',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Password reset modal
  const [resetPasswordAdmin, setResetPasswordAdmin] = useState<Admin | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Delete confirmation
  const [deleteAdmin, setDeleteAdminState] = useState<Admin | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAdmins = async () => {
    setIsLoading(true);
    try {
      const response = await adminsApi.getAll();
      setAdmins(response.data);
    } catch (err) {
      console.error('Error fetching admins:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const openCreateModal = () => {
    setEditingAdmin(null);
    setFormData({ email: '', password: '', firstName: '', lastName: '', role: 'VIEWER' });
    setShowModal(true);
  };

  const openEditModal = (admin: Admin) => {
    setEditingAdmin(admin);
    setFormData({
      email: admin.email,
      password: '',
      firstName: admin.firstName || '',
      lastName: admin.lastName || '',
      role: admin.role,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (editingAdmin) {
        await adminsApi.update(editingAdmin.id, {
          email: formData.email,
          firstName: formData.firstName || undefined,
          lastName: formData.lastName || undefined,
          role: formData.role,
        });
      } else {
        await adminsApi.create(formData);
      }
      setShowModal(false);
      fetchAdmins();
    } catch (err) {
      console.error('Error saving admin:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteAdmin) return;
    setIsDeleting(true);
    try {
      await adminsApi.delete(deleteAdmin.id);
      setDeleteAdminState(null);
      fetchAdmins();
    } catch (err) {
      console.error('Error deleting admin:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordAdmin || !newPassword) return;
    try {
      await adminsApi.resetPassword(resetPasswordAdmin.id, newPassword);
      setResetPasswordAdmin(null);
      setNewPassword('');
    } catch (err) {
      console.error('Error resetting password:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Administrateurs</h1>
            <p className="text-[var(--text-secondary)]">Gestion des comptes administrateurs</p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:shadow-lg hover:shadow-primary-500/25 transition-all duration-300"
        >
          <Plus className="w-4 h-4 mr-2" />
          Ajouter
        </button>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : admins.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">
            Aucun administrateur trouve
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[var(--border-glass)]">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    Derniere connexion
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-glass)]">
                {admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-[var(--bg-tertiary)] transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary-500" />
                        </div>
                        <div className="ml-4">
                          <p className="font-medium text-[var(--text-primary)]">{admin.email}</p>
                          {(admin.firstName || admin.lastName) && (
                            <p className="text-sm text-[var(--text-tertiary)]">
                              {[admin.firstName, admin.lastName].filter(Boolean).join(' ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {admin.role === 'ADMIN' ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-500">
                          <Shield className="w-3 h-3 mr-1" />
                          Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                          Viewer
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-secondary)]">
                      {admin.lastLoginAt ? formatDate(admin.lastLoginAt) : 'Jamais'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => openEditModal(admin)}
                        className="text-[var(--text-tertiary)] hover:text-primary-500 p-2 rounded-lg hover:bg-primary-500/10 transition-all duration-200"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setResetPasswordAdmin(admin);
                          setNewPassword('');
                        }}
                        className="text-[var(--text-tertiary)] hover:text-warning-500 p-2 rounded-lg hover:bg-warning-500/10 transition-all duration-200 ml-1"
                        title="Reinitialiser le mot de passe"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteAdminState(admin)}
                        className="text-[var(--text-tertiary)] hover:text-error-500 p-2 rounded-lg hover:bg-error-500/10 transition-all duration-200 ml-1"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
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
                {editingAdmin ? 'Modifier l\'administrateur' : 'Ajouter un administrateur'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                  />
                </div>
                {!editingAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                      Mot de passe *
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                      Prenom
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                      Nom
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'ADMIN' | 'VIEWER' })}
                    className="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                  >
                    <option value="VIEWER">Viewer (lecture seule)</option>
                    <option value="ADMIN">Admin (acces complet)</option>
                  </select>
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
                  disabled={!formData.email || (!editingAdmin && !formData.password) || isSaving}
                  className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:shadow-lg hover:shadow-primary-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordAdmin && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setResetPasswordAdmin(null)}
            />
            <div className="relative glass-strong rounded-2xl shadow-2xl max-w-md w-full p-6 border border-[var(--border-glass)]">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-warning-500 to-orange-500 rounded-t-2xl" />

              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                Reinitialiser le mot de passe
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Reinitialisation pour : <strong className="text-[var(--text-primary)]">{resetPasswordAdmin.email}</strong>
              </p>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                  placeholder="Minimum 8 caracteres"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setResetPasswordAdmin(null)}
                  className="px-4 py-2 border border-[var(--border-glass)] rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-all duration-200"
                >
                  Annuler
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={newPassword.length < 8}
                  className="px-4 py-2 bg-gradient-to-r from-warning-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-warning-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  Reinitialiser
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteAdmin}
        title="Supprimer l'administrateur"
        message={`Etes-vous sur de vouloir supprimer ${deleteAdmin?.email} ? Cette action est irreversible.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteAdminState(null)}
        isLoading={isDeleting}
      />
    </div>
  );
}
