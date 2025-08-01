import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';

interface UserProfile {
  id?: string;
  nome_completo: string;
  email: string;
  telefone?: string;
  cargo?: string;
  nivel_permissao: string;
  avatar_url?: string;
  ativo?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profile: UserProfile | null;
  signOut: () => Promise<void>;
  refreshProfile: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Função para carregar perfil do usuário (sem loops)
  const loadUserProfile = async (authUser: User): Promise<UserProfile> => {
    try {
      console.log('🔍 Carregando perfil para:', authUser.email);
      
      const { data, error } = await supabase
        .from('usuarios_sistema')
        .select('*')
        .eq('email', authUser.email)
        .maybeSingle();

      if (error) {
        console.warn('⚠️ Perfil não encontrado na tabela usuarios_sistema:', error.message);
      }

      // Se encontrou perfil na tabela, usa ele
      if (data) {
        console.log('✅ Perfil encontrado na tabela:', data.nome_completo);
        return {
          id: data.id,
          nome_completo: data.nome_completo,
          email: data.email,
          telefone: data.telefone,
          cargo: data.cargo,
          nivel_permissao: data.nivel_permissao || 'admin',
          avatar_url: data.avatar_url || authUser.user_metadata?.avatar_url,
          ativo: data.ativo
        };
      }

      // Se não encontrou, cria perfil básico baseado no auth
      console.log('📝 Criando perfil básico para:', authUser.email);
      const basicProfile: UserProfile = {
        nome_completo: authUser.user_metadata?.name || 
                      authUser.user_metadata?.full_name || 
                      authUser.email?.split('@')[0] || 
                      'Usuário',
        email: authUser.email || '',
        nivel_permissao: 'admin',
        avatar_url: authUser.user_metadata?.avatar_url,
        ativo: true
      };

      return basicProfile;
    } catch (error) {
      console.error('❌ Erro ao carregar perfil:', error);
      
      // Em caso de erro, retorna perfil mínimo
      return {
        nome_completo: authUser.user_metadata?.name || 
                      authUser.email?.split('@')[0] || 
                      'Usuário',
        email: authUser.email || '',
        nivel_permissao: 'admin',
        avatar_url: authUser.user_metadata?.avatar_url,
        ativo: true
      };
    }
  };

  // Inicialização única
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('🚀 Inicializando autenticação...');
        
        // Busca sessão atual
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Erro ao obter sessão:', error);
          if (mounted) {
            setUser(null);
            setProfile(null);
            setLoading(false);
            setInitialized(true);
          }
          return;
        }

        if (mounted) {
          setUser(session?.user ?? null);
          
          // Se há usuário, carrega perfil
          if (session?.user) {
            const userProfile = await loadUserProfile(session.user);
            if (mounted) {
              setProfile(userProfile);
            }
          } else {
            setProfile(null);
          }
          
          setLoading(false);
          setInitialized(true);
        }
      } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        if (mounted) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    if (!initialized) {
      initializeAuth();
    }

    return () => {
      mounted = false;
    };
  }, [initialized]);

  // Listener de mudanças de auth (separado da inicialização)
  useEffect(() => {
    if (!initialized) return;

    let mounted = true;

    console.log('👂 Configurando listener de auth...');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('🔄 Auth state changed:', event, session?.user?.email);
        
        // Evita loops desnecessários
        if (event === 'TOKEN_REFRESHED') {
          return;
        }
        
        setUser(session?.user ?? null);
        
        if (session?.user) {
          try {
            const userProfile = await loadUserProfile(session.user);
            if (mounted) {
              setProfile(userProfile);
            }
          } catch (error) {
            console.error('❌ Erro ao carregar perfil no listener:', error);
            if (mounted) {
              setProfile(null);
            }
          }
        } else {
          if (mounted) {
            setProfile(null);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [initialized]);

  const signOut = async () => {
    try {
      console.log('👋 Fazendo logout...');
      await supabase.auth.signOut();
      setProfile(null);
    } catch (error) {
      console.error('❌ Erro ao fazer logout:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      try {
        const userProfile = await loadUserProfile(user);
        setProfile(userProfile);
      } catch (error) {
        console.error('❌ Erro ao atualizar perfil:', error);
      }
    }
  };

  const value = {
    user,
    loading,
    profile,
    signOut,
    refreshProfile
  };

  return (
    <AuthContext.Provider value={value}>
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