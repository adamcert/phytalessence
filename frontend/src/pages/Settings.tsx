import { useEffect, useState } from 'react';
import { settingsApi, adminsApi } from '../services/api';
import type { Setting, Admin } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../lib/utils';
import {
  Loader2,
  Save,
  Settings,
  Info,
  Users,
  Plus,
  Edit,
  Trash2,
  Key,
  Shield,
  User,
  Cog,
  Bell,
} from 'lucide-react';

type TabType = 'settings' | 'users';

export function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [activeTab, setActiveTab] = useState<TabType>('settings');

  // Settings state
  const [settings, setSettings] = useState<Setting[]>([]);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // Admins state
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
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
  const [resetPasswordAdmin, setResetPasswordAdmin] = useState<Admin | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Fetch settings
  const fetchSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const response = await settingsApi.getAll();
      setSettings(response.data);
      const values: Record<string, string> = {};
      response.data.forEach((s: Setting) => {
        values[s.key] = s.value;
      });
      setEditedValues(values);
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  // Fetch admins
  const fetchAdmins = async () => {
    setIsLoadingAdmins(true);
    try {
      const response = await adminsApi.getAll();
      setAdmins(response.data);
    } catch (err) {
      console.error('Error fetching admins:', err);
    } finally {
      setIsLoadingAdmins(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    if (isAdmin) {
      fetchAdmins();
    }
  }, [isAdmin]);

  const handleSaveSetting = async (key: string) => {
    setSaving({ ...saving, [key]: true });
    try {
      await settingsApi.update(key, editedValues[key] || '');
      fetchSettings();
    } catch (err) {
      console.error('Error saving setting:', err);
    } finally {
      setSaving({ ...saving, [key]: false });
    }
  };

  const isModified = (setting: Setting) => {
    return editedValues[setting.key] !== setting.value;
  };

  // Admin handlers
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

  const handleSaveAdmin = async () => {
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

  const handleDeleteAdmin = async (id: number) => {
    if (!confirm('Etes-vous sur de vouloir supprimer cet administrateur ?')) return;
    try {
      await adminsApi.delete(id);
      fetchAdmins();
    } catch (err) {
      console.error('Error deleting admin:', err);
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

  const tabs = [
    { id: 'settings' as TabType, label: 'Parametres', icon: Cog },
    ...(isAdmin ? [{ id: 'users' as TabType, label: 'Utilisateurs', icon: Users }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600">
          <Settings className="w-6 h-6 text-accent-900" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Parametres</h1>
          <p className="text-[var(--text-secondary)]">Configuration du systeme de fidelite</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-[var(--bg-tertiary)] rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-white dark:bg-accent-700 text-accent-900 dark:text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <>
          {isLoadingSettings ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="p-6 space-y-4">
                {settings.map((setting) => {
                  const isNotificationTemplate = setting.key === 'notification_message_template';

                  // Calculate preview for notification
                  const getNotificationPreview = () => {
                    const ratio = parseFloat(editedValues['POINTS_RATIO'] || '1');
                    const rounding = editedValues['POINTS_ROUNDING'] || 'floor';
                    const exampleAmount = 50;
                    const raw = exampleAmount * ratio;
                    let examplePoints: number;
                    switch (rounding) {
                      case 'ceil': examplePoints = Math.ceil(raw); break;
                      case 'round': examplePoints = Math.round(raw); break;
                      default: examplePoints = Math.floor(raw);
                    }
                    return (editedValues[setting.key] || 'Felicitations ! Vous avez gagne {points} points.')
                      .replace('{points}', String(examplePoints));
                  };

                  return (
                    <div
                      key={setting.key}
                      className={`p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] hover:border-primary-500/30 transition-all duration-300 ${
                        isNotificationTemplate ? '' : 'flex flex-col sm:flex-row sm:items-center gap-4'
                      }`}
                    >
                      <div className={isNotificationTemplate ? 'mb-4' : 'flex-1'}>
                        <label className="block text-sm font-semibold text-[var(--text-primary)]">
                          {getSettingLabel(setting.key)}
                        </label>
                        <p className="text-sm text-[var(--text-tertiary)] mt-1">{setting.description}</p>
                        {isNotificationTemplate && (
                          <p className="text-xs text-primary-500 mt-1">Variable disponible : {'{points}'}</p>
                        )}
                      </div>

                      {isNotificationTemplate ? (
                        <div className="space-y-4">
                          <div className="flex items-start gap-3">
                            <textarea
                              value={editedValues[setting.key] || ''}
                              onChange={(e) => setEditedValues({ ...editedValues, [setting.key]: e.target.value })}
                              disabled={!isAdmin}
                              rows={3}
                              className="flex-1 px-4 py-2.5 bg-white dark:bg-accent-800 border-2 border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] font-medium focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all resize-none"
                              placeholder="Ex: Felicitations ! Vous avez gagne {points} points."
                            />
                            {isAdmin && isModified(setting) && (
                              <button
                                onClick={() => handleSaveSetting(setting.key)}
                                disabled={saving[setting.key]}
                                className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-accent-900 font-medium rounded-xl hover:shadow-lg hover:shadow-primary-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                              >
                                {saving[setting.key] ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Save className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* iOS Notification Preview */}
                          <div className="mt-3">
                            <p className="text-xs text-[var(--text-tertiary)] mb-2 font-medium">Apercu de la notification</p>
                            <div className="bg-gray-100 dark:bg-gray-900 rounded-2xl p-3 max-w-sm shadow-lg">
                              {/* iOS Notification Style */}
                              <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-md">
                                <div className="flex items-start gap-3">
                                  <img
                                    src="/images/logo-gold.png"
                                    alt="Phytalessence"
                                    className="w-10 h-10 rounded-xl object-contain bg-accent-800 p-1"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-semibold text-gray-900 dark:text-white">Phytalessence</span>
                                      <span className="text-xs text-gray-400">maintenant</span>
                                    </div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 line-clamp-3">
                                      {getNotificationPreview()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          {renderSettingInput(setting, editedValues, setEditedValues, isAdmin)}
                          {isAdmin && isModified(setting) && (
                            <button
                              onClick={() => handleSaveSetting(setting.key)}
                              disabled={saving[setting.key]}
                              className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-accent-900 font-medium rounded-xl hover:shadow-lg hover:shadow-primary-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                            >
                              {saving[setting.key] ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Info box - Dynamic with real values */}
          {(() => {
            const ratio = parseFloat(editedValues['POINTS_RATIO'] || '1');
            const rounding = editedValues['POINTS_ROUNDING'] || 'floor';
            const minAmount = parseFloat(editedValues['MIN_ELIGIBLE_AMOUNT'] || '0');
            const notificationTemplate = editedValues['notification_message_template'] || 'Felicitations {name} ! Vous avez gagne {points} points.';

            const exampleAmount = 50;
            const calculatePoints = (amount: number) => {
              const raw = amount * ratio;
              switch (rounding) {
                case 'ceil': return Math.ceil(raw);
                case 'round': return Math.round(raw);
                default: return Math.floor(raw);
              }
            };
            const examplePoints = calculatePoints(exampleAmount);

            const roundingLabel = {
              floor: 'arrondi inferieur',
              ceil: 'arrondi superieur',
              round: 'arrondi au plus proche'
            }[rounding] || 'arrondi inferieur';

            const previewNotification = notificationTemplate
              .replace('{name}', 'Jean Dupont')
              .replace('{points}', String(examplePoints))
              .replace('{amount}', String(exampleAmount))
              .replace('{total_points}', '325');

            return (
              <>
                <div className="glass rounded-2xl p-6 border border-primary-500/30 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 to-primary-400" />
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-xl bg-primary-500/20">
                      <Info className="w-5 h-5 text-primary-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-[var(--text-primary)] mb-3">Comment ca fonctionne</h3>
                      <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                        <li className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-2 flex-shrink-0" />
                          <span><strong className="text-[var(--text-primary)]">Ratio de points</strong> : {ratio} point{ratio > 1 ? 's' : ''} par euro depense</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-2 flex-shrink-0" />
                          <span><strong className="text-[var(--text-primary)]">Methode d'arrondi</strong> : {roundingLabel}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-2 flex-shrink-0" />
                          <span><strong className="text-[var(--text-primary)]">Montant minimum</strong> : {minAmount > 0 ? `${minAmount} EUR` : 'Aucun minimum'}</span>
                        </li>
                      </ul>
                      <div className="mt-4 p-4 rounded-xl bg-primary-500/10 border border-primary-500/20">
                        <p className="text-sm text-[var(--text-secondary)]">
                          <strong className="text-[var(--text-primary)]">Exemple :</strong> Avec un ratio de {ratio} et un achat de {exampleAmount}EUR, le client gagne{' '}
                          <span className="font-semibold text-primary-600">{examplePoints} points</span>{' '}
                          ({roundingLabel}).
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

              </>
            );
          })()}
        </>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && isAdmin && (
        <>
          <div className="flex justify-end">
            <button
              onClick={openCreateModal}
              className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-accent-900 font-medium rounded-xl hover:shadow-lg hover:shadow-primary-500/25 transition-all duration-300"
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un utilisateur
            </button>
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            {isLoadingAdmins ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
              </div>
            ) : admins.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-secondary)]">
                Aucun utilisateur trouve
              </div>
            ) : (
              <>
                {/* Mobile: Card View */}
                <div className="block md:hidden divide-y divide-[var(--border-primary)]">
                  {admins.map((admin) => (
                    <div key={admin.id} className="p-4 hover:bg-[var(--bg-tertiary)] transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-600/20 flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-primary-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[var(--text-primary)] truncate">{admin.email}</p>
                            {(admin.firstName || admin.lastName) && (
                              <p className="text-sm text-[var(--text-tertiary)] truncate">
                                {[admin.firstName, admin.lastName].filter(Boolean).join(' ')}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {admin.role === 'ADMIN' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-500/20 text-primary-700 dark:text-primary-400">
                                  <Shield className="w-3 h-3 mr-1" />
                                  Admin
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                                  Viewer
                                </span>
                              )}
                              <span className="text-xs text-[var(--text-tertiary)]">
                                {admin.lastLoginAt ? formatDate(admin.lastLoginAt) : 'Jamais connecte'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => openEditModal(admin)}
                            className="text-[var(--text-tertiary)] hover:text-primary-500 p-2 rounded-lg hover:bg-primary-500/10 transition-all"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setResetPasswordAdmin(admin);
                              setNewPassword('');
                            }}
                            className="text-[var(--text-tertiary)] hover:text-warning-500 p-2 rounded-lg hover:bg-warning-500/10 transition-all"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAdmin(admin.id)}
                            className="text-[var(--text-tertiary)] hover:text-error-500 p-2 rounded-lg hover:bg-error-500/10 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
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
                      <tr className="border-b border-[var(--border-primary)]">
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
                    <tbody className="divide-y divide-[var(--border-primary)]">
                      {admins.map((admin) => (
                        <tr key={admin.id} className="hover:bg-[var(--bg-tertiary)] transition-colors duration-200">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-600/20 flex items-center justify-center">
                                <User className="w-5 h-5 text-primary-600" />
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
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-500/20 text-primary-700 dark:text-primary-400">
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
                              onClick={() => handleDeleteAdmin(admin.id)}
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
              </>
            )}
          </div>
        </>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowModal(false)}
            />
            <div className="relative bg-[var(--bg-secondary)] rounded-2xl shadow-2xl max-w-md w-full p-6 border border-[var(--border-primary)]">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 to-primary-400 rounded-t-2xl" />

              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                {editingAdmin ? 'Modifier l\'utilisateur' : 'Ajouter un utilisateur'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-accent-800 border-2 border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                    placeholder="email@exemple.com"
                  />
                </div>
                {!editingAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      Mot de passe *
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white dark:bg-accent-800 border-2 border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                      placeholder="Minimum 8 caracteres"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      Prenom
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white dark:bg-accent-800 border-2 border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                      placeholder="Jean"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      Nom
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white dark:bg-accent-800 border-2 border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                      placeholder="Dupont"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'ADMIN' | 'VIEWER' })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-accent-800 border-2 border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                  >
                    <option value="VIEWER">Viewer (lecture seule)</option>
                    <option value="ADMIN">Admin (acces complet)</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 border-2 border-[var(--border-primary)] rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] font-medium transition-all duration-200"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveAdmin}
                  disabled={!formData.email || (!editingAdmin && !formData.password) || isSaving}
                  className="px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-accent-900 font-medium rounded-xl hover:shadow-lg hover:shadow-primary-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
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
            <div className="relative bg-[var(--bg-secondary)] rounded-2xl shadow-2xl max-w-md w-full p-6 border border-[var(--border-primary)]">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-warning-500 to-warning-400 rounded-t-2xl" />

              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                Reinitialiser le mot de passe
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Reinitialisation pour : <strong className="text-[var(--text-primary)]">{resetPasswordAdmin.email}</strong>
              </p>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white dark:bg-accent-800 border-2 border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                  placeholder="Minimum 8 caracteres"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setResetPasswordAdmin(null)}
                  className="px-4 py-2.5 border-2 border-[var(--border-primary)] rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] font-medium transition-all duration-200"
                >
                  Annuler
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={newPassword.length < 8}
                  className="px-4 py-2.5 bg-gradient-to-r from-warning-500 to-warning-400 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-warning-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  Reinitialiser
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getSettingLabel(key: string): string {
  const labels: Record<string, string> = {
    POINTS_RATIO: 'Ratio de points',
    POINTS_ROUNDING: 'Methode d\'arrondi',
    MIN_ELIGIBLE_AMOUNT: 'Montant minimum (EUR)',
    notification_message_template: 'Template message notification',
  };
  return labels[key] || key;
}

function getSettingType(key: string): 'number' | 'select' | 'textarea' | 'text' {
  const types: Record<string, 'number' | 'select' | 'textarea' | 'text'> = {
    POINTS_RATIO: 'number',
    POINTS_ROUNDING: 'select',
    MIN_ELIGIBLE_AMOUNT: 'number',
    notification_message_template: 'textarea',
  };
  return types[key] || 'text';
}

function renderSettingInput(
  setting: Setting,
  editedValues: Record<string, string>,
  setEditedValues: (values: Record<string, string>) => void,
  isAdmin: boolean
) {
  const inputType = getSettingType(setting.key);
  const baseInputClass = "px-4 py-2.5 bg-white dark:bg-accent-800 border-2 border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] font-medium focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all";

  switch (inputType) {
    case 'select':
      return (
        <select
          value={editedValues[setting.key] || ''}
          onChange={(e) => setEditedValues({ ...editedValues, [setting.key]: e.target.value })}
          disabled={!isAdmin}
          className={baseInputClass}
        >
          <option value="floor">Arrondi inferieur (floor)</option>
          <option value="ceil">Arrondi superieur (ceil)</option>
          <option value="round">Arrondi au plus proche (round)</option>
        </select>
      );

    case 'textarea':
      return (
        <textarea
          value={editedValues[setting.key] || ''}
          onChange={(e) => setEditedValues({ ...editedValues, [setting.key]: e.target.value })}
          disabled={!isAdmin}
          rows={3}
          className={`${baseInputClass} w-80 resize-none`}
          placeholder="Ex: Felicitations ! Vous avez gagne {points} points."
        />
      );

    case 'number':
      return (
        <input
          type="number"
          step={setting.key.includes('RATIO') || setting.key.includes('ratio') ? '0.1' : '1'}
          min="0"
          value={editedValues[setting.key] || ''}
          onChange={(e) => setEditedValues({ ...editedValues, [setting.key]: e.target.value })}
          disabled={!isAdmin}
          className={`${baseInputClass} w-32`}
        />
      );

    default:
      return (
        <input
          type="text"
          value={editedValues[setting.key] || ''}
          onChange={(e) => setEditedValues({ ...editedValues, [setting.key]: e.target.value })}
          disabled={!isAdmin}
          className={`${baseInputClass} w-40`}
        />
      );
  }
}
