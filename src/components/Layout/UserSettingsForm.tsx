import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { 
  User, Mail, Phone, Loader2, AlertCircle 
} from 'lucide-react';

// Schema de validação
const profileSchema = yup.object({
  name: yup
    .string()
    .required('Nome é obrigatório')
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  email: yup
    .string()
    .required('Email é obrigatório')
    .email('Email inválido'),
  phone: yup
    .string()
    .nullable()
    .matches(/^\(\d{2}\)\s\d{4,5}-\d{4}$|^$/, 'Formato: (11) 99999-9999')
});

const securitySchema = yup.object({
  current_password: yup
    .string()
    .when('new_password', {
      is: (val: string) => val && val.length > 0,
      then: (schema) => schema.required('Senha atual é obrigatória'),
      otherwise: (schema) => schema.notRequired()
    }),
  new_password: yup
    .string()
    .min(6, 'Nova senha deve ter pelo menos 6 caracteres'),
  confirm_password: yup
    .string()
    .oneOf([yup.ref('new_password')], 'Senhas não coincidem')
});

interface ProfileFormData {
  name: string;
  email: string;
  phone: string;
}

interface SecurityFormData {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

interface UserSettingsFormProps {
  initialData: {
    name: string;
    email: string;
    phone: string;
  };
  onSubmitProfile: (data: ProfileFormData) => Promise<void>;
  onSubmitSecurity: (data: SecurityFormData) => Promise<void>;
  loading: boolean;
  activeTab: 'profile' | 'security';
}

export function UserSettingsForm({ 
  initialData, 
  onSubmitProfile, 
  onSubmitSecurity, 
  loading, 
  activeTab 
}: UserSettingsFormProps) {
  const profileForm = useForm<ProfileFormData>({
    resolver: yupResolver(profileSchema),
    defaultValues: initialData,
    mode: 'onChange'
  });

  const securityForm = useForm<SecurityFormData>({
    resolver: yupResolver(securitySchema),
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: ''
    },
    mode: 'onChange'
  });

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4,5})(\d{4})$/, '$1-$2');
    }
    return value;
  };

  const handlePhoneChange = (value: string, onChange: (value: string) => void) => {
    const formatted = formatPhone(value);
    onChange(formatted);
  };

  if (activeTab === 'profile') {
    return (
      <form onSubmit={profileForm.handleSubmit(onSubmitProfile)} className="space-y-6">
        {/* Name Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <User className="w-4 h-4 inline mr-1" />
            Nome Completo *
          </label>
          <input
            {...profileForm.register('name')}
            type="text"
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-150 ${
              profileForm.formState.errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            placeholder="Digite seu nome completo"
            disabled={loading}
          />
          {profileForm.formState.errors.name && (
            <div className="mt-1 flex items-center text-sm text-red-600">
              <AlertCircle className="w-4 h-4 mr-1" />
              {profileForm.formState.errors.name.message}
            </div>
          )}
        </div>

        {/* Email Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Mail className="w-4 h-4 inline mr-1" />
            Email *
          </label>
          <input
            {...profileForm.register('email')}
            type="email"
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-150 ${
              profileForm.formState.errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            placeholder="seu-email@exemplo.com"
            disabled={loading}
          />
          {profileForm.formState.errors.email && (
            <div className="mt-1 flex items-center text-sm text-red-600">
              <AlertCircle className="w-4 h-4 mr-1" />
              {profileForm.formState.errors.email.message}
            </div>
          )}
          {profileForm.watch('email') !== initialData.email && (
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
            {...profileForm.register('phone', {
              onChange: (e) => handlePhoneChange(e.target.value, (value) => {
                profileForm.setValue('phone', value);
              })
            })}
            type="tel"
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-150 ${
              profileForm.formState.errors.phone ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            placeholder="(11) 99999-9999"
            disabled={loading}
          />
          {profileForm.formState.errors.phone && (
            <div className="mt-1 flex items-center text-sm text-red-600">
              <AlertCircle className="w-4 h-4 mr-1" />
              {profileForm.formState.errors.phone.message}
            </div>
          )}
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={securityForm.handleSubmit(onSubmitSecurity)} className="space-y-6">
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
        <input
          {...securityForm.register('current_password')}
          type="password"
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-150 ${
            securityForm.formState.errors.current_password ? 'border-red-300 bg-red-50' : 'border-gray-300'
          }`}
          placeholder="Digite sua senha atual"
          disabled={loading}
        />
        {securityForm.formState.errors.current_password && (
          <div className="mt-1 flex items-center text-sm text-red-600">
            <AlertCircle className="w-4 h-4 mr-1" />
            {securityForm.formState.errors.current_password.message}
          </div>
        )}
      </div>

      {/* New Password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Nova Senha
        </label>
        <input
          {...securityForm.register('new_password')}
          type="password"
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-150 ${
            securityForm.formState.errors.new_password ? 'border-red-300 bg-red-50' : 'border-gray-300'
          }`}
          placeholder="Digite sua nova senha"
          disabled={loading}
        />
        {securityForm.formState.errors.new_password && (
          <div className="mt-1 flex items-center text-sm text-red-600">
            <AlertCircle className="w-4 h-4 mr-1" />
            {securityForm.formState.errors.new_password.message}
          </div>
        )}
      </div>

      {/* Confirm Password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Confirmar Nova Senha
        </label>
        <input
          {...securityForm.register('confirm_password')}
          type="password"
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-150 ${
            securityForm.formState.errors.confirm_password ? 'border-red-300 bg-red-50' : 'border-gray-300'
          }`}
          placeholder="Confirme sua nova senha"
          disabled={loading}
        />
        {securityForm.formState.errors.confirm_password && (
          <div className="mt-1 flex items-center text-sm text-red-600">
            <AlertCircle className="w-4 h-4 mr-1" />
            {securityForm.formState.errors.confirm_password.message}
          </div>
        )}
      </div>
    </form>
  );
}