import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🎧 Configurando listener de auth state...');
    
    // Busca sessão inicial e define loading como false
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('🔍 Sessão inicial:', session?.user?.email || 'Nenhuma');
        
        if (error) {
          console.error('❌ Erro ao buscar sessão:', error);
        }
        
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        setUser(null);
      } finally {
        // SEMPRE define loading como false, independente do resultado
        setLoading(false);
      }
    };
    
    initializeAuth();

    // Listener para mudanças de estado
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state change:', event, session?.user?.email);
        
        setUser(session?.user ?? null);
        
        // Cria sessão apenas no login bem-sucedido
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('✅ Login detectado, criando sessão...');
          try {
            const { sessaoService } = await import('../../services/sessaoService');
            await sessaoService.criarSessao(session.user.id);
            console.log('✅ Sessão criada com sucesso');
          } catch (error) {
            console.warn('⚠️ Erro ao criar sessão:', error);
          }
        }
        
        // Encerra sessão no logout
        if (event === 'SIGNED_OUT') {
          console.log('🚪 Logout detectado, encerrando sessão...');
          try {
            const { sessaoService } = await import('../../services/sessaoService');
            await sessaoService.encerrarSessao();
            console.log('✅ Sessão encerrada');
          } catch (error) {
            console.warn('⚠️ Erro ao encerrar sessão:', error);
          }
        }
      }
    );
    
    return () => {
      console.log('🧹 Removendo listener de auth state');
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    console.log('🚪 Iniciando logout...');
    try {
      const { sessaoService } = await import('../../services/sessaoService');
      await sessaoService.encerrarSessao();
    } catch (error) {
      console.warn('Erro ao encerrar sessão:', error);
    }
    
    await supabase.auth.signOut();
    setUser(null);
  };

  const refreshUser = () => {
    console.log('🔄 Forçando refresh do usuário...');
    window.location.reload();
  };

  const value = {
    user,
    loading,
    signOut,
    refreshUser,
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
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}