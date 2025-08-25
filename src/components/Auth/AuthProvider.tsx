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

  // Inicialização
  useEffect(() => {
    console.log('🎧 Configurando listener de auth state...');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state change:', event, session?.user?.email);
        
        if (session?.user) {
          setUser(session.user);
          
          // Cria sessão no sistema para logins
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            console.log('✅ Novo login detectado, criando sessão...');
            try {
              const { sessaoService } = await import('../../services/sessaoService');
              await sessaoService.criarSessao(session.user.id);
              console.log('✅ Sessão criada com sucesso');
            } catch (error) {
              console.warn('⚠️ Erro ao criar sessão do usuário:', error);
            }
          }
        } else {
          setUser(null);
          
          if (event === 'SIGNED_OUT') {
            console.log('🚪 Usuário saiu, encerrando sessão...');
            try {
              const { sessaoService } = await import('../../services/sessaoService');
              await sessaoService.encerrarSessao();
              console.log('✅ Sessão encerrada com sucesso');
            } catch (error) {
              console.warn('⚠️ Erro ao encerrar sessão do usuário:', error);
            }
          }
        }
        
        setLoading(false);
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
