import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Save, Camera, Mail, Phone, User, 
  Loader2, Check, AlertCircle, Eye, EyeOff 
} from 'lucide-react';
import { useUserProfile } from '../../hooks/useUserProfile';

interface UserSettingsModalProps {
  user: {
    name: string;
    email: string;
    role: string;
    id: string;
    avatar_url?: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  avatar_url: string;
  current_password: string;
  new_password: string;
  confirm_password: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  current_password?: string;
  new_password?: string;
  confirm_password?: string;
  general?: string;
}

export function UserSettingsModal({ user, isOpen, onClose }: UserSettingsModalProps) {
  const { profile, updateProfile, updateAvatar, changePassword } = useUserProfile();
  const [formData, setFormData] = useState<FormData>({
    name: user.name || '',
    email: user.email || '',
    phone: '',
    avatar_url: user.avatar_url || '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carrega dados do usuário ao abrir modal
  useEffect(() => {
    if (isOpen && profile) {
      setFormData(prev => ({
        ...prev,
        name: profile.nome_completo || '',
        email: profile.email || '',
        phone: profile.telefone || '',
        avatar_url: profile.avatar_url || ''
      }));
    }
  }, [isOpen, profile]);

  // Fecha modal ao pressionar ESC
  useEffect(() => {
    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Fecha modal ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validação do nome
    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Nome deve ter pelo menos 2 caracteres';
    }

    // Validação do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = 'Email é obrigatório';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    // Validação do telefone (opcional)
    if (formData.phone && formData.phone.trim()) {
      const phoneRegex = /^\(\d{2}\)\s\d{4,5}-\d{4}$/;
      if (!phoneRegex.test(formData.phone)) {
        newErrors.phone = 'Formato: (11) 99999-9999';
      }
    }

    // Validação de senha (se preenchida)
    if (formData.new_password) {
      if (!formData.current_password) {
        newErrors.current_password = 'Senha atual é obrigatória para alterar senha';
      }
      
      if (formData.new_password.length < 6) {
        newErrors.new_password = 'Nova senha deve ter pelo menos 6 caracteres';
      }
      
      if (formData.new_password !== formData.confirm_password) {
        newErrors.confirm_password = 'Senhas não coincidem';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Remove erro do campo quando usuário começa a digitar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4,5})(\d{4})$/, '$1-$2');
    }
    return value;
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhone(value);
    handleInputChange('phone', formatted);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validação do arquivo
    if (file.size > 2 * 1024 * 1024) { // 2MB
      setErrors(prev => ({ ...prev, general: 'Imagem deve ter no máximo 2MB' }));
      return;
    }

    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, general: 'Arquivo deve ser uma imagem' }));
      return;
    }

    setUploadingAvatar(true);
    
    try {
      const avatarUrl = await updateAvatar(file);
      setFormData(prev => ({ ...prev, avatar_url: avatarUrl }));
      setErrors(prev => ({ ...prev, general: undefined }));
    } catch (error) {
      setErrors(prev => ({ ...prev, general: error instanceof Error ? error.message : 'Erro ao fazer upload da imagem' }));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      // Atualiza dados do perfil
      await updateProfile({
        nome_completo: formData.name.trim(),
        telefone: formData.phone.trim() || null
      });

      // Atualiza senha se fornecida
      if (formData.new_password) {
        await changePassword(formData.current_password, formData.new_password);
      }

      setSuccess(true);
      
      // Fecha modal após 2 segundos
      setTimeout(() => {
        setSuccess(false);
        onClose();
        window.location.reload(); // Recarrega para atualizar dados na interface
      }, 2000);

    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      setErrors({ general: error.message || 'Erro ao salvar configurações' });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Configurações da Conta</h2>
            <p className="text-sm text-gray-500 mt-1">Gerencie suas informações pessoais e preferências</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-150"
            disabled={loading}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors duration-150 ${
              activeTab === 'profile'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <User className="w-4 h-4 inline mr-2" />
            Perfil
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors duration-150 ${
              activeTab === 'security'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Eye className="w-4 h-4 inline mr-2" />
            Segurança
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
              <Check className="w-5 h-5 text-green-600 mr-3" />
              <div>
                <div className="font-medium text-green-800">Configurações salvas com sucesso!</div>
                <div className="text-sm text-green-600">Suas alterações foram aplicadas.</div>
              </div>
            </div>
          )}

          {/* General Error */}
          {errors.general && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
              <div className="text-red-800">{errors.general}</div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                {/* Avatar Section */}
                <div className="flex items-center space-x-6">
                  <div className="relative">
                    {formData.avatar_url ? (
                      <img
                        src={formData.avatar_url}
                        alt="Avatar"
                        className="w-20 h-20 rounded-full object-cover border-4 border-gray-200"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl border-4 border-gray-200">
                        {getInitials(formData.name)}
                      </div>
                    )}
                    
                    {uploadingAvatar && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-150"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      {uploadingAvatar ? 'Enviando...' : 'Alterar Foto'}
                    </button>
                    <p className="text-xs text-gray-500 mt-2">
                      JPG, PNG ou GIF. Máximo 2MB.
                    </p>
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>

                {/* Name Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User className="w-4 h-4 inline mr-1" />
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-150 ${
                      errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="Digite seu nome completo"
                    disabled={loading}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                  )}
                </div>

                {/* Email Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail className="w-4 h-4 inline mr-1" />
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-150 ${
                      errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="seu-email@exemplo.com"
                    disabled={loading}
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                  )}
                  {formData.email !== user.email && (
                    <p className="mt-1 text-sm text-amber-600">
                      ⚠️ Você receberá um email de confirmação para validar o novo endereço
                    </p>
                  )}
                </div>

                {/* Phone Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Phone className="w-4 h-4 inline mr-1" />
                    Telefone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-150 ${
                      errors.phone ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="(11) 99999-9999"
                    disabled={loading}
                  />
                  {errors.phone && (
                    <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                  )}
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertCircle className="w-5 h-5 text-amber-600 mr-2" />
                    <div className="text-sm text-amber-800">
                      <div className="font-medium">Alteração de Senha</div>
                      <div>Deixe em branco se não quiser alterar sua senha atual.</div>
                    </div>
                  </div>
                </div>

                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Senha Atual
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.current ? 'text' : 'password'}
                      value={formData.current_password}
                      onChange={(e) => handleInputChange('current_password', e.target.value)}
                      className={`w-full px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-150 ${
                        errors.current_password ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder="Digite sua senha atual"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.current_password && (
                    <p className="mt-1 text-sm text-red-600">{errors.current_password}</p>
                  )}
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.new ? 'text' : 'password'}
                      value={formData.new_password}
                      onChange={(e) => handleInputChange('new_password', e.target.value)}
                      className={`w-full px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-150 ${
                        errors.new_password ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder="Digite sua nova senha"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.new_password && (
                    <p className="mt-1 text-sm text-red-600">{errors.new_password}</p>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirmar Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={formData.confirm_password}
                      onChange={(e) => handleInputChange('confirm_password', e.target.value)}
                      className={`w-full px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-150 ${
                        errors.confirm_password ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder="Confirme sua nova senha"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.confirm_password && (
                    <p className="mt-1 text-sm text-red-600">{errors.confirm_password}</p>
                  )}
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors duration-150"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || success}
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-150"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : success ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Salvo!
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}