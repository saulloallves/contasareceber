import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import { sessaoService } from "../../services/sessaoService";

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
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    setInitialized(true);
    
    const initializeAuth = async () => {
      try {
        console.log('🔄 Inicializando autenticação...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.warn('⚠️ Erro ao buscar sessão:', error);
        }
        
        console.log('👤 Sessão encontrada:', session?.user?.email || 'Nenhuma');
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        setUser(null);
      } finally {
        console.log('✅ Inicialização concluída');
        setLoading(false);
      }
    };
    
    initializeAuth();

    // Listener para mudanças de estado
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state change:', event, session?.user?.email || 'Nenhum usuário');
        setUser(session?.user ?? null);
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, [initialized]);

  const signOut = async () => {
    try {
      console.log('🚪 Fazendo logout...');
      
      // Encerra sessão no banco e limpa storage
      if (user?.id) {
        try {
          await sessaoService.encerrarSessao();
          console.log('✅ Sessão encerrada no banco');
        } catch (sessionError) {
          console.warn('⚠️ Erro ao encerrar sessão no banco:', sessionError);
          // Limpa manualmente se falhar
          sessionStorage.removeItem(`active_session_${user.id}`);
          localStorage.removeItem('session_token');
        }
      }
    } catch (error) {
      console.warn('⚠️ Erro ao limpar sessão:', error);
    }
    
    await supabase.auth.signOut();
    setUser(null);
  };

  const refreshUser = () => {
    console.log('🔄 Refreshing user...');
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