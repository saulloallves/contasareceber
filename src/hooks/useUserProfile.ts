import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface UserProfile {
  id?: string;
  nome_completo: string;
  email: string;
  telefone?: string;
  cargo?: string;
  nivel_permissao: string;
  avatar_url?: string;
  ativo?: boolean;
  ultimo_acesso?: string;
  created_at?: string;
  updated_at?: string;
}

export function useUserProfile(userEmail?: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = async () => {
    if (!userEmail) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: profileError } = await supabase
        .from('usuarios_sistema')
        .select('*')
        .eq('email', userEmail)
        .maybeSingle();

      if (profileError) {
        console.warn('Perfil não encontrado na tabela usuarios_sistema:', profileError);
        // Não falha se não encontrar perfil
        setProfile(null);
        setLoading(false);
        return;
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
    if (!userEmail || !profile) {
      throw new Error('Usuário não autenticado');
    }

    try {
      const { data, error: updateError } = await supabase
        .from('usuarios_sistema')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('email', userEmail)
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
    if (!userEmail || !profile) {
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

      // Busca o user_id do Supabase Auth
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Usuário não autenticado no Supabase');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload para Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      // Obtém URL pública
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const avatarUrl = urlData.publicUrl;

      // Atualiza perfil na tabela usuarios_sistema se existir
      if (profile.id) {
        await updateProfile({ avatar_url: avatarUrl });
      }

      // Atualiza também no auth metadata para sincronização
      try {
        await supabase.auth.updateUser({
          data: { avatar_url: avatarUrl }
        });
      } catch (authError) {
        console.warn('Aviso: Não foi possível atualizar avatar no auth metadata:', authError);
        // Não falha o processo se não conseguir atualizar o metadata
      }

      return avatarUrl;
    } catch (err) {
      console.error('Erro ao fazer upload do avatar:', err);
      throw err;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      // Primeiro verifica a senha atual fazendo login

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
  }, [userEmail]);

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