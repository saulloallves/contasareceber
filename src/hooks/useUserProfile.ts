import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../components/Auth/AuthProvider';

export interface UserProfile {
  id: string;
  nome_completo: string;
  email: string;
  telefone?: string;
  cargo?: string;
  nivel_permissao: string;
  avatar_url?: string;
  ativo: boolean;
  ultimo_acesso?: string;
  created_at?: string;
  updated_at?: string;
}

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const loadProfile = async () => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: profileError } = await supabase
        .from('usuarios_sistema')
        .select('*')
        .eq('email', user.email)
        .single();

      if (profileError) {
        throw new Error(`Erro ao carregar perfil: ${profileError.message}`);
      }

      setProfile(data);
    } catch (err) {
      console.error('Erro ao carregar perfil do usuário:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user?.email || !profile) {
      throw new Error('Usuário não autenticado');
    }

    try {
      const { data, error: updateError } = await supabase
        .from('usuarios_sistema')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('email', user.email)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Erro ao atualizar perfil: ${updateError.message}`);
      }

      setProfile(data);
      return data;
    } catch (err) {
      console.error('Erro ao atualizar perfil:', err);
      throw err;
    }
  };

  const updateAvatar = async (file: File): Promise<string> => {
    if (!user?.id) {
      throw new Error('Usuário não autenticado');
    }

    try {
      // Validação do arquivo
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('Arquivo deve ter no máximo 2MB');
      }

      if (!file.type.startsWith('image/')) {
        throw new Error('Arquivo deve ser uma imagem');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      // Upload para Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      // Obtém URL pública
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Atualiza perfil com nova URL
      await updateProfile({ avatar_url: urlData.publicUrl });

      // Atualiza também no auth metadata
      await supabase.auth.updateUser({
        data: { avatar_url: urlData.publicUrl }
      });

      return urlData.publicUrl;
    } catch (err) {
      console.error('Erro ao fazer upload do avatar:', err);
      throw err;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      // Primeiro verifica a senha atual fazendo login
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword
      });

      if (signInError) {
        throw new Error('Senha atual incorreta');
      }

      // Atualiza a senha
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw new Error(`Erro ao alterar senha: ${updateError.message}`);
      }

      return true;
    } catch (err) {
      console.error('Erro ao alterar senha:', err);
      throw err;
    }
  };

  const refreshProfile = () => {
    loadProfile();
  };

  useEffect(() => {
    loadProfile();
  }, [user?.email]);

  return {
    profile,
    loading,
    error,
    updateProfile,
    updateAvatar,
    changePassword,
    refreshProfile
  };
}