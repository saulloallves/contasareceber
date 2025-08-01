import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profile: any;
  signOut: () => Promise<void>;
  refreshProfile: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    // Função para carregar sessão inicial
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Erro ao obter sessão:', error);
          if (mounted) {
            setUser(null);
            setProfile(null);
            setLoading(false);
          }
          return;
        }

        if (mounted) {
          setUser(session?.user ?? null);
          
          // Se há usuário, tenta carregar perfil
          if (session?.user) {
            await loadUserProfile(session.user);
          }
          
          setLoading(false);
        }
      } catch (error) {
        console.error('Erro ao carregar sessão inicial:', error);
        if (mounted) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    };

    // Carrega sessão inicial
    getInitialSession();

    // Escuta mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('Auth state changed:', event, session?.user?.email);
        
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await loadUserProfile(session.user);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadUserProfile = async (authUser: User) => {
    try {
      console.log('Carregando perfil para:', authUser.email);
      
      const { data, error } = await supabase
        .from('usuarios_sistema')
        .select('*')
        .eq('email', authUser.email)
        .maybeSingle();

      if (error) {
        console.warn('Erro ao carregar perfil (não crítico):', error);
        // Não falha se não encontrar perfil, apenas usa dados do auth
        setProfile({
          nome_completo: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Usuário',
          email: authUser.email,
          nivel_permissao: 'admin',
          avatar_url: authUser.user_metadata?.avatar_url
        });
        return;
      }

      if (data) {
        console.log('Perfil carregado:', data.nome_completo);
        setProfile(data);
      } else {
        // Se não há perfil na tabela, cria um básico
        setProfile({
          nome_completo: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Usuário',
          email: authUser.email,
          nivel_permissao: 'admin',
          avatar_url: authUser.user_metadata?.avatar_url
        });
      }
    } catch (error) {
      console.error('Erro ao carregar perfil do usuário:', error);
      // Em caso de erro, usa dados básicos do auth
      setProfile({
        nome_completo: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Usuário',
        email: authUser.email,
        nivel_permissao: 'admin',
        avatar_url: authUser.user_metadata?.avatar_url
      });
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setProfile(null);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const refreshProfile = () => {
    if (user) {
      loadUserProfile(user);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, profile, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}